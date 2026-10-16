import { describe, it, expect } from "vitest";
import { allocatePayment } from "@/lib/payment-allocation";

const ekim = { id: "ekim", dueDate: "2026-10-05", amountKurus: 2500000 };
const kasim = { id: "kasim", dueDate: "2026-11-05", amountKurus: 2500000 };

describe("allocatePayment", () => {
  it("tek taksit, tek yöntem, tam ödeme", () => {
    const result = allocatePayment([ekim], [{ method: "nakit", kurus: 2500000 }]);
    expect(result).toEqual({
      ok: true,
      totalKurus: 2500000,
      allocations: [
        { installmentId: "ekim", dueDate: "2026-10-05", originalKurus: 2500000, parts: [{ method: "nakit", kurus: 2500000 }], remainderKurus: 0 },
      ],
    });
  });

  it("15.000 kart + kalan nakit tek taksitte iki parça olur", () => {
    const result = allocatePayment(
      [ekim],
      [
        { method: "pos", kurus: 1500000 },
        { method: "nakit", kurus: 1000000 },
      ],
    );
    expect(result.ok && result.allocations[0].parts).toEqual([
      { method: "pos", kurus: 1500000 },
      { method: "nakit", kurus: 1000000 },
    ]);
    expect(result.ok && result.allocations[0].remainderKurus).toBe(0);
  });

  it("iki ay birden: tutar vade sırasıyla dağılır", () => {
    const result = allocatePayment([kasim, ekim], [{ method: "pos", kurus: 5000000 }]);
    expect(result.ok && result.allocations.map((a) => [a.installmentId, a.parts[0].kurus])).toEqual([
      ["ekim", 2500000],
      ["kasim", 2500000],
    ]);
  });

  it("eksik ödemede son taksitte kalan bekler", () => {
    const result = allocatePayment([ekim, kasim], [{ method: "nakit", kurus: 3000000 }]);
    expect(result.ok && result.allocations).toEqual([
      { installmentId: "ekim", dueDate: "2026-10-05", originalKurus: 2500000, parts: [{ method: "nakit", kurus: 2500000 }], remainderKurus: 0 },
      { installmentId: "kasim", dueDate: "2026-11-05", originalKurus: 2500000, parts: [{ method: "nakit", kurus: 500000 }], remainderKurus: 2000000 },
    ]);
  });

  it("hiç ödeme düşmeyen taksite dokunmaz", () => {
    const result = allocatePayment([ekim, kasim], [{ method: "nakit", kurus: 1000000 }]);
    expect(result.ok && result.allocations.map((a) => a.installmentId)).toEqual(["ekim"]);
    expect(result.ok && result.allocations[0].remainderKurus).toBe(1500000);
  });

  it("iki yöntem iki aya taşar: parça taksit sınırında bölünür", () => {
    const result = allocatePayment(
      [ekim, kasim],
      [
        { method: "pos", kurus: 3000000 },
        { method: "nakit", kurus: 2000000 },
      ],
    );
    expect(result.ok && result.allocations.map((a) => a.parts)).toEqual([
      [{ method: "pos", kurus: 2500000 }],
      [
        { method: "pos", kurus: 500000 },
        { method: "nakit", kurus: 2000000 },
      ],
    ]);
  });

  it("aynı yöntem art arda gelirse tek parçada birleşir", () => {
    const result = allocatePayment(
      [ekim],
      [
        { method: "nakit", kurus: 1000000 },
        { method: "nakit", kurus: 500000 },
      ],
    );
    expect(result.ok && result.allocations[0].parts).toEqual([{ method: "nakit", kurus: 1500000 }]);
  });

  it("fazla ödemeyi reddeder", () => {
    expect(allocatePayment([ekim], [{ method: "nakit", kurus: 2600000 }]).ok).toBe(false);
  });

  it("boş seçim ve sıfır tutarı reddeder", () => {
    expect(allocatePayment([], [{ method: "nakit", kurus: 100 }]).ok).toBe(false);
    expect(allocatePayment([ekim], [{ method: "nakit", kurus: 0 }]).ok).toBe(false);
  });
});
