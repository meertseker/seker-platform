/**
 * Öğrenci × ay ödeme matrisi — saf pivot. DB, React veya `Date.now()` yok;
 * bugün dışarıdan (Europe/Istanbul, "YYYY-MM-DD") verilir.
 *
 * Bir hücre = bir öğrencinin bir aydaki BÜTÜN taksitleri (aidat + kitap +
 * servis + diğer). Kalem ayrımı yapılmaz; Zehra Hanım'ın aidat defterinde de
 * ay hücresi "bu aile bu ay ne ödedi" demek.
 */
import type { InstallmentStatus, ItemType, PaymentMethod } from "@/lib/constants";
import { tlToKurus } from "@/lib/money";

export interface MatrixInstallmentInput {
  id: string;
  due_date: string;
  amount: number;
  status: InstallmentStatus;
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: PaymentMethod | null;
}

export interface MatrixPlanInput {
  id: string;
  item_type: ItemType;
  season: string;
  total_amount: number;
  installment_count: number;
  installments?: MatrixInstallmentInput[] | null;
}

export interface MatrixStudentInput {
  id: string;
  full_name: string;
  parent_name: string | null;
  season: string;
  status: StudentStatus;
  payment_plans?: MatrixPlanInput[] | null;
}

export type StudentStatus = "aktif" | "ayrildi" | "mezun";

export type CellState = "bos" | "odendi" | "kismi" | "gecikti" | "bekliyor";

export interface MatrixCellItem {
  installmentId: string;
  planId: string;
  itemType: ItemType;
  dueDate: string;
  amountKurus: number;
  status: InstallmentStatus;
  paidAmountKurus: number | null;
  paymentMethod: PaymentMethod | null;
  overdue: boolean;
}

export interface MatrixCell {
  monthKey: string;
  state: CellState;
  overdue: boolean;
  totalKurus: number;
  paidKurus: number;
  items: MatrixCellItem[];
  cancelledCount: number;
}

export interface MatrixRow {
  studentId: string;
  fullName: string;
  parentName: string | null;
  status: StudentStatus;
  hasPlan: boolean;
  aidatMonthlyKurus: number | null;
  kitapKurus: number | null;
  servisMonthlyKurus: number | null;
  cells: Record<string, MatrixCell>;
  totalKurus: number;
  paidKurus: number;
  remainingKurus: number;
  hasOverdue: boolean;
}

export interface MatrixColumnTotal {
  monthKey: string;
  expectedKurus: number;
  paidKurus: number;
}

export interface PaymentMatrix {
  months: string[];
  rows: MatrixRow[];
  columnTotals: MatrixColumnTotal[];
  grandTotal: { totalKurus: number; paidKurus: number; remainingKurus: number };
}

const nameCollator = new Intl.Collator("tr");

function monthKey(dueDate: string) {
  return dueDate.slice(0, 7);
}

function seasonPlans(student: MatrixStudentInput, season: string) {
  return (student.payment_plans ?? []).filter((plan) => plan.season === season);
}

/** Sözleşmedeki aylık rakam: fiili taksitler kısmi ödemeyle bölünmüş olabilir. */
function referenceKurus(plans: MatrixPlanInput[], itemType: ItemType, perInstallment: boolean) {
  const plan = plans.find((candidate) => candidate.item_type === itemType);
  if (!plan) return null;
  const totalKurus = tlToKurus(Number(plan.total_amount));
  if (!perInstallment) return totalKurus;
  const count = Number(plan.installment_count);
  return count > 0 ? Math.round(totalKurus / count) : totalKurus;
}

function toCellItem(
  installment: MatrixInstallmentInput,
  plan: MatrixPlanInput,
  today: string,
): MatrixCellItem {
  return {
    installmentId: installment.id,
    planId: plan.id,
    itemType: plan.item_type,
    dueDate: installment.due_date,
    amountKurus: tlToKurus(Number(installment.amount)),
    status: installment.status,
    paidAmountKurus:
      installment.paid_amount == null ? null : tlToKurus(Number(installment.paid_amount)),
    paymentMethod: installment.payment_method,
    overdue: installment.status === "bekliyor" && installment.due_date < today,
  };
}

/** Ödenen tutar; `paid_amount` boş bırakılmış eski kayıtlarda `amount`a düşer. */
function paidKurusOf(item: MatrixCellItem) {
  if (item.status !== "odendi") return 0;
  return item.paidAmountKurus ?? item.amountKurus;
}

