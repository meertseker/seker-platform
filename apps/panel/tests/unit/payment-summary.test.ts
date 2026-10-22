import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;

const T = (local: string) => new Date(`${local}+03:00`).toISOString();
const plan = (season: string) => ({ payment_plans: { season } });

const tables: Record<string, Row[]> = {
  price_lists: [],
  installments: [
    { amount: "1000.00", paid_amount: null, status: "bekliyor", due_date: "2026-10-10", paid_at: null, ...plan("2026-2027") },
    { amount: "500.00", paid_amount: null, status: "iptal", due_date: "2026-10-12", paid_at: null, ...plan("2026-2027") },
    { amount: "300.00", paid_amount: "300.00", status: "odendi", due_date: "2026-10-05", paid_at: T("2026-10-04T10:00:00"), ...plan("2026-2027") },
    // Geçen sezondan: bu ay vadesi ötelenmiş ve bu ay ödenmiş taksit.
    { amount: "800.00", paid_amount: null, status: "bekliyor", due_date: "2026-10-15", paid_at: null, ...plan("2025-2026") },
    { amount: "2000.00", paid_amount: "2000.00", status: "odendi", due_date: "2026-06-05", paid_at: T("2026-10-06T10:00:00"), ...plan("2025-2026") },
  ],
  v_overdue_installments: [],
};

/** "payment_plans.season" gibi gömülü yolu okur. */
function valueAt(row: Row, col: string): unknown {
  return col.split(".").reduce<unknown>((v, key) => (v && typeof v === "object" ? (v as Row)[key] : undefined), row);
}

function builder(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  const b: Record<string, unknown> = {};
  const add = (fn: (v: unknown, arg: unknown) => boolean) => (col: string, arg: unknown) => {
    filters.push((r) => fn(valueAt(r, col), arg));
    return b;
  };
  const result = () => ({ data: (tables[table] ?? []).filter((r) => filters.every((f) => f(r))), error: null });
  b.select = () => b;
  b.order = () => b;
  b.range = () => b;
  b.eq = add((v, a) => v === a);
  b.neq = add((v, a) => v !== a);
  b.gte = add((v, a) => v != null && String(v) >= String(a));
  b.lt = add((v, a) => v != null && String(v) < String(a));
  b.maybeSingle = async () => ({ data: result().data[0] ?? null, error: null });
  b.then = (resolve: (v: unknown) => void) => resolve(result());
  return b;
}

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ from: (table: string) => builder(table) }),
}));

import { getPaymentSummary } from "@/lib/queries/dashboard";

describe("getPaymentSummary", () => {
  beforeEach(() => {
    tables.price_lists = [{ season: "2026-2027", is_active: true }, { season: "2025-2026", is_active: false }];
  });

  it("iptal taksitler aylık vadesi gelen tutara katılmaz", async () => {
    const s = await getPaymentSummary("2026-10-01");
    expect(s.dueThisMonthKurus).toBe(130000);
  });

  it("vadesi gelen ve tahsil edilen yalnız aktif sezonun planlarından", async () => {
    const s = await getPaymentSummary("2026-10-01");
    expect(s.dueThisMonthKurus).toBe(130000); // geçen sezonun 800 TL'si yok
    expect(s.paidThisMonthKurus).toBe(30000); // geçen sezonun 2000 TL'si yok
  });

  it("aktif sezon yoksa bütün sezonlar sayılır", async () => {
    tables.price_lists = [];
    const s = await getPaymentSummary("2026-10-01");
    expect(s.dueThisMonthKurus).toBe(210000);
    expect(s.paidThisMonthKurus).toBe(230000);
  });
});
