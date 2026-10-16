/**
 * Ödemeler ekranının özet hesapları. Ay hücrelerinin yanında yan sütunları (kitap, peşin aidat, servis)
 * da kapsar: aksi halde örneğin gecikmiş bir kitap taksiti "Toplam geciken"e girmez.
 * Saf fonksiyonlar; bugün ve ay dışarıdan verilir.
 */
import type { MatrixCell, MatrixCellItem, MatrixRow } from "@/lib/payment-matrix";

/** Satırın bütün hücreleri: aylar + kitap + peşin aidat + servis. */
export function allCellsOf(row: MatrixRow): MatrixCell[] {
  return [
    ...Object.values(row.cells),
    ...[row.kitapCell, row.aidatCell, row.servisCell].filter((cell): cell is MatrixCell => cell != null),
  ];
}

function itemsOf(row: MatrixRow): MatrixCellItem[] {
  return allCellsOf(row).flatMap((cell) => cell.items);
}

/** Taksitin henüz tahsil edilmemiş kısmı (kısmi ödemede kalan, bekleyende tamamı). */
export function unpaidKurusOf(item: MatrixCellItem): number {
  if (item.status === "iptal") return 0;
  if (item.status === "odendi") return Math.max(item.amountKurus - (item.paidAmountKurus ?? item.amountKurus), 0);
  return item.amountKurus;
}

/** Vadesi geçmiş, hâlâ ödenmemiş tutar (yan sütunlar dahil). */
export function overdueKurusOf(rows: MatrixRow[]): number {
  return rows.reduce(
    (sum, row) => sum + itemsOf(row).reduce((s, item) => (item.overdue ? s + unpaidKurusOf(item) : s), 0),
    0,
  );
}

/** Vadesi bu ay (YYYY-MM) olan ve henüz tahsil edilmemiş tutar (yan sütunlar dahil). */
export function dueThisMonthKurusOf(rows: MatrixRow[], monthKey: string): number {
  return rows.reduce(
    (sum, row) =>
      sum +
      itemsOf(row).reduce((s, item) => (item.dueDate.startsWith(monthKey) ? s + unpaidKurusOf(item) : s), 0),
    0,
  );
}

/** Bu ay vadesi gelen ve henüz ödenmemiş (gecikmiş veya bekleyen) taksiti olan öğrenci mi? */
export function hasUnpaidThisMonth(row: MatrixRow, monthKey: string): boolean {
  return itemsOf(row).some((item) => item.dueDate.startsWith(monthKey) && unpaidKurusOf(item) > 0);
}

export interface SeasonSummary {
  totalKurus: number;
  paidKurus: number;
  remainingKurus: number;
  overdueKurus: number;
  /** Tahsil edilen / toplam; plan yoksa null. */
  collectionRate: number | null;
  studentCount: number;
  overdueStudentCount: number;
}

/** Sezonun toplam alacağı, tahsil edilen, kalan ve geciken (seçili satırlar için). */
export function seasonSummaryOf(rows: MatrixRow[]): SeasonSummary {
  let totalKurus = 0;
  let paidKurus = 0;
  for (const row of rows) {
    totalKurus += row.totalKurus;
    paidKurus += row.paidKurus;
  }
  return {
    totalKurus,
    paidKurus,
    remainingKurus: Math.max(totalKurus - paidKurus, 0),
    overdueKurus: overdueKurusOf(rows),
    collectionRate: totalKurus > 0 ? paidKurus / totalKurus : null,
    studentCount: rows.filter((row) => row.hasPlan).length,
    overdueStudentCount: rows.filter((row) => row.hasOverdue).length,
  };
}
