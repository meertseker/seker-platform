import { describe, it, expect, vi, beforeEach } from "vitest";

// updateLeadStatus: kaybedildi'den çıkan velide açık kontenjan görevi kapanır.
type Op = { table: string; op: string; payload?: unknown; filters: unknown[][] };
let ops: Op[] = [];
let leadRow: { status: string; converted_student_id: string | null };

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
    const data = o.table === "leads" && o.op === "select" ? leadRow : null;
    return Promise.resolve({ data, error: null }).then(resolve);
  };
  return b;
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionProfile: async () => ({ id: "U1", full_name: "D", role: "danisman" }) }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({ from: (t: string) => builder(t) }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabase: () => null }));
vi.mock("@/lib/events", () => ({ logEvent: vi.fn(), kickWaFlush: vi.fn() }));

import { reopenLead, updateLeadStatus } from "@/actions/leads";

const kontenjanCloses = () =>
  ops.filter(
    (o) =>
      o.table === "tasks" &&
      o.op === "update" &&
      o.filters.some((f) => f[0] === "like" && f[2] === "kontenjan:L1%"),
  );

beforeEach(() => {
  ops = [];
});

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
