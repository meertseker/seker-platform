import { describe, it, expect } from "vitest";
import { generateInstallments, remainderInstallment } from "@/lib/installments";

describe("generateInstallments", () => {
  it("eşit böler, kuruş farkını SON taksite ekler", () => {
    // 100.000,00 TL / 3 taksit = 33.333,33 + 33.333,33 + 33.333,34
    const r = generateInstallments(10000000, 3, "2026-09-05");
    expect(r.map((x) => x.amountKurus)).toEqual([3333333, 3333333, 3333334]);
    expect(r.reduce((s, x) => s + x.amountKurus, 0)).toBe(10000000);
  });
  it("vadeleri aylık artırır, günü korur", () => {
    const r = generateInstallments(3000000, 3, "2026-09-05");
    expect(r.map((x) => x.dueDate)).toEqual(["2026-09-05", "2026-10-05", "2026-11-05"]);
  });
  it("ay sonu taşmasını kırpar (31 Oca -> 28 Şub)", () => {
    const r = generateInstallments(2000000, 2, "2027-01-31");
    expect(r.map((x) => x.dueDate)).toEqual(["2027-01-31", "2027-02-28"]);
  });
  it("tek taksit", () => {
    expect(generateInstallments(500000, 1, "2026-09-01")).toEqual([
      { dueDate: "2026-09-01", amountKurus: 500000 },
    ]);
  });
});

describe("remainderInstallment", () => {
  it("kalan tutar için orijinal vadeyi devralan taksit üretir (spec §6.3)", () => {
    expect(remainderInstallment({ dueDate: "2026-09-05", amountKurus: 1800000 }, 1000000))
      .toEqual({ dueDate: "2026-09-05", amountKurus: 800000 });
  });
  it("tam ödemede hata fırlatır", () => {
    expect(() => remainderInstallment({ dueDate: "2026-09-05", amountKurus: 100 }, 100)).toThrow();
  });
});
