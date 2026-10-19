import { describe, it, expect, vi, beforeEach } from "vitest";

// updateLeadStatus: kaybedildi'den çıkan velide açık kontenjan görevi kapanır.
type Op = { table: string; op: string; payload?: unknown; filters: unknown[][] };
let ops: Op[] = [];
let leadRow: { status: string; converted_student_id: string | null; first_contact_at?: string | null };
let tasksUpdateError: { message: string } | null = null;

function builder(table: string) {
  const o: Op = { table, op: "select", filters: [] };
  const b: Record<string, unknown> = {};
  for (const f of ["eq", "like", "in", "is", "order", "limit"]) {
    b[f] = (...a: unknown[]) => (o.filters.push([f, ...a]), b);
  }
  b.select = () => b;
  b.update = (p: unknown) => ((o.op = "update"), (o.payload = p), b);
  b.insert = (p: unknown) => ((o.op = "insert"), (o.payload = p), b);
  b.single = () => b;
  b.maybeSingle = () => b;
  b.then = (resolve: (v: unknown) => unknown) => {
    ops.push(o);
    const data = o.table === "leads" && o.op === "select" ? { id: "L1", ...leadRow } : null;
    const error = o.table === "tasks" && o.op === "update" ? tasksUpdateError : null;
    return Promise.resolve({ data, error }).then(resolve);
  };
  return b;
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionProfile: async () => ({ id: "U1", full_name: "D", role: "danisman" }) }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({ from: (t: string) => builder(t) }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabase: () => null }));
const logEvent = vi.fn();
vi.mock("@/lib/events", () => ({ logEvent: (...a: unknown[]) => logEvent(...a), kickWaFlush: vi.fn() }));

import { logCallOutcome, reopenLead, updateLeadStatus } from "@/actions/leads";

const kontenjanCloses = () =>
  ops.filter(
    (o) =>
      o.table === "tasks" &&
      o.op === "update" &&
      o.filters.some((f) => f[0] === "like" && f[2] === "kontenjan:L1%"),
  );

beforeEach(() => {
  ops = [];
  tasksUpdateError = null;
  logEvent.mockClear();
});

const closes = (prefix: string) =>
  ops.filter((o) => o.table === "tasks" && o.op === "update" && o.filters.some((f) => f[0] === "like" && f[2] === `${prefix}%`));

describe("updateLeadStatus · kontenjan görevi", () => {
  it("yeniden açılan (kaybedildi'den çıkan) velide açık kontenjan görevi kapanır", async () => {
    leadRow = { status: "kaybedildi", converted_student_id: null };
    expect(await reopenLead("L1")).toEqual({});
    const close = kontenjanCloses();
    expect(close).toHaveLength(1);
    expect(close[0].payload).toEqual({ status: "tamamlandi" });
    expect(close[0].filters).toContainEqual(["eq", "status", "acik"]);
  });

  it("kaybedildi'ye geçişte ya da başka geçişte dokunulmaz", async () => {
    leadRow = { status: "yeni", converted_student_id: null };
    await updateLeadStatus("L1", "kaybedildi", "ulasilamadi");
    await updateLeadStatus("L1", "ulasildi");
    expect(kontenjanCloses()).toHaveLength(0);
  });
});

describe("updateLeadStatus · kontenjan kapanışı hata verirse", () => {
  it("durum değişikliği ve olayı yine tamamlanır (R25)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    leadRow = { status: "kaybedildi", converted_student_id: null };
    tasksUpdateError = { message: "boom" };
    expect(await reopenLead("L1")).toEqual({});
    expect(logEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventType: "durum_degisti" }));
  });
});

describe("logCallOutcome (eski arama paneli, R24)", () => {
  const leadPatch = () =>
    ops.filter((o) => o.table === "leads" && o.op === "update" && "last_activity_at" in (o.payload as object)).at(-1)
      ?.payload as Record<string, unknown>;

  it("ilk temas boşsa doldurur", async () => {
    leadRow = { status: "ulasildi", converted_student_id: null, first_contact_at: null };
    expect(await logCallOutcome({ leadId: "L1", outcome: "acmadi" })).toEqual({});
    expect(leadPatch()).toHaveProperty("first_contact_at");
  });

  it("ilk temas doluysa dokunmaz", async () => {
    leadRow = { status: "ulasildi", converted_student_id: null, first_contact_at: "2026-10-01T08:00:00Z" };
    await logCallOutcome({ leadId: "L1", outcome: "acmadi" });
    expect(leadPatch()).not.toHaveProperty("first_contact_at");
  });

  it("Ulaştım takip ve geri arama görevlerini kapatır; Açmadı kapatmaz", async () => {
    leadRow = { status: "ulasildi", converted_student_id: null, first_contact_at: "2026-10-01T08:00:00Z" };
    await logCallOutcome({ leadId: "L1", outcome: "acmadi" });
    expect(closes("takip:L1:")).toHaveLength(0);
    expect(closes("geri:L1")).toHaveLength(0);
    await logCallOutcome({ leadId: "L1", outcome: "ulastim", next: "sonra" });
    expect(closes("takip:L1:")).toHaveLength(1);
    expect(closes("geri:L1")).toHaveLength(1);
  });
});
