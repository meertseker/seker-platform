import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildEnrollmentPlans } from "@/lib/enrollment-plan";
import { initialMonthlyFromQuery, offerPlanQuery } from "@/lib/offer-plan";
import { parseRevertPreview, revertConfirmText } from "@/lib/payment-revert";
import { plansAfterPayment } from "@/lib/payment-settlement";
import { tlToKurus } from "@/lib/money";

/**
 * Ödeme denetimi Faz 0: taksit düzenleme kuralları, tek geri alma yolu,
 * teklif → plan aylık tutarı. Veritabanı davranışı tests/rls/odeme-korumalari.test.ts'te.
 */
type Inst = { id: string; plan_id: string; amount: number; due_date: string; status: string };
let installment: Inst;
let siblings: { id: string; amount: number }[];
let updates: { patch: Record<string, unknown>; filters: [string, unknown][] }[];
let rpcCalls: { name: string; args: Record<string, unknown> }[];
let rpcResult: { data: unknown; error: unknown };
const logEvent = vi.fn();

function installmentsTable() {
  return {
    select: (cols: string) => ({
      eq: (_col: string, value: string) =>
        cols.includes("plan:payment_plans")
          ? { maybeSingle: async () => ({ data: { ...installment, plan: { total_amount: 30000 } }, error: null }) }
          : Promise.resolve({ data: siblings.filter(() => value === installment.plan_id), error: null }),
    }),
    update: (patch: Record<string, unknown>) => {
      const entry = { patch, filters: [] as [string, unknown][] };
      updates.push(entry);
      const chain = {
        eq: (col: string, value: unknown) => {
          entry.filters.push([col, value]);
          return chain;
        },
        select: async () => ({ data: [{ id: installment.id }], error: null }),
      };
      return chain;
    },
  };
}

