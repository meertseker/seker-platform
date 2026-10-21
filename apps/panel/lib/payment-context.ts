/**
 * Bir matris satırından "Ödeme al" ve hatırlatma için gereken bağlam — saf.
 * Ödemeler tablosu ve öğrenci sayfası aynı bağlamı kullanır.
 */
import type { CellPaymentContext, TraceDTO } from "@/components/payment-matrix-cell";
import type { OpenPaymentItem } from "@/components/payment-dialog";
import { reminderMessage } from "@/lib/overdue";
import { installmentLabel } from "@/lib/payment-labels";
import type { MatrixCell, MatrixRow } from "@/lib/payment-matrix";
import type { PaymentTraces } from "@/lib/payment-events";

export function rowCells(row: MatrixRow): MatrixCell[] {
  return [row.kitapCell, row.aidatCell, row.servisCell, ...Object.values(row.cells)].filter(
    (cell): cell is MatrixCell => cell !== null,
  );
}

export function openItemsOf(row: MatrixRow): OpenPaymentItem[] {
  return openItemsOfCells(rowCells(row));
}

/** Hücrelerdeki bekleyen taksitler, vade sırasıyla ("Ödeme al" penceresinin listesi). */
export function openItemsOfCells(cells: MatrixCell[]): OpenPaymentItem[] {
  return cells
    .flatMap((cell) => cell.items)
    .filter((item) => item.status === "bekliyor")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.installmentId.localeCompare(b.installmentId))
    .map((item) => ({
      id: item.installmentId,
      label: installmentLabel(item.itemType, item.dueDate),
      dueDate: item.dueDate,
      amountKurus: item.amountKurus,
      overdue: item.overdue,
    }));
}

function pick(map: Map<string, TraceDTO[]>, ids: string[]) {
  const out: Record<string, TraceDTO[]> = {};
  for (const id of ids) {
    const list = map.get(id);
    if (list?.length) out[id] = list;
  }
  return out;
}

export function paymentContextFor(
  row: MatrixRow,
  student: { id: string; phone: string | null },
  traces: PaymentTraces,
): CellPaymentContext {
  return paymentContextForCells(rowCells(row), { ...student, fullName: row.fullName }, traces);
}

/** Öğrenci sayfası: birden çok sezonun hücreleri tek bağlamda. */
export function paymentContextForCells(
  cells: MatrixCell[],
  student: { id: string; phone: string | null; fullName: string },
  traces: PaymentTraces,
): CellPaymentContext {
  const items = cells.flatMap((cell) => cell.items);
  const ids = items.map((item) => item.installmentId);
  const overdue = items.filter((item) => item.overdue);
  return {
    studentId: student.id,
    phone: student.phone,
    openItems: openItemsOfCells(cells),
    notes: pick(traces.notes, ids),
    reminders: pick(traces.reminders, ids),
    reminderMessage: reminderMessage({
      studentName: student.fullName,
      totalKurus: overdue.reduce((sum, item) => sum + item.amountKurus, 0),
      items: overdue.map((item) => ({ dueDate: item.dueDate, itemType: item.itemType })),
    }),
  };
}
