// Raporun indirilmesi: bölüm başına CSV (Türkçe Excel'in açtığı biçim: UTF-8 BOM, ";" ayraç, ondalık virgül) ve
// bölüm başına bir sayfalık .xlsx. Kaynak, ekrandaki tabloların aynısıdır (`sectionTables`).
import * as XLSX from "xlsx";
import { SECTION_TITLES, sectionTables, type Report, type SectionId } from "./build";
import type { Cell, Column, ReportTable, Row } from "./table";

const UNIT: Partial<Record<Column["kind"], string>> = { tl: "₺", pct: "%", minutes: "dk", days: "gün" };

/** Dosya başlığındaki kolon adı birimiyle: "Harcama (₺)". */
export function headerOf(c: Column): string {
  const unit = UNIT[c.kind];
  return unit ? `${c.label} (${unit})` : c.label;
}

/** Ham değer → dosyadaki sayı: tutar kuruştan TL'ye, oran yüzdeye (CSV) ya da 0–1 (Excel, yüzde biçimiyle). */
function numberFor(value: number, kind: Column["kind"], target: "csv" | "xlsx"): number {
  if (kind === "tl") return Math.round(value) / 100;
  if (kind === "pct") return target === "csv" ? Math.round(value * 1000) / 10 : value;
  if (kind === "days") return Math.round(value * 10) / 10;
  if (kind === "minutes") return Math.round(value);
  return value;
}

/** Hücre metni formül gibi başlıyorsa (=, +, -, @) tek tırnakla etkisizleştirilir (arama kelimesi dışarıdan gelir). */
export function safeText(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

const csvNumber = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2, useGrouping: false });

function csvCell(value: Cell | undefined, kind: Column["kind"]): string {
  if (value == null) return "";
  if (typeof value === "number") return csvNumber.format(numberFor(value, kind, "csv"));
  const text = safeText(value);
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvLines(table: ReportTable): string[] {
  const line = (row: Row) => table.columns.map((c) => csvCell(row[c.key], c.kind)).join(";");
  return [
    csvCell(table.title, "text"),
    table.columns.map((c) => csvCell(headerOf(c), "text")).join(";"),
    ...table.rows.map(line),
    ...(table.total ? [line(table.total)] : []),
  ];
}

export function tablesToCsv(tables: ReportTable[], heading: string[]): string {
  const blocks = tables.map((t) => csvLines(t).join("\r\n"));
  return `﻿${[...heading.map((h) => csvCell(h, "text")), "", blocks.join("\r\n\r\n")].join("\r\n")}\r\n`;
}

const FORMATS: Partial<Record<Column["kind"], string>> = {
  tl: '#,##0.00 "₺"',
  pct: "0.0%",
  int: "#,##0",
  minutes: "#,##0",
  days: "0.0",
};

type XCell = string | number | { t: "n"; v: number; z: string } | null;

function xlsxCell(value: Cell | undefined, kind: Column["kind"]): XCell {
  if (value == null) return null;
  if (typeof value === "string") return value;
  const z = FORMATS[kind];
  const v = numberFor(value, kind, "xlsx");
  return z ? { t: "n", v, z } : v;
}

function sheetFor(title: string, tables: ReportTable[], heading: string[]): XLSX.WorkSheet {
  const rows: XCell[][] = [[title], ...heading.map((h) => [h]), []];
  let widest = 0;
  for (const table of tables) {
    widest = Math.max(widest, table.columns.length);
    rows.push([table.title]);
    rows.push(table.columns.map(headerOf));
    for (const row of table.rows) rows.push(table.columns.map((c) => xlsxCell(row[c.key], c.kind)));
    if (table.total) rows.push(table.columns.map((c) => xlsxCell(table.total?.[c.key], c.kind)));
    if (table.rows.length === 0 && table.emptyText) rows.push([table.emptyText]);
    rows.push([]);
  }
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = Array.from({ length: Math.max(widest, 1) }, (_, i) => ({ wch: i === 0 ? 34 : 18 }));
  return sheet;
}

export type ReportFile = { body: Uint8Array | string; fileName: string; contentType: string };

function headingFor(report: Report, generatedOn: string): string[] {
  return [
    `Dönem: ${report.period.label}`,
    `Karşılaştırma: ${report.period.prev.label}`,
    `Oluşturulma: ${generatedOn}`,
  ];
}

function fileStem(report: Report, part: string): string {
  return `seker-rapor-${part}-${report.period.from}-${report.period.to}`.replace(/[^A-Za-z0-9._-]/g, "-");
}

/** `bolum` = bölüm anahtarı ya da "tum". Rolün göremediği bölüm istenirse null (404). Tüm rapor yalnız Excel. */
export function reportFile(report: Report, bolum: string, bicim: "csv" | "xlsx", generatedOn: string): ReportFile | null {
  const sections = sectionTables(report);
  const heading = headingFor(report, generatedOn);
  const picked = bolum === "tum" ? sections : sections.filter((s) => s.id === bolum);
  if (picked.length === 0) return null;

  if (bicim === "csv") {
    const tables = picked.flatMap((s) => s.tables);
    const title = bolum === "tum" ? "Şeker Anaokulu raporu" : `Şeker Anaokulu raporu · ${SECTION_TITLES[bolum as SectionId]}`;
    return {
      body: tablesToCsv(tables, [title, ...heading]),
      fileName: `${fileStem(report, bolum)}.csv`,
      contentType: "text/csv; charset=utf-8",
    };
  }

  const book = XLSX.utils.book_new();
  for (const s of picked) {
    XLSX.utils.book_append_sheet(book, sheetFor(`Şeker Anaokulu raporu · ${s.title}`, s.tables, heading), s.title.slice(0, 31));
  }
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return {
    body: new Uint8Array(buffer),
    fileName: `${fileStem(report, bolum)}.xlsx`,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}
