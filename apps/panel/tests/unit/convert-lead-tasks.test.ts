import { describe, it, expect, vi, beforeEach } from "vitest";

// R27: öğrenciye dönüştürülen velinin takip ve geri arama görevleri kapanır.
type Op = { table: string; op: string; payload?: unknown; filters: unknown[][] };
let ops: Op[] = [];
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
  b.delete = () => ((o.op = "delete"), b);
  b.single = () => b;
  b.maybeSingle = () => b;
  b.then = (resolve: (v: unknown) => unknown) => {
    ops.push(o);
    let data: unknown = null;
    let error: unknown = null;
    if (table === "price_lists") data = { season: "2026-2027" };
    if (table === "leads" && o.op === "select") {
      data = { id: "L1", parent_name: "Veli", phone: "+905005550001", child_name: "Çocuk",
        child_birth_month: 1, child_birth_year: 2022, converted_student_id: null };
    }
    if (table === "students" && o.op === "insert") data = { id: "S1" };
    if (table === "leads" && o.op === "update") data = { id: "L1" };
    if (table === "tasks" && o.op === "update") error = tasksUpdateError;
    return Promise.resolve({ data, error }).then(resolve);
  };
  return b;
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionProfile: async () => ({ id: "U1", full_name: "D", role: "yonetici" }) }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({ from: (t: string) => builder(t) }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabase: () => null }));
vi.mock("@/lib/events", () => ({ logEvent: vi.fn(), kickWaFlush: vi.fn() }));
vi.mock("@/actions/offers", () => ({
  getApprovedOffer: async () => ({ id: "O1", program: "tam_gun", offered_price: 100000, installment_count: 10 }),
}));

import { convertLeadToStudent } from "@/actions/students";

const closes = (prefix: string) =>
  ops.filter((o) => o.table === "tasks" && o.op === "update" && o.filters.some((f) => f[0] === "like" && f[2] === `${prefix}%`));

beforeEach(() => {
  ops = [];
  tasksUpdateError = null;
});

describe("convertLeadToStudent · arama takibi (R27)", () => {
  it("takip ve geri arama görevlerini kapatır, kontenjana dokunmaz", async () => {
    const res = await convertLeadToStudent("L1", "2026-11-01");
    expect(res).toHaveProperty("studentId", "S1");
    expect(closes("takip:L1:")).toHaveLength(1);
    expect(closes("geri:L1")).toHaveLength(1);
    expect(closes("takip:L1:")[0].payload).toEqual({ status: "tamamlandi" });
    expect(closes("kontenjan:L1")).toHaveLength(0);
  });

  it("görev kapanışı hata verse de dönüştürme başarılı döner", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    tasksUpdateError = { message: "boom" };
    expect(await convertLeadToStudent("L1", "2026-11-01")).toHaveProperty("studentId", "S1");
  });
});
