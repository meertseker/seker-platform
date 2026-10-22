// Sezon süzgeci: geçmiş sezonun (2025-2026) ödenmiş taksitleri aktif sezonun (2026-2027) para toplamlarına
// karışmaz. Rapor tarafı report-build.test.ts'de, Bugün kartı payment-summary.test.ts'de.
import { describe, expect, it } from "vitest";
import { collectedInSeasonKurus, resolveScope, type PaymentStudent } from "@/lib/payments-scope";
import { inSeason } from "@/lib/queries/season";
import {
  resolveStudentListFilter,
  statusesFor,
  studentPaymentSummary,
  type StudentListPlan,
} from "@/lib/student-list";

const ACTIVE = "2026-2027";
const PAST = "2025-2026";
const T = (local: string) => new Date(`${local}+03:00`).toISOString();

function paid(due: string, paidLocal: string, amount: number) {
  return { id: `${due}-${amount}`, due_date: due, amount, status: "odendi" as const, paid_at: T(paidLocal), paid_amount: amount, payment_method: "nakit" as const };
}
function waiting(due: string, amount: number) {
  return { id: `${due}-${amount}`, due_date: due, amount, status: "bekliyor" as const, paid_at: null, paid_amount: null, payment_method: null };
}

const twoSeasons = {
  id: "s1",
  full_name: "Ali",
  parent_name: null,
  phone: null,
  season: ACTIVE,
  status: "aktif",
  created_at: null,
  payment_plans: [
    {
      id: "p-past",
      item_type: "aidat",
      season: PAST,
      total_amount: 0,
      installment_count: 3,
      installments: [
        paid("2025-10-05", "2025-10-03T10:00:00", 10_000),
        paid("2026-03-05", "2026-03-04T10:00:00", 10_000),
        // Geçen sezondan kalan borç bu ay ödendi.
        paid("2026-06-05", "2026-10-06T10:00:00", 4_000),
        waiting("2026-07-05", 5_000),
      ],
    },
    {
      id: "p-active",
      item_type: "aidat",
      season: ACTIVE,
      total_amount: 0,
      installment_count: 2,
      installments: [paid("2026-10-05", "2026-10-02T10:00:00", 12_000), waiting("2026-11-05", 12_000)],
    },
  ],
} as unknown as PaymentStudent;

describe("inSeason", () => {
  it("süzgeç varsa yalnız o sezon; null süzgeç her şeyi geçirir", () => {
    expect(inSeason(ACTIVE, ACTIVE)).toBe(true);
    expect(inSeason(PAST, ACTIVE)).toBe(false);
    expect(inSeason(null, ACTIVE)).toBe(false);
    expect(inSeason(PAST, null)).toBe(true);
  });
});

describe("Ödemeler: bu ay tahsil edilen", () => {
  it("yalnız seçili sezonun planları", () => {
    expect(collectedInSeasonKurus([twoSeasons], ACTIVE, "2026-10-01", "2026-11-01")).toBe(1_200_000);
    expect(collectedInSeasonKurus([twoSeasons], PAST, "2026-10-01", "2026-11-01")).toBe(400_000);
    expect(collectedInSeasonKurus([twoSeasons], PAST, "2025-09-01", "2026-08-01")).toBe(2_000_000);
  });

  it("sezon seçilmemişse aktif sezon, geçersizse de aktif sezon", () => {
    const seasons = ["2027-2028", ACTIVE, PAST];
    expect(resolveScope({}, seasons, ACTIVE).season).toBe(ACTIVE);
    expect(resolveScope({ sezon: "1999" }, seasons, ACTIVE).season).toBe(ACTIVE);
    expect(resolveScope({ sezon: PAST }, seasons, ACTIVE).season).toBe(PAST);
    // Aktif sezon bilinmiyor ya da listede yoksa en yeni sezon.
    expect(resolveScope({}, seasons, null).season).toBe("2027-2028");
    expect(resolveScope({}, seasons, "2030-2031").season).toBe("2027-2028");
  });
});

describe("Öğrenciler listesi", () => {
  const plans = twoSeasons.payment_plans as unknown as StudentListPlan[];

  it("ödenen/toplam aktif sezonu gösterir; geciken rozeti bütün sezonlar", () => {
    const s = studentPaymentSummary({ status: "aktif", payment_plans: plans }, "2026-10-22", ACTIVE);
    expect(s).toEqual({ totalKurus: 2_400_000, paidKurus: 1_200_000, overdue: true }); // geçen sezonun 5.000'i gecikmiş
    const all = studentPaymentSummary({ status: "aktif", payment_plans: plans }, "2026-10-22", null);
    expect(all.totalKurus).toBe(2_400_000 + 2_900_000);
    expect(all.paidKurus).toBe(1_200_000 + 2_400_000);
  });

  it("ayrılan öğrencide geciken rozeti yok", () => {
    expect(studentPaymentSummary({ status: "ayrildi", payment_plans: plans }, "2026-10-22", ACTIVE).overdue).toBe(false);
  });

  it("varsayılan yalnız aktif; ayrılan/mezun süzgeçle", () => {
    expect(resolveStudentListFilter(undefined)).toBe("aktif");
    expect(resolveStudentListFilter("hack")).toBe("aktif");
    expect(statusesFor(resolveStudentListFilter(""))).toEqual(["aktif"]);
    expect(statusesFor("ayrildi")).toEqual(["ayrildi"]);
    expect(statusesFor("gecmis")).toEqual(["ayrildi", "mezun"]);
    expect(statusesFor("tumu")).toBeNull();
  });
});
