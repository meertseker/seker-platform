/**
 * Öğrenci × ay ödeme matrisi — saf pivot. DB, React veya `Date.now()` yok;
 * bugün dışarıdan (Europe/Istanbul, "YYYY-MM-DD") verilir.
 *
 * Düzen, okulun "AİDAT LİSTESİ" Excel defterinin birebir aynısıdır:
 *   KİTAP - KIRTASİYE | AİDAT TUTARI (yıllık peşin) | SERVİS TUTARI | EYLÜL … HAZİRAN
 * Kitap ve servis kendi sütununda tek hücredir (bütün taksitleriyle); tek taksitli
 * aidat planı peşin sayılır ve AİDAT TUTARI sütununa gider. Ay hücrelerinde yalnız
 * aylık aidat (ve kayıt/yemek/diğer) kalır.
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
  /** Excel'deki satır sırası: öğrenciler deftere eklendikleri sırayla durur. */
  created_at?: string | null;
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
  paidAt: string | null;
  overdue: boolean;
}

export interface MatrixCell {
  monthKey: string;
  state: CellState;
  overdue: boolean;
  /** Ödendi ve tamamı nakit — Excel'de mor boya. */
  cash: boolean;
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
  /** Yıllık peşin aidat (tek taksitli plan); aylık ödeyende null. */
  aidatCell: MatrixCell | null;
  kitapCell: MatrixCell | null;
  servisCell: MatrixCell | null;
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

export type SideColumn = "kitap" | "aidat" | "servis";
export const SIDE_COLUMNS: SideColumn[] = ["kitap", "aidat", "servis"];

export interface PaymentMatrix {
  months: string[];
  rows: MatrixRow[];
  columnTotals: MatrixColumnTotal[];
  sideTotals: Record<SideColumn, MatrixColumnTotal>;
  grandTotal: { totalKurus: number; paidKurus: number; remainingKurus: number };
}

const nameCollator = new Intl.Collator("tr");

function monthKey(dueDate: string) {
  return dueDate.slice(0, 7);
}

function seasonPlans(student: MatrixStudentInput, season: string) {
  return (student.payment_plans ?? []).filter((plan) => plan.season === season);
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
    paidAt: installment.paid_at,
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
  } else if (items.every((item) => item.status === "odendi") && paidKurus >= totalKurus) {
    state = "odendi";
  } else if (items.some((item) => item.status === "odendi")) {
    state = "kismi";
  } else {
    state = overdue ? "gecikti" : "bekliyor";
  }

  const cash =
    state === "odendi" && items.every((item) => item.paymentMethod === "nakit");

  return { monthKey: monthKeyValue, state, overdue, cash, totalKurus, paidKurus, items, cancelledCount };
}

/**
 * Sütun ve genel toplamlar. Sayfa filtre çipleriyle satır süzdüğünde alt
 * toplamın ekranda görünenle tutması için ayrı çağrılabilir.
 */
export function sideCellOf(row: MatrixRow, column: SideColumn) {
  if (column === "kitap") return row.kitapCell;
  if (column === "servis") return row.servisCell;
  return row.aidatCell;
}

export function summarizeRows(
  months: string[],
  rows: MatrixRow[],
): Pick<PaymentMatrix, "columnTotals" | "sideTotals" | "grandTotal"> {
  const columnTotals: MatrixColumnTotal[] = months.map((month) => ({
    monthKey: month,
    expectedKurus: rows.reduce((sum, row) => sum + (row.cells[month]?.totalKurus ?? 0), 0),
    paidKurus: rows.reduce((sum, row) => sum + (row.cells[month]?.paidKurus ?? 0), 0),
  }));

  const sideTotals = Object.fromEntries(
    SIDE_COLUMNS.map((column) => [
      column,
      {
        monthKey: column,
        expectedKurus: rows.reduce((sum, row) => sum + (sideCellOf(row, column)?.totalKurus ?? 0), 0),
        paidKurus: rows.reduce((sum, row) => sum + (sideCellOf(row, column)?.paidKurus ?? 0), 0),
      },
    ]),
  ) as Record<SideColumn, MatrixColumnTotal>;

  const totalKurus = rows.reduce((sum, row) => sum + row.totalKurus, 0);
  const paidKurus = rows.reduce((sum, row) => sum + row.paidKurus, 0);

  return {
    columnTotals,
    sideTotals,
    grandTotal: { totalKurus, paidKurus, remainingKurus: totalKurus - paidKurus },
  };
}

