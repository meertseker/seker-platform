/**
 * Öğrenciler listesinin süzgeci ve ödeme sütunu (saf). Varsayılan yalnız aktif öğrenciler; ayrılan ve mezunlar
 * süzgeçle görülür. Ödenen/toplam yalnız aktif sezonun planlarından; "Geciken" rozeti Gecikenler ile aynı
 * tanımla bütün sezonlara bakar (geçen sezondan kalan borç da görünür).
 */
import { collectedKurus, isOverdue, receivableKurus, sumKurus } from "@/lib/queries/money";
import { inSeason } from "@/lib/queries/season";

export const STUDENT_LIST_FILTERS = {
  aktif: "Aktif öğrenciler",
  ayrildi: "Ayrılanlar",
  mezun: "Mezunlar",
  gecmis: "Ayrılan ve mezunlar",
  tumu: "Tümü",
} as const;
export type StudentListFilter = keyof typeof STUDENT_LIST_FILTERS;

/** URL değeri → süzgeç. Boş ya da tanınmayan değer "aktif". */
export function resolveStudentListFilter(value: string | undefined | null): StudentListFilter {
  return value && value in STUDENT_LIST_FILTERS ? (value as StudentListFilter) : "aktif";
}

/** Süzgecin izin verdiği öğrenci durumları; null = hepsi. */
export function statusesFor(filter: StudentListFilter): string[] | null {
  if (filter === "tumu") return null;
  if (filter === "gecmis") return ["ayrildi", "mezun"];
  return [filter];
}

type Tl = number | string | null;

export interface StudentListInstallment {
  due_date: string;
  amount: Tl;
  status: string;
  paid_amount: Tl;
}

export interface StudentListPlan {
  season: string | null;
  installments?: StudentListInstallment[] | null;
}

/** Ödeme sütunu: aktif sezonun alacağı ve tahsilatı; geciken bütün sezonlar. `season` null ise bütün sezonlar. */
export function studentPaymentSummary(
  student: { status: string; payment_plans?: StudentListPlan[] | null },
  today: string,
  season: string | null,
) {
  const plans = student.payment_plans ?? [];
  const seasonal = plans.filter((plan) => inSeason(plan.season, season)).flatMap((plan) => plan.installments ?? []);
  const all = plans.flatMap((plan) => plan.installments ?? []);
  return {
    totalKurus: sumKurus(seasonal, receivableKurus),
    paidKurus: sumKurus(seasonal, collectedKurus),
    overdue: all.some((installment) => isOverdue(installment, today, student.status)),
  };
}
