/**
 * Öğrenci sayfasının ödeme paneli — saf. Sayfadaki bütün ödeme girişleri (Durum kartı
 * "Ödeme al", aidat satırı hücreleri, taksit listesi) Ödemeler ekranındaki hücre panelini
 * açar; panelin sütunları (ay / yan sütun) burada kurulur.
 *
 * Öğrencinin sezonu Ödemeler tablosuyla aynı anahtarları kullanır ("2026-10", "kitap");
 * önceki sezonlarda kalan taksitler "2025-2026:2026-05" gibi sezon önekiyle ayrılır.
 */
import { buildPaymentMatrix, SIDE_COLUMNS, sideCellOf, type MatrixCell, type MatrixStudentInput, type SideColumn } from "@/lib/payment-matrix";

export interface PanelColumn {
  key: string;
  /** Panel başlığı: "Ekim 2026", "Kitap - Kırtasiye" */
  label: string;
  cell: MatrixCell;
}

export interface PendingColumn {
  key: string;
  label: string;
  /** En eski bekleyen vadesi */
  dueDate: string;
  openKurus: number;
  overdue: boolean;
}

export const SIDE_LABELS: Record<SideColumn, string> = {
  kitap: "Kitap - Kırtasiye",
  aidat: "Aidat Tutarı",
  servis: "Servis Tutarı",
};

const monthNameFormatter = new Intl.DateTimeFormat("tr-TR", { month: "long", timeZone: "Europe/Istanbul" });

/** "2026-10" → "Ekim 2026" */
export function longMonthLabel(monthKey: string) {
  const name = monthNameFormatter.format(new Date(`${monthKey}-01T12:00:00+03:00`));
  return `${name.charAt(0).toLocaleUpperCase("tr")}${name.slice(1)} ${monthKey.slice(0, 4)}`;
}

/** Öğrencinin bütün sezonlarındaki dolu sütunlar (Excel sırası: yan sütunlar, sonra aylar). */
export function studentPanelColumns(student: MatrixStudentInput, today: string): PanelColumn[] {
  const seasons = [
    student.season,
    ...[...new Set((student.payment_plans ?? []).map((plan) => plan.season))]
      .filter((season) => season !== student.season)
      .sort(),
  ];
  const columns: PanelColumn[] = [];
  for (const season of seasons) {
    const current = season === student.season;
    const matrix = buildPaymentMatrix([student], today, season);
    const row = matrix.rows[0];
    if (!row) continue;
    const key = (base: string) => (current ? base : `${season}:${base}`);
    const suffix = current ? "" : ` · ${season}`;
    for (const column of SIDE_COLUMNS) {
      const cell = sideCellOf(row, column);
      if (cell && cell.items.length > 0) columns.push({ key: key(column), label: `${SIDE_LABELS[column]}${suffix}`, cell });
    }
    for (const month of matrix.months) {
      const cell = row.cells[month];
      if (cell && cell.items.length > 0) columns.push({ key: key(month), label: `${longMonthLabel(month)}${suffix}`, cell });
    }
  }
  return columns;
}

/** Bekleyen kalemi olan sütunlar, en eski vadeden başlayarak. */
export function pendingColumns(columns: PanelColumn[]): PendingColumn[] {
  return columns
    .map((column) => {
      const open = column.cell.items.filter((item) => item.status === "bekliyor");
      if (open.length === 0) return null;
      return {
        key: column.key,
        label: column.label,
        dueDate: open.map((item) => item.dueDate).sort()[0],
        openKurus: open.reduce((sum, item) => sum + item.amountKurus, 0),
        overdue: open.some((item) => item.overdue),
      };
    })
    .filter((column): column is PendingColumn => column !== null)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.key.localeCompare(b.key));
}

/** "Ödeme al": en eski bekleyen ya da geciken taksitin sütunu (yoksa null). */
export function defaultPanelKey(columns: PanelColumn[]): string | null {
  return pendingColumns(columns)[0]?.key ?? null;
}

/** Taksit listesindeki satırın sütunu (iptal taksit sütunda yer almaz → null). */
export function columnKeyForInstallment(columns: PanelColumn[], installmentId: string): string | null {
  return columns.find((column) => column.cell.items.some((item) => item.installmentId === installmentId))?.key ?? null;
}
