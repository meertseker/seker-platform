import { describe, it, expect } from "vitest";
import {
  computeIncrease,
  isTentative,
  type IncreaseInstallment,
  type IncreasePlanInput,
} from "@/lib/price-increase";

const TL = 100;

function row(id: string, dueDate: string, tl: number, status: IncreaseInstallment["status"] = "bekliyor"): IncreaseInstallment {
  return { id, dueDate, amountKurus: tl * TL, status };
}

function plan(installments: IncreaseInstallment[], tentativeFrom: string | null = "2027-01-01"): IncreasePlanInput {
  return {
    planId: "p1",
    studentId: "s1",
    fullName: "Test Öğrenci",
    tentativeFrom,
    totalKurus: installments.reduce((s, i) => s + (i.status === "iptal" ? 0 : i.amountKurus), 0),
    installments,
  };
}

const sixMonths = (tl: number) =>
  ["01", "02", "03", "04", "05", "06"].map((m) => row(`i${m}`, `2027-${m}-16`, tl));

describe("isTentative", () => {
  it("bekliyor ve tarih sonra ise true", () => {
    expect(isTentative("2027-01-01", "2027-02-16", "bekliyor")).toBe(true);
  });
  it("odendi ise false", () => {
    expect(isTentative("2027-01-01", "2027-02-16", "odendi")).toBe(false);
  });
  it("tentativeFrom null ise false", () => {
    expect(isTentative(null, "2027-02-16", "bekliyor")).toBe(false);
  });
  it("tarih öncesinde false", () => {
    expect(isTentative("2027-01-01", "2026-12-16", "bekliyor")).toBe(false);
  });
});

describe("computeIncrease", () => {
  it("22.000'lik Ocak–Haziran %25 → her ay 27.500, toplam +33.000", () => {
    const p = plan(sixMonths(22_000));
    const r = computeIncrease(p, 25, "2027-01");
    expect(r.changes).toHaveLength(6);
    expect(r.changes.every((c) => c.toKurus === 2_750_000)).toBe(true);
    expect(r.newTotalKurus).toBe(p.totalKurus + 3_300_000);
    expect(r.monthlyFromKurus).toBe(2_200_000);
    expect(r.monthlyToKurus).toBe(2_750_000);
  });

  it("indirimli 24.300 %25 → 30.400 (100 TL'ye yuvarlar)", () => {
    const r = computeIncrease(plan([row("a", "2027-01-16", 24_300)]), 25, "2027-01");
    expect(r.changes[0].toKurus).toBe(3_040_000);
  });

  it("kişiye özel 19.000 %30 → 24.700", () => {
    const r = computeIncrease(plan([row("a", "2027-01-16", 19_000)]), 30, "2027-01");
    expect(r.changes[0].toKurus).toBe(2_470_000);
  });

  it("bölünmüş ay: 15.000 ödendi + 7.000 bekliyor, %25 → bekleyen 12.500", () => {
    const r = computeIncrease(
      plan([row("paid", "2027-01-05", 15_000, "odendi"), row("pend", "2027-01-20", 7_000)]),
      25,
      "2027-01",
    );
    expect(r.changes).toHaveLength(1);
    expect(r.changes[0].installmentId).toBe("pend");
    expect(r.changes[0].toKurus).toBe(1_250_000);
  });

  it("tamamen ödenmiş Ocak atlanır ve skippedPaidMonths'ta görünür", () => {
    const r = computeIncrease(
      plan([row("o", "2027-01-16", 22_000, "odendi"), row("s", "2027-02-16", 22_000)]),
      25,
      "2027-01",
    );
    expect(r.skippedPaidMonths).toEqual(["2027-01"]);
    expect(r.changes).toHaveLength(1);
    expect(r.changes[0].installmentId).toBe("s");
    expect(r.changes[0].toKurus).toBe(2_750_000);
  });

  it("fromMonth öncesi ve tentativeFrom öncesi aylara dokunmaz", () => {
    const rows = [row("dec", "2026-12-16", 22_000), row("jan", "2027-01-16", 22_000)];
    const a = computeIncrease(plan(rows), 25, "2026-12");
    expect(a.changes.map((c) => c.installmentId)).toEqual(["jan"]);
    const b = computeIncrease(plan(rows), 25, "2027-02");
    expect(b.changes).toEqual([]);
  });

  it("tentativeFrom null ise hiçbir değişiklik yok", () => {
    const p = plan(sixMonths(22_000), null);
    const r = computeIncrease(p, 25, "2027-01");
    expect(r.changes).toEqual([]);
    expect(r.newTotalKurus).toBe(p.totalKurus);
    expect(r.monthlyFromKurus).toBeNull();
    expect(r.monthlyToKurus).toBeNull();
  });

  it("iptal satırları yok sayar", () => {
    const r = computeIncrease(
      plan([row("x", "2027-01-10", 5_000, "iptal"), row("a", "2027-01-16", 22_000)]),
      25,
      "2027-01",
    );
    expect(r.changes).toHaveLength(1);
    expect(r.changes[0].installmentId).toBe("a");
    expect(r.changes[0].toKurus).toBe(2_750_000);
  });

  it("tam .5 sınırında (22.500 %10 → 24.750) 24.800'e yuvarlar", () => {
    const r = computeIncrease(plan([row("a", "2027-01-16", 22_500)]), 10, "2027-01");
    expect(r.changes[0].toKurus).toBe(2_480_000);
  });

  it("monthlyFrom/To değişiklik olan ilk aydan gelir (ödenmiş Ocak atlanır)", () => {
    const r = computeIncrease(
      plan([row("o", "2027-01-16", 20_000, "odendi"), row("s", "2027-02-16", 22_000)]),
      25,
      "2027-01",
    );
    expect(r.monthlyFromKurus).toBe(2_200_000);
    expect(r.monthlyToKurus).toBe(2_750_000);
  });

  it("hiç değişiklik yoksa monthly ilk işlenen aydan gelir", () => {
    const r = computeIncrease(plan([row("o", "2027-01-16", 20_000, "odendi")]), 25, "2027-01");
    expect(r.changes).toEqual([]);
    expect(r.monthlyFromKurus).toBe(2_000_000);
    expect(r.monthlyToKurus).toBe(2_500_000);
  });
});