const from = vi.fn((table: string) => {
  if (table === "installments") return installmentsTable();
  if (table === "payment_plans") {
    return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { student_id: "S1" } }) }) }) };
  }
  throw new Error(`beklenmeyen tablo ${table}`);
});
const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
  rpcCalls.push({ name, args });
  return rpcResult;
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionProfile: async () => ({ id: "u1", role: "yonetici" }) }));
vi.mock("@/lib/events", () => ({ logEvent: (...args: unknown[]) => logEvent(...args), kickWaFlush: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({ from, rpc }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabase: () => null }));

import * as payments from "@/actions/payments";

beforeEach(() => {
  installment = { id: "I1", plan_id: "P1", amount: 15000, due_date: "2026-10-05", status: "odendi" };
  siblings = [{ id: "I1", amount: 15000 }, { id: "I2", amount: 15000 }];
  updates = [];
  rpcCalls = [];
  rpcResult = { data: { studentId: "S1" }, error: null };
  logEvent.mockClear();
});

describe("updateInstallment", () => {
  it("ödenmiş satırın tutarı değiştirilemez", async () => {
    const result = await payments.updateInstallment("I1", { amountTl: 14495, dueDate: "2026-10-05" });
    expect(result.error).toContain("Ödenmiş taksitin tutarı değiştirilemez");
    expect(updates).toHaveLength(0);
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("ödenmiş satırda vade değişebilir; tutar aynı gönderilirse sorun değil", async () => {
    const result = await payments.updateInstallment("I1", { amountTl: 15000, dueDate: "2026-10-10" });
    expect(result).toEqual({});
    expect(updates).toEqual([{ patch: { due_date: "2026-10-10" }, filters: [["id", "I1"], ["status", "odendi"]] }]);
    expect(logEvent).toHaveBeenCalledTimes(1);
  });

  it("değişiklik yoksa olay yazılmaz (WhatsApp'a boş 'güncellendi' gitmez)", async () => {
    installment.status = "bekliyor";
    const result = await payments.updateInstallment("I1", { amountTl: 15000, dueDate: "2026-10-05" });
    expect(result).toEqual({});
    expect(updates).toHaveLength(0);
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("bekleyen satırın tutarı plan toplamı tutarsa değişir", async () => {
    installment.status = "bekliyor";
    siblings = [{ id: "I1", amount: 15000 }];
    const result = await payments.updateInstallment("I1", { amountTl: 30000 });
    expect(result).toEqual({});
    expect(updates[0]).toEqual({ patch: { amount: 30000 }, filters: [["id", "I1"], ["status", "bekliyor"]] });
  });
});

describe("tek geri alma yolu", () => {
  it("markInstallmentPaid dışa açık değil", () => {
    expect("markInstallmentPaid" in payments).toBe(false);
  });

  it("revertInstallment revert_installment_payment RPC'sine gider, RPC mesajını gösterir", async () => {
    rpcResult = {
      data: null,
      error: { code: "P0001", message: "Bu ödemeden sonra başka işlem yapılmış (kalan taksit ödendi). Önce sonraki işlemi geri alın." },
    };
    const result = await payments.revertInstallment("I1");
    expect(rpcCalls).toEqual([{ name: "revert_installment_payment", args: { p_installment_id: "I1" } }]);
    expect(result.error).toContain("kalan taksit ödendi");
  });

  it("undoPayment undo_payment RPC'sine gider; hata yutulmaz", async () => {
    rpcResult = { data: null, error: { code: "42501", message: "Bu ödemeyi yalnız yönetici geri alabilir" } };
    expect(await payments.undoPayment("E1")).toEqual({ error: "Bu ödemeyi yalnız yönetici geri alabilir" });
    expect(rpcCalls[0]).toEqual({ name: "undo_payment", args: { p_event_id: "E1" } });
  });

  it("onay metni ödemenin tamamını ve taksit sayısını söyler", async () => {
    rpcResult = {
      data: { kind: "odeme", eventId: "E1", totalTl: 14495, installmentCount: 2, createdCount: 0, allowed: true, blocker: null },
      error: null,
    };
    const result = await payments.previewInstallmentRevert("I1");
    expect("text" in result && result.text).toBe("Bu işlem 14.495 ₺'lik ödemenin tamamını geri alır (2 taksit).");
  });
});

describe("revertConfirmText", () => {
  const base = { kind: "odeme" as const, totalTl: 10000, installmentCount: 1, createdCount: 1, allowed: true, blocker: null };
  it("kalan varsa silineceğini söyler", () => {
    expect(revertConfirmText(base)).toBe(
      "Bu işlem 10.000 ₺'lik ödemenin tamamını geri alır (1 taksit). Ödemeyle açılan kalan taksitler silinir.",
    );
  });
  it("engel varsa nedeni ve yolu söyler", () => {
    expect(revertConfirmText({ ...base, blocker: "kalan taksit ödendi" })).toContain(
      "başka işlem yapılmış (kalan taksit ödendi). Önce sonraki işlemi geri alın.",
    );
  });
  it("içe aktarılan satır", () => {
    expect(revertConfirmText({ ...base, kind: "ice_aktarma", totalTl: 3000.5, createdCount: 0 })).toContain("3.000,50 ₺");
  });
  it("RPC cevabını okur", () => {
    expect(parseRevertPreview({ kind: "ice_aktarma", totalTl: "3000.00", installmentCount: 1, allowed: true, blocker: null }))
      .toMatchObject({ kind: "ice_aktarma", totalTl: 3000, blocker: null });
    expect(parseRevertPreview({ kind: "x" })).toBeNull();
  });
});

describe("rescheduleInstallments", () => {
  it("yeni taksitleri tek RPC ile yazar, toplam korunur", async () => {
    installment.status = "bekliyor";
    const fromRows = vi.fn(() => ({
      select: () => ({
        in: async () => ({
          data: [
            { id: "R1", plan_id: "P1", amount: 4495, status: "bekliyor" },
          ],
        }),
      }),
    }));
    from.mockImplementationOnce(fromRows as never);
    rpcResult = { data: { studentId: "S1", createdIds: ["N1", "N2"] }, error: null };
    const result = await payments.rescheduleInstallments(["R1"], 2, "2026-11-05");
    expect(result).toEqual({});
    expect(rpcCalls[0]).toEqual({
      name: "reschedule_installments",
      args: { p_ids: ["R1"], p_drafts: [{ dueDate: "2026-11-05", amount: 2247.5 }, { dueDate: "2026-12-05", amount: 2247.5 }] },
    });
  });
});

describe("plansAfterPayment", () => {
  it("ödenen taksit çıkar, kalan eklenir", () => {
    const plans = plansAfterPayment(
      [{ id: "P", item_type: "kitap", tentative_from: null, installments: [
        { id: "K1", due_date: "2026-10-05", amount: 3000, status: "bekliyor" },
        { id: "K2", due_date: "2026-11-05", amount: 3000, status: "bekliyor" },
      ] }],
      [{ id: "K1", planId: "P", amount: 3000, parts: [{ amount: 2000, method: "nakit" }], remainders: [{ dueDate: "2026-10-05", amount: 1000 }] }],
    );
    expect(plans[0].installments).toEqual([
      { due_date: "2026-11-05", amount: 3000, status: "bekliyor" },
      { due_date: "2026-10-05", amount: 1000, status: "bekliyor" },
    ]);
  });
});

describe("teklif → plan (Y3)", () => {
  it("13.000 aylık × 10 taksit teklif → plan aylık 13.000", () => {
    const query = offerPlanQuery({ sourceOfferId: "O1", monthlyTl: 13000, installmentCount: 10 });
    const monthly = initialMonthlyFromQuery({ monthly: query.get("monthly") ?? undefined });
    expect(monthly).toBe(13000);

    const built = buildEnrollmentPlans({
      aidatMode: "aylik",
      monthlyKurus: tlToKurus(monthly!),
      firstMonthKurus: null,
      firstDueDate: "2026-09-05",
      lastMonth: "2027-06",
      kitapKurus: null,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const aidat = built.plans.find((plan) => plan.itemType === "aidat")!;
    expect(aidat.installmentCount).toBe(10);
    expect(aidat.installments.every((item) => item.amountKurus === 1300000)).toBe(true);
    expect(aidat.totalKurus).toBe(13000000);
  });

  it("eski bağlantıdaki `total` da aylık okunur (bölünmez)", () => {
    expect(initialMonthlyFromQuery({ total: "13000" })).toBe(13000);
    expect(initialMonthlyFromQuery({})).toBeUndefined();
  });
});
