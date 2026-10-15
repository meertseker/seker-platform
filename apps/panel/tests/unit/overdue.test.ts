import { describe, it, expect } from "vitest";
import {
  groupOverdueByStudent,
  sortOverdue,
  normalizeOverdueSort,
  overdueTotals,
  reminderMessage,
  collectionRatePercent,
  type OverdueRow,
} from "@/lib/overdue";

function row(overrides: Partial<OverdueRow>): OverdueRow {
  return {
    installment_id: crypto.randomUUID(), student_id: "s1", student_name: "Ada Yılmaz",
    family_phone: "+905551112233", due_date: "2026-09-05", amount: "18000.00",
    days_overdue: 39, item_type: "aidat", season: "2026-2027", ...overrides,
  };
}

describe("groupOverdueByStudent", () => {
  it("aynı öğrencinin kalemlerini tek kartta toplar, kuruşla toplar, en eski vadeyi öne alır", () => {
    const list = groupOverdueByStudent([
      row({ installment_id: "i2", due_date: "2026-10-05", amount: 18000, days_overdue: 9 }),
      row({ installment_id: "i1", due_date: "2026-09-05", amount: "18000.50", days_overdue: 39 }),
      row({ installment_id: "i3", student_id: "s2", student_name: "Can Demir", family_phone: null, amount: 2500, item_type: "servis", days_overdue: 3 }),
    ]);
    expect(list).toHaveLength(2);
    const ada = list.find((s) => s.studentId === "s1")!;
    expect(ada.totalKurus).toBe(3_600_050);
    expect(ada.maxDaysOverdue).toBe(39);
    expect(ada.items.map((i) => i.installmentId)).toEqual(["i1", "i2"]);
    expect(list.find((s) => s.studentId === "s2")!.phone).toBeNull();
  });
});

describe("sıralama", () => {
  const list = groupOverdueByStudent([
    row({ student_id: "a", student_name: "Zeynep", amount: 100, days_overdue: 50 }),
    row({ student_id: "b", student_name: "Ali", amount: 9000, days_overdue: 5 }),
    row({ student_id: "c", student_name: "Çağla", amount: 500, days_overdue: 20 }),
  ]);

  it("gun: en çok geciken önce", () => {
    expect(sortOverdue(list, "gun").map((s) => s.studentId)).toEqual(["a", "c", "b"]);
  });
  it("tutar: en yüksek borç önce", () => {
    expect(sortOverdue(list, "tutar").map((s) => s.studentId)).toEqual(["b", "c", "a"]);
  });
  it("isim: Türkçe alfabe sırası (Ç, C'den sonra)", () => {
    expect(sortOverdue(list, "isim").map((s) => s.studentName)).toEqual(["Ali", "Çağla", "Zeynep"]);
  });
  it("bilinmeyen sıralama değeri gun'a döner", () => {
    expect(normalizeOverdueSort("hack")).toBe("gun");
    expect(normalizeOverdueSort("tutar")).toBe("tutar");
    expect(normalizeOverdueSort(undefined)).toBe("gun");
  });
});

describe("overdueTotals", () => {
  it("öğrenci, taksit ve tutar toplamı", () => {
    const list = groupOverdueByStudent([row({ amount: 100 }), row({ amount: 50 }), row({ student_id: "s2", amount: 25 })]);
    expect(overdueTotals(list)).toEqual({ students: 2, installments: 3, totalKurus: 17_500 });
  });
});

describe("reminderMessage", () => {
  it("ay adı ve kalem türüyle Türkçe hatırlatma üretir", () => {
    expect(
      reminderMessage({
        studentName: "Ada Yılmaz",
        totalKurus: 3_600_000,
        items: [
          { dueDate: "2026-09-05", itemType: "aidat" },
          { dueDate: "2026-10-05", itemType: "aidat" },
        ],
      }),
    ).toBe(
      "Merhaba, Ada Yılmaz için Eylül 2026 Aidat ve Ekim 2026 Aidat ödemelerinin vadesi geçmiş görünüyor. " +
        "Toplam: 36.000,00 ₺. Ödemeyi yaptıysanız bu mesajı dikkate almayın. Teşekkür ederiz, Şeker Anaokulu",
    );
  });

  it("tek kalemde tekil yazar", () => {
    expect(reminderMessage({ studentName: "Can", totalKurus: 250_000, items: [{ dueDate: "2026-10-01", itemType: "servis" }] })).toBe(
      "Merhaba, Can için Ekim 2026 Servis ödemesinin vadesi geçmiş görünüyor. " +
        "Toplam: 2.500,00 ₺. Ödemeyi yaptıysanız bu mesajı dikkate almayın. Teşekkür ederiz, Şeker Anaokulu",
    );
  });

  it("üçten fazla kalemi kısaltır", () => {
    const msg = reminderMessage({
      studentName: "Ada",
      totalKurus: 100,
      items: ["2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01"].map((d) => ({ dueDate: d, itemType: "aidat" as const })),
    });
    expect(msg).toContain("Haziran 2026 Aidat, Temmuz 2026 Aidat, Ağustos 2026 Aidat ve 2 ödeme daha");
  });
});

describe("collectionRatePercent", () => {
  it("yuvarlanmış yüzde döner", () => {
    expect(collectionRatePercent(66_667, 100_000)).toBe(67);
  });
  it("vadesi gelen yoksa null", () => {
    expect(collectionRatePercent(5_000, 0)).toBeNull();
  });
});
