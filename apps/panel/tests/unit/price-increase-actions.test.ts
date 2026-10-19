import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionProfile = vi.fn();
const revalidatePath = vi.fn();
const logEvent = vi.fn();
const rpc = vi.fn();
const eq = vi.fn();
const not = vi.fn();
const inFn = vi.fn();
let planRows: unknown[] = [];

function chain() {
  const c: Record<string, unknown> = {};
  c.eq = (...a: unknown[]) => (eq(...a), c);
  c.not = (...a: unknown[]) => (not(...a), c);
  c.in = (...a: unknown[]) => (inFn(...a), c);
  c.select = () => c;
  c.then = (resolve: (v: unknown) => unknown) => resolve({ data: planRows, error: null });
  return c;
}
const from = vi.fn(() => ({ select: () => chain(), update: () => chain() }));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/lib/auth", () => ({ getSessionProfile: () => getSessionProfile() }));
vi.mock("@/lib/events", () => ({ logEvent: (...a: unknown[]) => logEvent(...a) }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({ from }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabase: () => ({ from, rpc }) }));

import { applyPriceIncrease, finalizeAmounts, previewPriceIncrease } from "@/actions/price-increase";

const req = { season: "2026-2027", percent: 10, fromMonth: "2027-01" };

function plan(id: string, name: string, amounts: number[], extra: Record<string, unknown> = {}) {
  return {
    id,
    student_id: `s-${id}`,
    tentative_from: "2027-01-01",
    total_amount: String(amounts.reduce((a, b) => a + b, 0)),
    student: { full_name: name, status: "aktif" },
    installments: amounts.map((a, i) => ({
      id: `${id}-i${i}`,
      due_date: `2027-0${i + 1}-05`,
      amount: String(a),
      status: "bekliyor",
    })),
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionProfile.mockResolvedValue({ id: "y1", role: "yonetici" });
  rpc.mockResolvedValue({ error: null });
  planRows = [];
});

describe("previewPriceIncrease", () => {
  it("danışman reddedilir", async () => {
    getSessionProfile.mockResolvedValue({ id: "d", role: "danisman" });
    expect(await previewPriceIncrease(req)).toEqual({ error: "Bu işlem için yönetici yetkisi gerekir" });
    expect(from).not.toHaveBeenCalled();
  });

  it("oran 0 ya da 150 reddedilir", async () => {
    expect(await previewPriceIncrease({ ...req, percent: 0 })).toEqual({ error: "Zam oranı 0 ile 100 arasında olmalı" });
    expect(await previewPriceIncrease({ ...req, percent: 150 })).toEqual({ error: "Zam oranı 0 ile 100 arasında olmalı" });
    expect(from).not.toHaveBeenCalled();
  });

  it("sezon dışı ay reddedilir", async () => {
    const r = await previewPriceIncrease({ ...req, fromMonth: "2026-07" });
    expect("error" in r).toBe(true);
  });

  it("önizleme ayrılmış öğrenciyi getirmez", async () => {
    planRows = [plan("p1", "ALİ", [10000])];
    await previewPriceIncrease(req);
    expect(eq).toHaveBeenCalledWith("student.status", "aktif");
    expect(eq).toHaveBeenCalledWith("item_type", "aidat");
    expect(eq).toHaveBeenCalledWith("season", "2026-2027");
    expect(not).toHaveBeenCalledWith("tentative_from", "is", null);
  });

  it("adla sıralar, değişimi olmayanı çıkarır", async () => {
    planRows = [plan("p1", "VELİ", [10000]), plan("p2", "ALİ", [10000]), plan("p3", "CEM", [])];
    const r = await previewPriceIncrease(req);
    if ("error" in r) throw new Error(r.error);
    expect(r.plans.map((p) => p.fullName)).toEqual(["ALİ", "VELİ"]);
  });
});

describe("applyPriceIncrease", () => {
  it("uygula sunucuda yeniden hesaplar", async () => {
    planRows = [plan("p1", "ALİ", [10000, 10000])];
    const r = await applyPriceIncrease({ ...req, planIds: ["p1"] });
    expect(r).toEqual({ applied: 1, failed: [] });
    expect(rpc).toHaveBeenCalledWith("apply_plan_amounts", {
      p_plan_id: "p1",
      p_changes: [
        { id: "p1-i0", amount: 11000 },
        { id: "p1-i1", amount: 11000 },
      ],
      p_clear_tentative: true,
    });
    expect(logEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ entityType: "student", entityId: "s-p1", eventType: "zam_uygulandi", actorId: "y1" }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/odemeler/zam");
  });

  it("tentative_from null olan plan uygulanmaz", async () => {
    planRows = []; // sorgu tentative_from is not null süzer
    const r = await applyPriceIncrease({ ...req, planIds: ["p1"] });
    expect(r).toEqual({ applied: 0, failed: [] });
    expect(rpc).not.toHaveBeenCalled();
    expect(not).toHaveBeenCalledWith("tentative_from", "is", null);
    expect(eq).toHaveBeenCalledWith("item_type", "aidat");
    expect(eq).toHaveBeenCalledWith("student.status", "aktif");
  });

  it("sunucuya dönen tentative_from null satırı da atlanır", async () => {
    planRows = [plan("p1", "ALİ", [10000], { tentative_from: null })];
    const r = await applyPriceIncrease({ ...req, planIds: ["p1"] });
    expect(r).toEqual({ applied: 0, failed: [] });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("bir planın RPC hatası diğerlerini durdurmaz", async () => {
    planRows = [plan("p1", "ADI", [10000]), plan("p2", "ZEKİ", [10000])];
    rpc.mockResolvedValueOnce({ error: { message: "boom" } }).mockResolvedValueOnce({ error: null });
    const r = await applyPriceIncrease({ ...req, planIds: ["p1", "p2"] });
    expect(r).toEqual({ applied: 1, failed: ["ADI"] });
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("danışman reddedilir", async () => {
    getSessionProfile.mockResolvedValue({ id: "d", role: "danisman" });
    expect(await applyPriceIncrease({ ...req, planIds: ["p1"] })).toEqual({ error: "Bu işlem için yönetici yetkisi gerekir" });
  });
});

describe("finalizeAmounts", () => {
  it("tentative_from null yapar ve olay yazar", async () => {
    planRows = [{ id: "p1", student_id: "s1" }];
    expect(await finalizeAmounts(["p1"])).toEqual({ finalized: 1 });
    expect(logEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ entityId: "s1", eventType: "tutar_kesinlesti" }),
    );
  });

  it("danışman reddedilir", async () => {
    getSessionProfile.mockResolvedValue({ id: "d", role: "danisman" });
    expect(await finalizeAmounts(["p1"])).toEqual({ error: "Bu işlem için yönetici yetkisi gerekir" });
  });
});
