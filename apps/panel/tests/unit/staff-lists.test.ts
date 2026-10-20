import { describe, expect, it, vi } from "vitest";

// Öğretmenler personel listelerinde (danışman dağılımı) görünmez.
const calls: { table: string; filters: unknown[][] }[] = [];
function builder(table: string) {
  const c = { table, filters: [] as unknown[][] };
  calls.push(c);
  const b: Record<string, unknown> = {};
  for (const f of ["select", "eq", "in", "not", "order"]) b[f] = (...a: unknown[]) => (c.filters.push([f, ...a]), b);
  b.then = (res: (v: unknown) => unknown) =>
    Promise.resolve({
      data: table === "profiles" ? [{ id: "d1", full_name: "Zehra Hanım" }] : [{ assigned_to: "d1", status: "kazanildi" }],
      error: null,
    }).then(res);
  return b;
}
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({ from: builder }) }));

import { getConsultantBreakdown } from "@/lib/queries/dashboard";

describe("getConsultantBreakdown", () => {
  it("yalnız yönetici ve danışmanları listeler", async () => {
    const rows = await getConsultantBreakdown();
    expect(rows).toEqual([{ consultantId: "d1", consultantName: "Zehra Hanım", leads: 1, won: 1 }]);
    const profiles = calls.find((c) => c.table === "profiles")!;
    expect(profiles.filters).toContainEqual(["in", "role", ["yonetici", "danisman"]]);
  });
});
