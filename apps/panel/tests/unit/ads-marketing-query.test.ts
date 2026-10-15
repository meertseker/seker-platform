import { describe, it, expect, vi } from "vitest";

type Result = { data: unknown[] | null; error: { message: string } | null };
const tables: Record<string, (from: number, to: number) => Result> = {};
const ranges: Record<string, Array<[number, number]>> = {};

function builder(table: string) {
  let range: [number, number] = [0, 0];
  const b: Record<string, unknown> = {};
  for (const m of ["select", "gte", "lt", "lte", "order", "limit"]) b[m] = () => b;
  b.range = (f: number, t: number) => {
    range = [f, t];
    (ranges[table] ??= []).push(range);
    return b;
  };
  b.then = (resolve: (r: Result) => unknown) => resolve(tables[table](range[0], range[1]));
  return b;
}
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({ from: (t: string) => builder(t) }) }));

import { getMarketingData } from "@/lib/queries/marketing";

function pagedRows(total: number, make: (i: number) => unknown) {
  return (from: number, to: number): Result => ({
    data: Array.from({ length: Math.max(0, Math.min(to, total - 1) - from + 1) }, (_, k) => make(from + k)),
    error: null,
  });
}
const empty = (): Result => ({ data: [], error: null });

describe("getMarketingData", () => {
  it("1000 satırdan fazla harcama ve adayı sayfalayarak hepsini toplar", async () => {
    tables.ad_spend_daily = pagedRows(2500, () => ({ campaign_id: "1", campaign_name: "A", cost_micros: 10_000 }));
    tables.leads = pagedRows(1200, (i) => ({
      id: `l${i}`, source: "reklam", gclid: "g", utm_campaign: "1", status: "yeni", converted_student_id: null,
      appointments: i === 0 ? [{ id: "a" }] : [],
    }));
    tables.conversion_uploads = empty;
    ranges.ad_spend_daily = [];
    const { report } = await getMarketingData("2026-01-01", "2026-12-31");
    expect(report.total.spendKurus).toBe(2500);
    expect(report.total.leads).toBe(1200);
    expect(report.total.randevu).toBe(1);
    expect(ranges.ad_spend_daily).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("aday sorgusu hatasında fırlatır", async () => {
    tables.ad_spend_daily = empty;
    tables.leads = () => ({ data: null, error: { message: "leads boom" } });
    tables.conversion_uploads = empty;
    await expect(getMarketingData("2026-01-01", "2026-01-02")).rejects.toThrow("leads boom");
  });

  it("yükleme sorgusu hatasını yutmaz", async () => {
    tables.ad_spend_daily = empty;
    tables.leads = empty;
    tables.conversion_uploads = () => ({ data: null, error: { message: "uploads boom" } });
    await expect(getMarketingData("2026-01-01", "2026-01-02")).rejects.toThrow("uploads boom");
  });
});