function buildCell(monthKeyValue: string, items: MatrixCellItem[], cancelledCount: number): MatrixCell {
  const totalKurus = items.reduce((sum, item) => sum + item.amountKurus, 0);
  const paidKurus = items.reduce((sum, item) => sum + paidKurusOf(item), 0);
  const overdue = items.some((item) => item.overdue);

  let state: CellState;
  if (items.length === 0) {
    state = "bos";
  } else if (items.every((item) => item.status === "odendi")) {
    state = "odendi";
  } else if (items.some((item) => item.status === "odendi")) {
    state = "kismi";
  } else {
    state = overdue ? "gecikti" : "bekliyor";
  }

  return { monthKey: monthKeyValue, state, overdue, totalKurus, paidKurus, items, cancelledCount };
}

/**
 * Sütun ve genel toplamlar. Sayfa filtre çipleriyle satır süzdüğünde alt
 * toplamın ekranda görünenle tutması için ayrı çağrılabilir.
 */
export function summarizeRows(
  months: string[],
  rows: MatrixRow[],
): Pick<PaymentMatrix, "columnTotals" | "grandTotal"> {
  const columnTotals: MatrixColumnTotal[] = months.map((month) => ({
    monthKey: month,
    expectedKurus: rows.reduce((sum, row) => sum + (row.cells[month]?.totalKurus ?? 0), 0),
    paidKurus: rows.reduce((sum, row) => sum + (row.cells[month]?.paidKurus ?? 0), 0),
  }));

  const totalKurus = rows.reduce((sum, row) => sum + row.totalKurus, 0);
  const paidKurus = rows.reduce((sum, row) => sum + row.paidKurus, 0);

  return {
    columnTotals,
    grandTotal: { totalKurus, paidKurus, remainingKurus: totalKurus - paidKurus },
  };
}

export function buildPaymentMatrix(
  students: MatrixStudentInput[],
  today: string,
  season: string,
): PaymentMatrix {
  // ① Öğrenci başına, seçili sezonun iptal olmayan taksitlerini aya göre topla.
  const collected = students.map((student) => {
    const plans = seasonPlans(student, season);
    const itemsByMonth = new Map<string, MatrixCellItem[]>();
    const cancelledByMonth = new Map<string, number>();

    for (const plan of plans) {
      for (const installment of plan.installments ?? []) {
        const key = monthKey(installment.due_date);
        if (installment.status === "iptal") {
          cancelledByMonth.set(key, (cancelledByMonth.get(key) ?? 0) + 1);
          continue;
        }
        const bucket = itemsByMonth.get(key);
        const item = toCellItem(installment, plan, today);
        if (bucket) bucket.push(item);
        else itemsByMonth.set(key, [item]);
      }
    }

    for (const bucket of itemsByMonth.values()) {
      bucket.sort(
        (a, b) => a.dueDate.localeCompare(b.dueDate) || a.installmentId.localeCompare(b.installmentId),
      );
    }

    return { student, plans, itemsByMonth, cancelledByMonth };
  });

  // ② Ay sütunları yalnız gerçek taksitlerden doğar; boş aylar sütun açmaz.
  const months = [
    ...new Set(collected.flatMap((entry) => [...entry.itemsByMonth.keys()])),
  ].sort();

  // ③ Satırları kur — her satırda her ay için hücre var, tablo düzgün hizalansın.
  const rows: MatrixRow[] = collected.map(({ student, plans, itemsByMonth, cancelledByMonth }) => {
    const cells: Record<string, MatrixCell> = {};
    let totalKurus = 0;
    let paidKurus = 0;
    let hasOverdue = false;

    for (const month of months) {
      const cell = buildCell(month, itemsByMonth.get(month) ?? [], cancelledByMonth.get(month) ?? 0);
      cells[month] = cell;
      totalKurus += cell.totalKurus;
      paidKurus += cell.paidKurus;
      hasOverdue ||= cell.overdue;
    }

    return {
      studentId: student.id,
      fullName: student.full_name,
      parentName: student.parent_name,
      status: student.status,
      hasPlan: plans.length > 0,
      aidatMonthlyKurus: referenceKurus(plans, "aidat", true),
      kitapKurus: referenceKurus(plans, "kitap", false),
      servisMonthlyKurus: referenceKurus(plans, "servis", true),
      cells,
      totalKurus,
      paidKurus,
      remainingKurus: totalKurus - paidKurus,
      hasOverdue,
    };
  });

  // Planı olmayanlar en üstte: eksik veri gizlenmesin.
  rows.sort((a, b) => {
    if (a.hasPlan !== b.hasPlan) return a.hasPlan ? 1 : -1;
    return nameCollator.compare(a.fullName, b.fullName);
  });

  return { months, rows, ...summarizeRows(months, rows) };
}
