import { describe, it, expect } from "vitest";
import { buildImportPlan } from "../../scripts/seed/lib/aidat-upload";

const base = {
  source_row: "2", full_name: "ÖRNEK ÇOCUK", parent_name: "ANNE & BABA",
  phone: "+905551112233", program: "tam_gun", season: "2026-2027",
  aidat_monthly: "25000", servis_monthly: "", kitap_amount: "45000",
  phone_confidence: "high", phone_source: "x", program_note: "", note: "",
};

describe("buildImportPlan", () => {
  it("builds a student + aidat plan (10 installments summing to total) + kitap plan", () => {
    const { units, skipped } = buildImportPlan([{ ...base }]);
    expect(skipped).toHaveLength(0);
    expect(units).toHaveLength(1);
    const u = units[0];
    expect(u.student).toMatchObject({ full_name: "ÖRNEK ÇOCUK", phone: "+905551112233", program: "tam_gun", season: "2026-2027" });
    const aidat = u.plans.find((p) => p.item_type === "aidat")!;
    expect(aidat.installment_count).toBe(10);
    expect(aidat.installments).toHaveLength(10);
    expect(aidat.total_amount).toBe(250000);
    const sum = aidat.installments.reduce((a, i) => a + i.amount, 0);
    expect(sum).toBeCloseTo(250000, 2);
    expect(aidat.installments[0]).toMatchObject({ due_date: "2026-09-05", status: "bekliyor" });
    expect(u.plans.some((p) => p.item_type === "diger" && p.total_amount === 45000)).toBe(true);
  });

  it("skips rows with invalid phone, bad program, blank parent, or blank season", () => {
    const rows = [
      { ...base, phone: "not-a-phone" },
      { ...base, program: "xxx" },
      { ...base, parent_name: "" },
      { ...base, season: "" },
    ];
    const { units, skipped } = buildImportPlan(rows);
    expect(units).toHaveLength(0);
    expect(skipped).toHaveLength(4);
    expect(skipped.map((s) => s.reason).join("|")).toMatch(/telefon|program|parent|season/i);
  });

  it("emits a student with no plans when no fee amounts are present", () => {
    const { units } = buildImportPlan([{ ...base, aidat_monthly: "", kitap_amount: "", servis_monthly: "" }]);
    expect(units[0].plans).toHaveLength(0);
  });
});
