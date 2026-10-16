import { describe, it, expect } from "vitest";
import { buildEnrollmentPlans, seasonLastMonth } from "@/lib/enrollment-plan";

describe("seasonLastMonth", () => {
  it("sezonun Haziran'ını verir", () => {
    expect(seasonLastMonth("2026-2027")).toBe("2027-06");
    expect(seasonLastMonth("bozuk")).toBeNull();
  });
});

describe("buildEnrollmentPlans", () => {
  it("aylık aidat ilk vadeden Haziran'a kadar sürer; ilk ay farklı olabilir", () => {
    const result = buildEnrollmentPlans({
      aidatMode: "aylik",
      monthlyKurus: 2600000,
      firstMonthKurus: 1300000,
      firstDueDate: "2026-09-05",
      lastMonth: "2027-06",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [aidat] = result.plans;
    expect(aidat.installmentCount).toBe(10);
    expect(aidat.installments[0]).toEqual({ dueDate: "2026-09-05", amountKurus: 1300000 });
    expect(aidat.installments[9]).toEqual({ dueDate: "2027-06-05", amountKurus: 2600000 });
    expect(aidat.totalKurus).toBe(1300000 + 9 * 2600000);
  });

  it("Ekim'de başlayan 9 ay öder", () => {
    const result = buildEnrollmentPlans({ aidatMode: "aylik", monthlyKurus: 2500000, firstDueDate: "2026-10-05", lastMonth: "2027-06" });
    expect(result.ok && result.plans[0].installmentCount).toBe(9);
  });

  it("peşin aidat tek taksit olur (Aidat Tutarı sütunu)", () => {
    const result = buildEnrollmentPlans({ aidatMode: "pesin", annualKurus: 25000000, firstDueDate: "2026-09-05", lastMonth: "2027-06" });
    expect(result.ok && result.plans[0]).toEqual({
      itemType: "aidat",
      totalKurus: 25000000,
      installmentCount: 1,
      installments: [{ dueDate: "2026-09-05", amountKurus: 25000000 }],
    });
  });

  it("kitap ücreti taksitlere bölünür", () => {
    const result = buildEnrollmentPlans({
      aidatMode: "aylik",
      monthlyKurus: 2500000,
      firstDueDate: "2026-09-05",
      lastMonth: "2027-06",
      kitapKurus: 5000000,
      kitapCount: 2,
    });
    expect(result.ok && result.plans[1].installments).toEqual([
      { dueDate: "2026-09-05", amountKurus: 2500000 },
      { dueDate: "2026-10-05", amountKurus: 2500000 },
    ]);
  });

  it("eksik ya da hatalı girdiyi reddeder", () => {
    expect(buildEnrollmentPlans({ aidatMode: "aylik", firstDueDate: "2026-09-05", lastMonth: "2027-06" }).ok).toBe(false);
    expect(buildEnrollmentPlans({ aidatMode: "aylik", monthlyKurus: 100, firstDueDate: "2027-07-05", lastMonth: "2027-06" }).ok).toBe(false);
    expect(buildEnrollmentPlans({ aidatMode: "pesin", firstDueDate: "2026-09-05", lastMonth: "2027-06" }).ok).toBe(false);
    expect(
      buildEnrollmentPlans({ aidatMode: "pesin", annualKurus: 100, firstDueDate: "2026-09-05", lastMonth: "2027-06", kitapKurus: 100, kitapCount: 5 }).ok,
    ).toBe(false);
  });
});
