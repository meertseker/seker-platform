/**
 * Ödemeler tablosunu okulun "AİDAT LİSTESİ" defterinin düzeninde .xlsx'e çevirir.
 * Sayfa 1 "Tutarlar": planlanan tutarlar (TL, sayı). Sayfa 2 "Durum": aynı ızgarada ödeme durumu.
 * Sayfa 3 "Gecikenler": yalnız gecikeni olan öğrenciler. Renk yok (xlsx topluluk sürümü stil yazmaz);
 * durum metinle verilir.
 */
import * as XLSX from "xlsx";
import { sideCellOf, SIDE_COLUMNS, type MatrixCell, type MatrixRow, type SideColumn } from "@/lib/payment-matrix";
import { overdueKurusOf, seasonSummaryOf } from "@/lib/payments-summary";

const SIDE_HEADERS: Record<SideColumn, string> = {
  kitap: "KİTAP - KIRTASİYE",
  aidat: "AİDAT TUTARI",
  servis: "SERVİS TUTARI",
};

const monthFormatter = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "Europe/Istanbul" });

/** "2026-09" -> "EYLÜL 2026" */
export function excelMonthLabel(monthKey: string) {
  return monthFormatter.format(new Date(`${monthKey}-01T12:00:00+03:00`)).toLocaleUpperCase("tr");
}

const tl = (kurus: number) => Math.round(kurus) / 100;

const trNumber = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });

/** Hücre durumu metni: Ödendi / Nakit ödendi / Kısmi (ödenen / toplam) / Gecikti / Bekliyor. */
export function cellStatusText(cell: MatrixCell | null | undefined): string {
  if (!cell || cell.state === "bos") return "";
  // Tek taksit eksik ödendiğinde matris hücreyi "ödendi" sayar; dosyada kalan görünsün diye kısmi yazılır.
  const state = cell.state === "odendi" && cell.paidKurus < cell.totalKurus ? "kismi" : cell.state;
  switch (state) {
    case "odendi":
      return cell.cash ? "Nakit ödendi" : "Ödendi";
    case "kismi":
      return `Kısmi (${trNumber.format(tl(cell.paidKurus))} / ${trNumber.format(tl(cell.totalKurus))})`;
    case "gecikti":
      return "Gecikti";
    default:
      return "Bekliyor";
  }
}

function amountOf(cell: MatrixCell | null | undefined): number | string {
  return cell && cell.state !== "bos" ? tl(cell.totalKurus) : "";
}

export interface ExcelInput {
  season: string;
  months: string[];
  rows: MatrixRow[];
  phoneById: Map<string, string | null>;
  generatedOn: string; // YYYY-MM-DD
  filterLabel: string;
}

export function buildPaymentsWorkbook(input: ExcelInput): XLSX.WorkBook {
  const { season, months, rows, phoneById, generatedOn, filterLabel } = input;
  const headers = [
    "SIRA",
    "ÖĞRENCİ",
    "ANNE & BABA",
    ...SIDE_COLUMNS.map((c) => SIDE_HEADERS[c]),
    ...months.map(excelMonthLabel),
    "TOPLAM",
    "ÖDENEN",
    "KALAN",
  ];
  const title = [`Şeker Anaokulu — ${season} aidat listesi (${filterLabel}) · ${generatedOn}`];

  // 1) Tutarlar
  const amountRows = rows.map((row, i) => [
    i + 1,
    row.fullName,
    row.parentName ?? "",
    ...SIDE_COLUMNS.map((c) => amountOf(sideCellOf(row, c))),
    ...months.map((m) => amountOf(row.cells[m])),
    tl(row.totalKurus),
    tl(row.paidKurus),
    tl(row.remainingKurus),
  ]);
  const summary = seasonSummaryOf(rows);
  const sum = (pick: (row: MatrixRow) => MatrixCell | null | undefined) =>
    tl(rows.reduce((s, row) => s + (pick(row)?.totalKurus ?? 0), 0));
  const totalRow = [
    "",
    "TOPLAM",
    "",
    ...SIDE_COLUMNS.map((c) => sum((row) => sideCellOf(row, c))),
    ...months.map((m) => sum((row) => row.cells[m])),
    tl(summary.totalKurus),
    tl(summary.paidKurus),
    tl(summary.remainingKurus),
  ];
  const amounts = XLSX.utils.aoa_to_sheet([title, [], headers, ...amountRows, totalRow]);

  // 2) Durum
  const statusRows = rows.map((row, i) => [
    i + 1,
    row.fullName,
    row.parentName ?? "",
    ...SIDE_COLUMNS.map((c) => cellStatusText(sideCellOf(row, c))),
    ...months.map((m) => cellStatusText(row.cells[m])),
    tl(row.totalKurus),
    tl(row.paidKurus),
    tl(row.remainingKurus),
  ]);
  const status = XLSX.utils.aoa_to_sheet([title, [], headers, ...statusRows]);

  // 3) Gecikenler
  const overdueRows = rows
    .filter((row) => row.hasOverdue)
    .map((row) => [row.fullName, row.parentName ?? "", phoneById.get(row.studentId) ?? "", tl(overdueKurusOf([row]))])
    .sort((a, b) => Number(b[3]) - Number(a[3]));
  const overdue = XLSX.utils.aoa_to_sheet([
    title,
    [],
    ["ÖĞRENCİ", "ANNE & BABA", "TELEFON", "GECİKEN TUTAR"],
    ...overdueRows,
    ["TOPLAM", "", "", tl(overdueKurusOf(rows))],
  ]);

  const widths = [{ wch: 6 }, { wch: 24 }, { wch: 24 }, ...headers.slice(3).map(() => ({ wch: 14 }))];
  amounts["!cols"] = widths;
  status["!cols"] = widths;
  overdue["!cols"] = [{ wch: 24 }, { wch: 24 }, { wch: 16 }, { wch: 14 }];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, amounts, "Tutarlar");
  XLSX.utils.book_append_sheet(book, status, "Durum");
  XLSX.utils.book_append_sheet(book, overdue, "Gecikenler");
  return book;
}

export function workbookToBuffer(book: XLSX.WorkBook): Buffer {
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
