import { describe, expect, it } from "vitest";
import { buildPaymentHistory, type HistoryInstallmentInput } from "@/lib/payment-history";

function row(over: Partial<HistoryInstallmentInput> & { id: string }): HistoryInstallmentInput {
  return {
    itemType: "aidat",
    dueDate: "2026-10-05",
    amount: 15000,
    status: "odendi",
    paidAmount: 15000,
    paidAt: "2026-10-12T09:00:00Z",
    method: "nakit",
    markedByName: "Zehra",
    ...over,
  };
}

describe("buildPaymentHistory", () => {
  it("olaylı ödeme satırları tek kayıtta toplanır: tarih, tutar, yöntem, kalemler, kim, not", () => {
    const history = buildPaymentHistory(
      [
        row({ id: "a", dueDate: "2026-10-05", paidAt: "2026-10-12T09:00:00Z", method: "nakit", paidAmount: 4000, amount: 4000 }),
        row({ id: "b", dueDate: "2026-10-05", paidAt: "2026-10-14T09:00:00Z", method: "pos", paidAmount: 11000, amount: 11000 }),
        row({ id: "c", dueDate: "2026-11-05", status: "bekliyor", paidAmount: null, paidAt: null, method: null }),
      ],
      [
        {
          id: "ev1",
          createdAt: "2026-10-14T10:00:00Z",
          actorName: "Mehtap",
          payload: { paidIds: ["a", "b"], snapshots: [{ id: "a", amount: 15000 }], note: " anne getirdi " },
        },
      ],
    );
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      kind: "odeme",
      eventId: "ev1",
      anchorId: "a",
      paidOn: "2026-10-14",
      totalKurus: 1500000,
      parts: [
        { method: "nakit", kurus: 400000, paidOn: "2026-10-12" },
        { method: "pos", kurus: 1100000, paidOn: "2026-10-14" },
      ],
      actorName: "Mehtap",
      note: "anne getirdi",
      corrected: false,
      capacityKurus: 1500000,
    });
    expect(history[0].items.map((item) => item.installmentId)).toEqual(["a", "b"]);
  });

  it("olaysız (içe aktarma) satırlar tek tek görünür; aynı ayda birden çok parça ayrı satırdır", () => {
    const history = buildPaymentHistory(
      [
        row({ id: "x1", paidAmount: 10000, amount: 10000, paidAt: "2026-09-10T09:00:00Z", method: "havale" }),
        row({ id: "x2", paidAmount: 5000, amount: 5000, paidAt: "2026-09-20T09:00:00Z", method: "nakit", markedByName: null }),
      ],
      [],
    );
    expect(history.map((entry) => [entry.kind, entry.anchorId, entry.totalKurus, entry.paidOn])).toEqual([
      ["ice_aktarma", "x2", 500000, "2026-09-20"],
      ["ice_aktarma", "x1", 1000000, "2026-09-10"],
    ]);
    expect(history[0]).toMatchObject({ eventId: null, note: null, actorName: null, capacityKurus: 500000 });
  });

  it("geri alınmış olay sayılmaz; tarih sırası en yeniden eskiye", () => {
    const history = buildPaymentHistory(
      [
        row({ id: "a", paidAt: "2026-10-01T09:00:00Z" }),
        row({ id: "b", paidAt: "2026-10-20T09:00:00Z", dueDate: "2026-11-05" }),
      ],
      [
        { id: "old", createdAt: "2026-09-01T00:00:00Z", actorName: "X", payload: { paidIds: ["a"], undone: true } },
        { id: "new", createdAt: "2026-10-20T10:00:00Z", actorName: "Rüya", payload: { paidIds: ["b"], correctedInstallmentId: "b" } },
      ],
    );
    expect(history.map((entry) => [entry.key, entry.kind])).toEqual([
      ["new", "odeme"],
      ["a", "ice_aktarma"],
    ]);
    expect(history[0].corrected).toBe(true);
  });

  it("ödenmemiş ya da artık ödenmiş olmayan satır geçmişte yer almaz", () => {
    const history = buildPaymentHistory(
      [row({ id: "a", status: "bekliyor", paidAmount: null, paidAt: null, method: null })],
      [{ id: "ev", createdAt: "2026-10-01T00:00:00Z", actorName: null, payload: { paidIds: ["a"] } }],
    );
    expect(history).toEqual([]);
  });
});
