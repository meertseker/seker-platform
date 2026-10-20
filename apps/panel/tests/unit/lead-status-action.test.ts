import { describe, it, expect, vi, beforeEach } from "vitest";

// updateLeadStatus: kaybedildi'den çıkan velide açık kontenjan görevi kapanır.
type Op = { table: string; op: string; payload?: unknown; filters: unknown[][] };
let ops: Op[] = [];
let leadRow: { status: string; converted_student_id: string | null; first_contact_at?: string | null };
let tasksUpdateError: { message: string } | null = null;
let pendingAppointments: { id: string }[] = [];

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
    const data =
      o.table === "leads" && o.op === "select"
        ? { id: "L1", ...leadRow }
        : o.table === "appointments" && o.op === "select"
          ? pendingAppointments
          : null;
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
  pendingAppointments = [];
  logEvent.mockClear();
});

describe("updateLeadStatus · kaybedildi bekleyen randevuları iptal eder (H8)", () => {
  const apptUpdates = () => ops.filter((o) => o.table === "appointments" && o.op === "update");

  it("bekleyen randevular iptal olur, her biri için randevu_sonuclandi olayı yazılır", async () => {
    leadRow = { status: "randevu", converted_student_id: null };
    pendingAppointments = [{ id: "A1" }, { id: "A2" }];
    expect(await updateLeadStatus("L1", "kaybedildi", "fiyat")).toEqual({});
    const sel = ops.find((o) => o.table === "appointments" && o.op === "select")!;
    expect(sel.filters).toEqual(expect.arrayContaining([["eq", "lead_id", "L1"], ["eq", "outcome", "bekliyor"]]));
    expect(apptUpdates()).toHaveLength(1);
    expect(apptUpdates()[0].payload).toMatchObject({ outcome: "iptal" });
    expect(apptUpdates()[0].filters).toEqual(expect.arrayContaining([["eq", "lead_id", "L1"], ["eq", "outcome", "bekliyor"]]));
    for (const id of ["A1", "A2"]) {
      expect(logEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ entityType: "appointment", entityId: id, eventType: "randevu_sonuclandi", payload: expect.objectContaining({ outcome: "iptal" }) }),
      );
    }
    // Durum olayı yine yazılır.
    expect(logEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventType: "durum_degisti" }));
  });

  it("bekleyen randevu yoksa güncelleme ve olay yok", async () => {
    leadRow = { status: "ulasildi", converted_student_id: null };
    await updateLeadStatus("L1", "kaybedildi", "fiyat");
    expect(apptUpdates()).toHaveLength(0);
    expect(logEvent).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventType: "randevu_sonuclandi" }));
  });

  it("kazanıldı ya da açık durumlar arası geçişte randevuya dokunmaz", async () => {
    leadRow = { status: "randevu", converted_student_id: null };
    pendingAppointments = [{ id: "A1" }];
    await updateLeadStatus("L1", "gorusme_yapildi");
    await updateLeadStatus("L1", "kazanildi");
    expect(apptUpdates()).toHaveLength(0);
  });
});

/** Velinin (lead_id) görevlerini `pattern` like deseniyle kapatan güncellemeler. */
const closesLike = (pattern: string) =>
  ops.filter(
    (o) =>
      o.table === "tasks" &&
      o.op === "update" &&
      o.filters.some((f) => f[0] === "like" && f[2] === pattern) &&
      o.filters.some((f) => f[0] === "eq" && f[1] === "lead_id" && f[2] === "L1"),
  );
const closes = (prefix: string) => closesLike(`${prefix}%`);

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

  it("Ulaştım açık arama görevlerini (takip, geri, gelmedi, ziyaret araması) kapatır; Açmadı kapatmaz", async () => {
    leadRow = { status: "ulasildi", converted_student_id: null, first_contact_at: "2026-10-01T08:00:00Z" };
    await logCallOutcome({ leadId: "L1", outcome: "acmadi" });
    expect(closes("takip:")).toHaveLength(0);
    expect(closes("geri:")).toHaveLength(0);
    await logCallOutcome({ leadId: "L1", outcome: "ulastim", next: "sonra" });
    expect(closes("takip:")).toHaveLength(1);
    expect(closes("geri:")).toHaveLength(1);
    expect(closes("noshow:")).toHaveLength(1);
    expect(closesLike("ziyaret:%:2")).toHaveLength(1);
    expect(closesLike("ziyaret:%:3")).toHaveLength(1);
    // Teşekkür mesajı ve hatırlatma arama değildir; kontenjan kayıp sonrası mesajdır.
    expect(closesLike("ziyaret:%:1")).toHaveLength(0);
    expect(closes("ziyaret:")).toHaveLength(0);
    expect(closes("hatirlat:")).toHaveLength(0);
    expect(closes("kontenjan:")).toHaveLength(0);
  });
});

describe("updateLeadStatus · kapanışta arama takibi (R27)", () => {
  it("kazanıldı velinin tüm açık otomatik görevlerini kapatır", async () => {
    leadRow = { status: "teklif", converted_student_id: null };
    expect(await updateLeadStatus("L1", "kazanildi")).toEqual({});
    for (const kind of ["takip", "geri", "noshow", "hatirlat", "ziyaret", "kontenjan"]) {
      expect(closes(`${kind}:`), kind).toHaveLength(1);
    }
    expect(closes("takip:")[0].payload).toEqual({ status: "tamamlandi" });
  });

  it("kaybedildi kontenjan dışındaki tüm görevleri kapatır", async () => {
    leadRow = { status: "ulasildi", converted_student_id: null };
    await updateLeadStatus("L1", "kaybedildi", "fiyat");
    for (const kind of ["takip", "geri", "noshow", "hatirlat", "ziyaret"]) {
      expect(closes(`${kind}:`), kind).toHaveLength(1);
    }
    expect(kontenjanCloses()).toHaveLength(0);
    expect(closes("kontenjan:")).toHaveLength(0);
  });

  it("açık durumlar arası geçişte kapatmaz", async () => {
    leadRow = { status: "ulasildi", converted_student_id: null };
    await updateLeadStatus("L1", "randevu");
    expect(ops.filter((o) => o.table === "tasks" && o.op === "update")).toHaveLength(0);
  });

  it("kapanış hata verirse durum olayı yine yazılır", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    leadRow = { status: "teklif", converted_student_id: null };
    tasksUpdateError = { message: "boom" };
    expect(await updateLeadStatus("L1", "kazanildi")).toEqual({});
    expect(logEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventType: "durum_degisti" }));
  });
});
