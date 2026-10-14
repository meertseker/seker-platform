/**
 * Zehra Hanım'ın aidat defteri boyası + yorumu → tahsilat gerçeği.
 * Saf fonksiyonlar; dosya/DB yok.
 *
 *   yeşil 92D050 / 00B050 → ödendi (kart veya karışık)
 *   mor   7030A0           → ödendi (nakit)
 *   kırmızı FF0000         → bekliyor
 *   koyu gri (theme 0)     → kısmi
 *   renk yok               → plan; henüz tahsilat yok
 */
import type { PaymentMethod } from "../../../lib/constants";

export type ExcelPayStatus = "odendi" | "bekliyor" | "kismi" | "plansiz";

export interface ExcelPayFact {
  status: "odendi" | "bekliyor" | "kismi";
  paidTl: number;
  remainingTl: number;
  method: PaymentMethod;
  paidOn: string | null;
}

const PAID_LINE = /\bOK\b|ALINDI|ÇEKİLDİ|CEKILDI|ÖDENDİ|ODENDI|MAHSUP/i;
const AMOUNT = /(\d{1,3}(?:\.\d{3})+|\d{4,})(?:\s*(?:TL|₺))?/gi;

export function fillToStatus(fill: string | null | undefined): ExcelPayStatus {
  if (!fill) return "plansiz";
  const key = fill.toUpperCase();
  if (key === "92D050" || key === "00B050" || key === "7030A0" || key === "THEME5") return "odendi";
  if (key === "FF0000") return "bekliyor";
  if (key === "GRAY") return "kismi";
  return "plansiz";
}

function parseTl(raw: string) {
  return Number(raw.replace(/\./g, ""));
}

function amountsOn(line: string, skipKalan: boolean) {
  const out: number[] = [];
  AMOUNT.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = AMOUNT.exec(line))) {
    const n = parseTl(match[1]);
    if (n < 1000) continue;
    if (skipKalan) {
      const before = line.slice(0, match.index).toLocaleUpperCase("tr");
      if (/KALAN\s*$/.test(before.trimEnd()) || /KALAN\s+$/.test(before)) continue;
    }
    out.push(n);
  }
  return out;
}

/** "KALAN 15.500₺" (soru işaretsiz) → kalan tutar. */
export function remainingFromNote(note: string | null | undefined): number | null {
  if (!note) return null;
  const matches = [...note.matchAll(/KALAN\s+(\d{1,3}(?:\.\d{3})+|\d{4,})\s*(?:TL|₺)?(\s*\?)?/gi)];
  for (const match of matches.reverse()) {
    if (match[2]) continue;
    const lineStart = note.lastIndexOf("\n", match.index);
    const lineEnd = note.indexOf("\n", match.index);
    const line = note.slice(lineStart + 1, lineEnd === -1 ? note.length : lineEnd);
    if (/TAKS[Iİ]T|AKTAR/i.test(line)) continue;
    return parseTl(match[1]);
  }
  return null;
}

/** Yorumdaki "… OK / alındı" satırlarından tahsil toplamı. */
export function paidFromNote(note: string | null | undefined, cellTl: number): number | null {
  if (!note || cellTl <= 0) return null;
  const remaining = remainingFromNote(note);
  const mixedLedger = /A[Iİ]DAT/i.test(note) && /KIRTAS[Iİ]YE|K[Iİ]TAP/i.test(note);
  if (mixedLedger) {
    const first = note.match(/1\.\s*TAKS[Iİ]T[^\n]*?(\d{1,3}(?:\.\d{3})+|\d{4,})/i);
    if (first) return Math.min(parseTl(first[1]), cellTl);
  }
  if (remaining !== null && remaining > 0 && remaining < cellTl) {
    return cellTl - remaining;
  }

  let sum = 0;
  let found = false;
  for (const line of note.split(/\n+/)) {
    if (!PAID_LINE.test(line)) continue;
    for (const n of amountsOn(line, true)) {
      sum += n;
      found = true;
    }
  }
  if (!found) return null;
  return Math.min(sum, cellTl);
}

export function methodFromNote(note: string | null | undefined): PaymentMethod {
  const text = (note ?? "").toLocaleUpperCase("tr");
  if (/NAK[Iİ]T/.test(text)) return "nakit";
  if (/YKB|POS|KART/.test(text)) return "pos";
  return "diger";
}

/** Yorumdaki son tahsilat tarihi (GG/AA/YY veya GG/AA/YYYY). */
export function paidOnFromNote(note: string | null | undefined): string | null {
  if (!note) return null;
  const dates = [...note.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g)];
  if (!dates.length) return null;
  const last = dates[dates.length - 1];
  const day = last[1].padStart(2, "0");
  const month = last[2].padStart(2, "0");
  const year = last[3].length === 2 ? `20${last[3]}` : last[3];
  return `${year}-${month}-${day}`;
}

/**
 * Hücre boyası + yorum → CRM'e yazılacak tahsilat.
 * Renk yoksa tahsilat yok sayılır (Ekim–Haziran plan rakamları).
 */
export function factFromCell(
  cellTl: number,
  fill: string | null | undefined,
  note: string | null | undefined,
): ExcelPayFact | null {
  if (!Number.isFinite(cellTl) || cellTl <= 0) return null;
  const paint = fillToStatus(fill);
  const method = methodFromNote(note);
  const paidOn = paidOnFromNote(note);

  if (paint === "odendi") {
    return { status: "odendi", paidTl: cellTl, remainingTl: 0, method, paidOn };
  }
  if (paint === "bekliyor" || paint === "plansiz") {
    return { status: "bekliyor", paidTl: 0, remainingTl: cellTl, method: "diger", paidOn: null };
  }

  const parsed = paidFromNote(note, cellTl);
  if (parsed === null || parsed <= 0) {
    return { status: "bekliyor", paidTl: 0, remainingTl: cellTl, method: "diger", paidOn: null };
  }
  if (parsed >= cellTl) {
    return { status: "odendi", paidTl: cellTl, remainingTl: 0, method, paidOn };
  }
  return { status: "kismi", paidTl: parsed, remainingTl: cellTl - parsed, method, paidOn };
}
