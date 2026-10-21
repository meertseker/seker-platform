import { describe, expect, it } from "vitest";
import { buildCorrectionOps } from "@/lib/payment-correction";

const target = (id: string, dueDate: string, tl: number) => ({ id, dueDate, amountKurus: tl * 100 });

describe("buildCorrectionOps", () => {
  it("tam tutar, yeni yöntem ve gün: tek parça, kalan yok", () => {
    const result = buildCorrectionOps([target("a", "2026-10-05", 15000)], [{ method: "havale", kurus: 1500000, paidOn: "2026-10-12" }]);
    expect(result).toEqual({
      ok: true,
      paidOn: "2026-10-12",
      totalKurus: 1500000,
      remainderKurus: 0,
      ops: [{ id: "a", amount: 15000, parts: [{ amount: 15000, method: "havale" }], remainders: [] }],
    });
  });

  it("kısmi düzeltme: kalan aynı vadeye bekleyen taksit olur", () => {
    const result = buildCorrectionOps([target("a", "2026-11-05", 15000)], [{ method: "nakit", kurus: 1499500, paidOn: "2026-10-20" }]);
    expect(result.ok && result.ops[0].remainders).toEqual([{ dueDate: "2026-11-05", amount: 5 }]);
    expect(result.ok && result.remainderKurus).toBe(500);
  });

  it("iki taksitlik ödeme bir aya iner: ikinci taksite op yazılmaz", () => {
    const result = buildCorrectionOps(
      [target("b", "2026-11-05", 15000), target("a", "2026-10-05", 15000)],
      [{ method: "nakit", kurus: 1500000, paidOn: "2026-10-20" }],
    );
    expect(result.ok && result.ops.map((op) => op.id)).toEqual(["a"]);
  });

  it("farklı günlerde iki yöntem: erken parça kendi gününü taşır, ödeme günü en son gün", () => {
    const result = buildCorrectionOps(
      [target("a", "2026-10-05", 15000)],
      [
        { method: "nakit", kurus: 400000, paidOn: "2026-10-12" },
        { method: "pos", kurus: 1100000, paidOn: "2026-10-14" },
      ],
    );
    expect(result.ok && result.paidOn).toBe("2026-10-14");
    expect(result.ok && result.ops[0].parts).toEqual([
      { amount: 4000, method: "nakit", paidOn: "2026-10-12" },
      { amount: 11000, method: "pos" },
    ]);
  });

  it("tutar ödemenin taksit toplamını aşarsa ne yapılacağını söyler", () => {
    const result = buildCorrectionOps([target("a", "2026-10-05", 14495)], [{ method: "nakit", kurus: 1550000, paidOn: "2026-10-12" }]);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain("14.495,00 ₺");
    expect(!result.ok && result.error).toContain("Ödeme al");
  });

  it("sıfır tutar: geri almaya yönlendirir", () => {
    const result = buildCorrectionOps([target("a", "2026-10-05", 100)], [{ method: "nakit", kurus: 0, paidOn: "2026-10-12" }]);
    expect(!result.ok && result.error).toContain("Geri al");
  });
});
