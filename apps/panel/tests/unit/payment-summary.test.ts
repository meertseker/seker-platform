import { describe, it, expect, vi } from "vitest";

type Row = Record<string, unknown>;

const rows: Row[] = [
  { amount: "1000.00", paid_amount: null, status: "bekliyor", due_date: "2026-10-10", paid_at: null },
  { amount: "500.00", paid_amount: null, status: "iptal", due_date: "2026-10-12", paid_at: null },
];

function builder() {
  const filters: ((r: Row) => boolean)[] = [];
  const b: Record<string, unknown> = {};
  const add = (fn: (col: string, v: unknown) => (r: Row) => boolean) => (col: string, v: unknown) => {
    filters.push(fn(col, v));
    return b;
  };
  b.select = () => b;
  b.order = () => b;
  b.range = () => b;
  b.eq = add((c, v) => (r) => r[c] === v);
  b.neq = add((c, v) => (r) => r[c] !== v);
  b.gte = add((c, v) => (r) => String(r[c]) >= String(v));
  b.lt = add((c, v) => (r) => r[c] != null && String(r[c]) < String(v));
  b.then = (resolve: (v: unknown) => void) => resolve({ data: rows.filter((r) => filters.every((f) => f(r))) });
  return b;
}

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ from: () => builder() }),
}));

import { getPaymentSummary } from "@/lib/queries/dashboard";

describe("getPaymentSummary", () => {
  it("iptal taksitler aylık vadesi gelen tutara katılmaz", async () => {
    const s = await getPaymentSummary("2026-10-01");
    expect(s.dueThisMonthKurus).toBe(100000);
  });
});
