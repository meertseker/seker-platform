import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildSettlement } from "@/lib/payment-settlement";

/**
 * takePayment'in `odeme_alindi` olayına ödeme anı durumunu (settled / plans)
 * yazdığını gösterir. Supabase zinciri bellekte taklit edilir.
 */
type Inst = { id: string; plan_id: string; due_date: string; amount: number; status: string };
const plans = [
  { id: "P-kitap", item_type: "kitap", tentative_from: null as string | null },
  { id: "P-aidat", item_type: "aidat", tentative_from: "2027-01-01" as string | null },
];
let installments: Inst[] = [];
let eventPayload: Record<string, unknown> | null = null;
let planQuery: { ids: string[]; filters: [string, unknown][] } | null = null;
let nextId = 0;

function installmentsTable() {
  return {
    select: () => ({
      in: async (_col: string, ids: string[]) => ({
        data: installments
          .filter((i) => ids.includes(i.id))
          .map((i) => ({ ...i, plan: { student_id: "S1" } })),
        error: null,
      }),
    }),
    insert: (rows: (Omit<Inst, "id" | "status"> & { status?: string })[]) => ({
      select: async () => {
        const created = rows.map((row) => {
          nextId += 1;
          const inst: Inst = { ...row, id: `new-${nextId}`, status: row.status ?? "bekliyor" };
          installments.push(inst);
          return { id: inst.id, status: inst.status };
        });
        return { data: created, error: null };
      },
    }),
    update: (patch: Partial<Inst>) => ({
      eq: async (_col: string, id: string) => {
        const inst = installments.find((i) => i.id === id)!;
        Object.assign(inst, patch);
        return { error: null };
      },
    }),
  };
}

function plansTable() {
  return {
    select: () => ({
      in: (_col: string, ids: string[]) => {
        planQuery = { ids, filters: [] };
        const chain = {
          eq: (col: string, value: unknown) => {
            planQuery!.filters.push([col, value]);
            return chain;
          },
          then: (resolve: (v: unknown) => unknown) =>
            resolve({
              data: plans
                .filter((p) => ids.includes(p.id))
                .map((p) => ({
                  ...p,
                  installments: installments
                    .filter((i) => i.plan_id === p.id && i.status === "bekliyor")
                    .map(({ due_date, amount, status }) => ({ due_date, amount, status })),
                })),
              error: null,
            }),
        };
        return chain;
      },
    }),
  };
}

const from = vi.fn((table: string) => {
  if (table === "installments") return installmentsTable();
  if (table === "payment_plans") return plansTable();
  if (table === "events") {
    return {
      insert: (row: { payload: Record<string, unknown> }) => {
        eventPayload = row.payload;
        return { select: () => ({ single: async () => ({ data: { id: "E1" }, error: null }) }) };
      },
    };
  }
  throw new Error(`beklenmeyen tablo ${table}`);
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionProfile: async () => ({ id: "u1", role: "yonetici" }) }));
vi.mock("@/lib/events", () => ({ logEvent: vi.fn(), kickWaFlush: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({ from }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabase: () => null }));

import { takePayment } from "@/actions/payments";

beforeEach(() => {
  eventPayload = null;
  planQuery = null;
  nextId = 0;
  installments = [
    { id: "K1", plan_id: "P-kitap", due_date: "2026-10-05", amount: 3000, status: "bekliyor" },
    { id: "K2", plan_id: "P-kitap", due_date: "2026-11-05", amount: 3000, status: "bekliyor" },
    { id: "A1", plan_id: "P-aidat", due_date: "2026-10-05", amount: 15495, status: "bekliyor" },
    { id: "A2", plan_id: "P-aidat", due_date: "2026-11-05", amount: 15495, status: "bekliyor" },
    { id: "A3", plan_id: "P-aidat", due_date: "2027-01-05", amount: 15495, status: "bekliyor" },
  ];
});

describe("takePayment → odeme_alindi durumu", () => {
  it("tam ödeme: taksit tamamlandı, planlarda ödeme sonrası kalan", async () => {
    const result = await takePayment({
      studentId: "S1",
      installmentIds: ["K1", "A1"],
      payments: [{ method: "nakit", amountTl: 18495 }],
      paidOn: "2026-10-21",
    });
    expect(result).toMatchObject({ eventId: "E1" });
    expect(planQuery).toEqual({ ids: ["P-kitap", "P-aidat"], filters: [["installments.status", "bekliyor"]] });
    expect(eventPayload?.settled).toEqual([
      { installmentId: "A1", itemType: "aidat", dueDate: "2026-10-05", amountTl: 15495, paidTl: 15495, complete: true, remainderTl: 0, remainderCount: 0, remainderDueDate: null },
      { installmentId: "K1", itemType: "kitap", dueDate: "2026-10-05", amountTl: 3000, paidTl: 3000, complete: true, remainderTl: 0, remainderCount: 0, remainderDueDate: null },
    ]);
    expect(eventPayload?.plans).toEqual([
      { planId: "P-aidat", itemType: "aidat", pendingCount: 2, pendingTl: 30990, tentativePending: true, closed: false },
      { planId: "P-kitap", itemType: "kitap", pendingCount: 1, pendingTl: 3000, tentativePending: false, closed: false },
    ]);
    // Mevcut alanlar yerinde.
    expect(eventPayload).toMatchObject({ totalTl: 18495, methods: ["nakit"], paidIds: expect.arrayContaining(["K1", "A1"]) });
  });

  it("kısmi ödeme: kalan yeni taksitlere bölünür, plan bunları sayar", async () => {
    await takePayment({
      studentId: "S1",
      installmentIds: ["K2"],
      payments: [{ method: "pos", amountTl: 2100 }],
      paidOn: "2026-10-21",
      remainder: { count: 3, firstDueDate: "2026-12-05" },
    });
    expect(eventPayload?.settled).toEqual([
      { installmentId: "K2", itemType: "kitap", dueDate: "2026-11-05", amountTl: 3000, paidTl: 2100, complete: false, remainderTl: 900, remainderCount: 3, remainderDueDate: "2026-12-05" },
    ]);
    expect(eventPayload?.plans).toEqual([
      { planId: "P-kitap", itemType: "kitap", pendingCount: 4, pendingTl: 3900, tentativePending: false, closed: false },
    ]);
  });

  it("son taksit ödenince plan kapanır", async () => {
    installments = installments.filter((i) => i.id !== "K2");
    await takePayment({
      studentId: "S1",
      installmentIds: ["K1"],
      payments: [{ method: "nakit", amountTl: 3000 }],
      paidOn: "2026-10-21",
    });
    expect(eventPayload?.plans).toEqual([
      { planId: "P-kitap", itemType: "kitap", pendingCount: 0, pendingTl: 0, tentativePending: false, closed: true },
    ]);
  });
});

describe("buildSettlement", () => {
  it("kalan aynı vadede tek taksit kalır (taksitlendirme yoksa)", () => {
    const { settled } = buildSettlement({
      allocations: [{ installmentId: "K1", dueDate: "2026-10-05", originalKurus: 300000, parts: [{ method: "nakit", kurus: 299500 }], remainderKurus: 500 }],
      planOf: new Map([["K1", "P"]]),
      remainder: null,
      plans: [{ id: "P", item_type: "kitap", tentative_from: null, installments: [{ due_date: "2026-10-05", amount: "5.00", status: "bekliyor" }] }],
    });
    expect(settled[0]).toMatchObject({ paidTl: 2995, complete: false, remainderTl: 5, remainderCount: 1, remainderDueDate: "2026-10-05" });
  });
});
