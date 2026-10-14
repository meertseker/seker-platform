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
    expect(u.plans.some((p) => p.item_type === "kitap" && p.total_amount === 45000)).toBe(true);
  });

  it("loads rows with missing phone/program/parent as nulls, flagged (does not skip)", () => {
    const rows = [
      { ...base, phone: "not-a-phone" },
      { ...base, program: "xxx" },
      { ...base, parent_name: "" },
    ];
    const { units, skipped } = buildImportPlan(rows);
    expect(skipped).toHaveLength(0);
    expect(units).toHaveLength(3);
    expect(units[0].student.phone).toBeNull();
    expect(units[0].flags).toContain("telefon eksik");
    expect(units[1].student.program).toBeNull();
    expect(units[1].flags).toContain("program eksik");
    expect(units[2].student.parent_name).toBeNull();
    expect(units[2].flags).toContain("veli adı eksik");
  });

  it("skips only rows with no student name", () => {
    const { units, skipped } = buildImportPlan([{ ...base, full_name: "" }]);
    expect(units).toHaveLength(0);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toMatch(/full_name/);
  });

  it("emits a student with no plans when no fee amounts are present", () => {
    const { units } = buildImportPlan([{ ...base, aidat_monthly: "", kitap_amount: "", servis_monthly: "" }]);
    expect(units[0].plans).toHaveLength(0);
  });
});
