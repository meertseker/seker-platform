// Raporun tek tablo modeli: ekrandaki tablo, CSV ve Excel aynı satırlardan üretilir; sayılar burada ham durur
// (tutar kuruş, oran 0–1), biçim kolonun türünden gelir.
import { DASH, formatDays, formatInt, formatMinutes, formatPct, formatTl } from "./format";

export type ColumnKind = "text" | "int" | "tl" | "pct" | "minutes" | "days";
export type Column = { key: string; label: string; kind: ColumnKind };
export type Cell = string | number | null;
export type Row = Record<string, Cell>;

export type ReportTable = {
  id: string;
  title: string;
  columns: Column[];
  rows: Row[];
  /** Toplam satırı (ekranda kalın, dosyada en altta). */
  total?: Row;
  /** Satır yokken ekranda yazılacak cümle. */
  emptyText?: string;
};

export function col(key: string, label: string, kind: ColumnKind = "int"): Column {
  return { key, label, kind };
}

export function formatCell(value: Cell | undefined, kind: ColumnKind): string {
  if (value == null) return kind === "text" ? "" : DASH;
  if (typeof value === "string") return value;
  switch (kind) {
    case "tl":
      return formatTl(value);
    case "pct":
      return formatPct(value);
    case "minutes":
      return formatMinutes(value);
    case "days":
      return formatDays(value);
    case "int":
      return formatInt(value);
    default:
      return String(value);
  }
}

export function isNumericKind(kind: ColumnKind): boolean {
  return kind !== "text";
}