/** Taksitin gideceği sütun: Excel'deki yan sütunlardan biri ya da ayı. */
function columnOf(plan: MatrixPlanInput, installment: MatrixInstallmentInput): string {
  if (plan.item_type === "kitap") return "kitap";
  if (plan.item_type === "servis") return "servis";
  if (plan.item_type === "aidat" && Number(plan.installment_count) === 1) return "aidat";
  return monthKey(installment.due_date);
}

const byDue = (a: MatrixCellItem, b: MatrixCellItem) =>
  a.dueDate.localeCompare(b.dueDate) || a.installmentId.localeCompare(b.installmentId);

export function buildPaymentMatrix(
  students: MatrixStudentInput[],
  today: string,
  season: string,
): PaymentMatrix {
  // ① Öğrenci başına, seçili sezonun iptal olmayan taksitlerini sütuna göre topla.
  const collected = students.map((student) => {
    const plans = seasonPlans(student, season);
    const itemsByColumn = new Map<string, MatrixCellItem[]>();
    const cancelledByColumn = new Map<string, number>();

    for (const plan of plans) {
      for (const installment of plan.installments ?? []) {
        const key = columnOf(plan, installment);
        if (installment.status === "iptal") {
          cancelledByColumn.set(key, (cancelledByColumn.get(key) ?? 0) + 1);
          continue;
        }
        const bucket = itemsByColumn.get(key);
        const item = toCellItem(installment, plan, today);
        if (bucket) bucket.push(item);
        else itemsByColumn.set(key, [item]);
      }
    }

    for (const bucket of itemsByColumn.values()) bucket.sort(byDue);

    return { student, plans, itemsByColumn, cancelledByColumn };
  });

  // ② Ay sütunları yalnız gerçek aylık taksitlerden doğar; boş aylar sütun açmaz.
  const sideKeys = new Set<string>(SIDE_COLUMNS);
  const months = [
    ...new Set(
      collected.flatMap((entry) => [...entry.itemsByColumn.keys()].filter((key) => !sideKeys.has(key))),
    ),
  ].sort();

  // ③ Satırları kur — her satırda her ay için hücre var, tablo düzgün hizalansın.
  const rows: MatrixRow[] = collected.map(({ student, plans, itemsByColumn, cancelledByColumn }) => {
    const cellFor = (key: string) =>
      buildCell(key, itemsByColumn.get(key) ?? [], cancelledByColumn.get(key) ?? 0);
    const sideFor = (key: SideColumn) => (itemsByColumn.has(key) ? cellFor(key) : null);

    const cells: Record<string, MatrixCell> = {};
    for (const month of months) cells[month] = cellFor(month);
    const kitapCell = sideFor("kitap");
    const aidatCell = sideFor("aidat");
    const servisCell = sideFor("servis");

    const all = [...Object.values(cells), kitapCell, aidatCell, servisCell].filter(
      (cell): cell is MatrixCell => cell !== null,
    );
    const totalKurus = all.reduce((sum, cell) => sum + cell.totalKurus, 0);
    const paidKurus = all.reduce((sum, cell) => sum + cell.paidKurus, 0);

    return {
      studentId: student.id,
      fullName: student.full_name,
      parentName: student.parent_name,
      status: student.status,
      hasPlan: plans.length > 0,
      aidatCell,
      kitapCell,
      servisCell,
      cells,
      totalKurus,
      paidKurus,
      remainingKurus: totalKurus - paidKurus,
      hasOverdue: all.some((cell) => cell.overdue),
    };
  });

  // Excel'deki gibi: deftere eklenme sırası (aynı anda eklenenlerde ad sırası).
  const createdAt = new Map(students.map((student) => [student.id, student.created_at ?? ""]));
  rows.sort(
    (a, b) =>
      (createdAt.get(a.studentId) ?? "").localeCompare(createdAt.get(b.studentId) ?? "") ||
      nameCollator.compare(a.fullName, b.fullName),
  );

  return { months, rows, ...summarizeRows(months, rows) };
}
