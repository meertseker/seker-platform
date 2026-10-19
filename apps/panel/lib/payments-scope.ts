/**
 * Ödemeler ekranının kapsamı (sezon, arama, filtre, geçmiş öğrenciler). Ekran ve Excel indirme aynı
 * fonksiyonları kullanır; indirilen dosya ekranda görünen tabloyla birebir aynıdır.
 */
import type { MatrixRow, MatrixStudentInput } from "@/lib/payment-matrix";
import { hasUnpaidThisMonth } from "@/lib/payments-summary";

export const PAYMENT_STUDENTS_SELECT =
  "id, full_name, parent_name, phone, season, status, created_at, payment_plans(id, item_type, season, total_amount, installment_count, tentative_from, installments(id, due_date, amount, status, paid_at, paid_amount, payment_method))";

export type PaymentStudent = MatrixStudentInput & { phone: string | null };

export const PAYMENT_FILTERS = {
  tumu: "Tümü",
  bu_ay: "Bu ay ödemeyenler",
  geciken: "Gecikeni olanlar",
  plansiz: "Planı olmayanlar",
} as const;
export type PaymentFilterKey = keyof typeof PAYMENT_FILTERS;

export interface PaymentScope {
  season: string;
  query: string;
  filter: PaymentFilterKey;
  includePast: boolean;
}

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function todayInIstanbul(now: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Öğrencilerde ve planlarda geçen sezonlar, yeniden eskiye. */
export function seasonsOf(students: PaymentStudent[]): string[] {
  return [
    ...new Set(
      students.flatMap((student) => [student.season, ...(student.payment_plans ?? []).map((plan) => plan.season)]),
    ),
  ]
    .filter(Boolean)
    .sort()
    .reverse();
}

export function resolveScope(params: Params, seasons: string[]): PaymentScope {
  const seasonParam = first(params.sezon) ?? "";
  const filterParam = first(params.filtre) ?? "";
  return {
    season: seasons.includes(seasonParam) ? seasonParam : (seasons[0] ?? ""),
    query: (first(params.q) ?? "").trim(),
    filter: filterParam in PAYMENT_FILTERS ? (filterParam as PaymentFilterKey) : "tumu",
    includePast: first(params.gecmis) === "1",
  };
}

/** Türkçe'ye duyarlı, aksansız arama karşılaştırması. */
function normalize(value: string) {
  return value.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function matchesSearch(student: PaymentStudent, query: string) {
  if (!query) return true;
  const needle = normalize(query);
  return [student.full_name, student.parent_name, student.phone].some(
    (field) => field && normalize(field).includes(needle),
  );
}

export function studentsInScope(students: PaymentStudent[], scope: PaymentScope): PaymentStudent[] {
  return students.filter((student) => {
    if (!scope.includePast && student.status !== "aktif") return false;
    if (!matchesSearch(student, scope.query)) return false;
    return student.season === scope.season || (student.payment_plans ?? []).some((plan) => plan.season === scope.season);
  });
}

export function filterRows(rows: MatrixRow[], filter: PaymentFilterKey, currentMonth: string): MatrixRow[] {
  return rows.filter((row) => {
    if (filter === "bu_ay") return hasUnpaidThisMonth(row, currentMonth);
    if (filter === "geciken") return row.hasOverdue;
    if (filter === "plansiz") return !row.hasPlan;
    return true;
  });
}
