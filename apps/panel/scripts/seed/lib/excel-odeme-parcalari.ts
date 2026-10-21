/**
 * Aidat defteri hücre YORUMU → ödeme parçaları (tarih, tutar, yöntem).
 * Saf fonksiyonlar; dosya/DB yok. Tahmin etmez: emin olamadığı her şeyi `belirsiz`e yazar.
 *
 * Yöntem (Mert, 21.10.2026):
 *   NAKİT                      → nakit
 *   POS / SANAL POS / KART      → pos
 *   YKB (tek başına), HESAB(A), HAVALE, EFT → havale (Yapı Kredi hesabına havale/EFT)
 *
 * Bir cümle ödeme sayılır: "OK", "ALINDI", "ÇEKİLDİ", "ÇEKİM(İ) YAPILDI", "ÖDENDİ" geçiyorsa
 * ve "?" içermiyorsa ("? TARİHİNDE … OK", "KALAN 8.000TL?" gerçekleşmemiş).
 */
import type { PaymentMethod } from "../../../lib/constants";

export type Method = Extract<PaymentMethod, "nakit" | "pos" | "havale">;

export interface Part {
  /** TL; null = cümleden çıkarılamadı (belirsiz). */
  amount: number | null;
  /** YYYY-MM-DD; null = tarih yok. */
  date: string | null;
  method: Method | null;
  raw: string;
}

export interface ParsedCell {
  parts: Part[];
  /** Uygulamayı durduran sorunlar (hücre elle karara gider). */
  belirsiz: string[];
  /** Bilgi / dikkat; uygulamayı durdurmaz. */
  uyari: string[];
  /** Bir ödeme birden çok kalemi/ayı/kardeşi kapsıyor; parça tutarı hücre tutarına indirildi. */
  birlesik: boolean;
}

const OK = /(^|[^A-ZÇĞİÖŞÜ])OK\b|NAK[İI]TOK|ALINDI|ÇEK[İI]LD[İI]|ÇEK[İI]M[İI]? YAPILDI|ÖDEND[İI]/;
const DATE = /(\d{1,2})[/.](\d{1,2})[/.](\d{4}|\d{2})(?!\d)/g;
/** "15.000TL", "15.000 TL", "500 TL", "29.500₺", ya da TL'siz binlik noktalı "15.000". */
const AMOUNT = /(^|[^\d.,%])(\d{1,3}(?:\.\d{3})+|\d+)\s*(TL|₺)?/g;
/** "4.00TL" gibi bozuk binlik yazımı. */
const MALFORMED = /(^|[^\d.])(\d{1,3})\.(\d{1,2})\s*(TL|₺)/;
const COMPLEX = /AKTAR|MAHSUP|DOLAR|\bUSD\b|\bEUR|[İI]ADE/;
const COMBINED = /TOPLAM|AYLIK|KARDEŞ|\+/;

export const upperTr = (s: string) => s.toLocaleUpperCase("tr");

function isoDate(d: string, m: string, y: string) {
  const year = y.length === 2 ? `20${y}` : y;
  return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function datesIn(seg: string) {
  return [...seg.matchAll(DATE)].map((m) => isoDate(m[1], m[2], m[3]));
}

/** Cümledeki TL tutarları (tarihler çıkarılmış). Binlik noktasız ve TL'siz sayılar (yıl, gün) sayılmaz. */
export function amountsIn(seg: string): number[] {
  const text = seg.replace(DATE, " ");
  const out: number[] = [];
  for (const m of text.matchAll(AMOUNT)) {
    const raw = m[2];
    const hasTl = !!m[3];
    const grouped = raw.includes(".");
    if (!hasTl && !grouped) continue;
    if (grouped && !/^\d{1,3}(\.\d{3})+$/.test(raw)) continue;
    const n = Number(raw.replace(/\./g, ""));
    if (n > 0) out.push(n);
  }
  return out;
}

export function methodOf(seg: string): { method: Method | null; conflict: boolean } {
  const t = upperTr(seg);
  const nakit = /NAK[İI]T/.test(t);
  const pos = /POS|KART/.test(t);
  const havale = !pos && /YKB|HESAB|HAVALE|\bEFT\b/.test(t);
  const hits = [nakit, pos, havale].filter(Boolean).length;
  if (hits > 1) return { method: null, conflict: true };
  return { method: nakit ? "nakit" : pos ? "pos" : havale ? "havale" : null, conflict: false };
}

/** Yorumu cümlelere böl: satır sonu ve ". " (tarih/tutar içindeki noktalar boşluksuz). */
export function segments(note: string): string[] {
  return note
    .replace(/\r/g, "")
    .split("\n")
    .flatMap((line) => line.split(/\.\s+/))
    .map((s) => s.replace(/^[\s*]+|[\s*]+$/g, ""))
    .filter(Boolean);
}

export interface CellInput {
  note: string | null;
  /** Hücredeki tutar (TL). */
  cellTl: number;
  fill: string | null;
  /** Hücrenin ayı (YYYY-MM); kitap/yıllık için null. */
  monthKey: string | null;
  /** Bu tarihten sonraki ödeme tarihleri belirsiz sayılır (YYYY-MM-DD). */
  today: string;
}

export function parseCell({ note, cellTl, fill, monthKey, today }: CellInput): ParsedCell {
  const out: ParsedCell = { parts: [], belirsiz: [], uyari: [], birlesik: false };
  const text = note ?? "";
  const upperNote = upperTr(text);
  let pendingDate: string | null = null;
  const malformed: { index: number; head: string; raw: string }[] = [];

  for (const seg of segments(text)) {
    const up = upperTr(seg);
    const dates = datesIn(seg);
    const amounts = amountsIn(seg);
    const hasOk = OK.test(up);

    if (!hasOk) {
      // "08/10/26 TARİHİNDE" tek başına → sonraki ödeme cümlesinin tarihi
      pendingDate = dates.length && !amounts.length ? dates[dates.length - 1] : null;
      continue;
    }
    if (seg.includes("?")) {
      out.uyari.push(`soru işaretli ödeme cümlesi sayılmadı: "${seg}"`);
      pendingDate = null;
      continue;
    }

    if (!amounts.length && !dates.length && !MALFORMED.test(seg)) {
      // "3 TAKSİT OK." gibi anlaşma cümlesi: ne tutar ne tarih var
      out.uyari.push(`tutarsız ve tarihsiz "OK" cümlesi ödeme sayılmadı: "${seg}"`);
      pendingDate = null;
      continue;
    }

    const date = dates.length ? dates[dates.length - 1] : pendingDate;
    pendingDate = null;
    const { method, conflict } = methodOf(seg);
    if (conflict) out.belirsiz.push(`birden çok yöntem geçiyor: "${seg}"`);
    else if (!method) out.belirsiz.push(`yöntem yazmıyor: "${seg}"`);
    if (!date) out.belirsiz.push(`tarih yok: "${seg}"`);
    else if (date > today) out.belirsiz.push(`tarih gelecekte (${date}): "${seg}"`);

    const distinct = [...new Set(amounts)];
    let amount: number | null = null;
    const bad = MALFORMED.exec(seg.replace(DATE, " "));
    if (distinct.length === 1) amount = distinct[0];
    else if (distinct.length > 1 && distinct.includes(cellTl) && COMBINED.test(up)) {
      amount = cellTl;
      out.birlesik = true;
      out.uyari.push(`birleşik ödeme, hücre payı ${cellTl} alındı: "${seg}"`);
    } else if (distinct.length > 1) {
      out.belirsiz.push(`cümlede birden çok tutar (${distinct.join(", ")}): "${seg}"`);
    } else if (bad) {
      malformed.push({ index: out.parts.length, head: bad[2], raw: `${bad[2]}.${bad[3]}${bad[4]}` });
    } else {
      out.belirsiz.push(`tutar yok: "${seg}"`);
    }
    out.parts.push({ amount, date, method, raw: seg });
  }

  // "4.00TL" → hücre tutarından diğer parçalar düşülünce kalan; ilk rakam tutuyorsa kabul.
  for (const m of malformed) {
    const others = out.parts.filter((_, i) => i !== m.index);
    const known = others.every((p) => p.amount !== null);
    const rest = cellTl - others.reduce((s, p) => s + (p.amount ?? 0), 0);
    if (known && malformed.length === 1 && rest > 0 && String(rest).startsWith(m.head)) {
      out.parts[m.index].amount = rest;
      out.uyari.push(`"${m.raw}" yazım hatası → ${rest} (hücre ${cellTl} − diğer parçalar)`);
    } else {
      out.belirsiz.push(`bozuk tutar "${m.raw}" bağlamdan çözülemedi`);
    }
  }

  // Tek ödeme cümlesi birden çok ay/kalem/kardeşi kapsıyor (ör. "46.000TL 2 AYLIK", "TOPLAM 48.600TL").
  if (
    out.parts.length === 1 &&
    out.parts[0].amount !== null &&
    out.parts[0].amount > cellTl &&
    COMBINED.test(upperNote)
  ) {
    out.uyari.push(`birleşik ödeme ${out.parts[0].amount}, hücre payı ${cellTl} alındı`);
    out.parts[0].amount = cellTl;
    out.birlesik = true;
  }

  if (COMPLEX.test(upperNote) && out.parts.length > 0) {
    out.belirsiz.push("yorumda aktarım / mahsup / iade / döviz var");
  }

  if (monthKey) {
    for (const p of out.parts) {
      if (p.date && p.date < `${monthKey}-01` && !/ERKEN/.test(upperNote)) {
        out.uyari.push(`tarih ${p.date} hücrenin ayından (${monthKey}) önce; yazıldığı gibi alındı`);
      }
    }
  }

  // Yorumsuz mor hücre: defterde mor = nakit kapandı.
  if (!out.parts.length && !text.trim() && fill?.toUpperCase() === "7030A0") {
    out.uyari.push("yorum yok; mor boya = nakit");
  }
  return out;
}

/** Yorumsuz mor hücre için beklenen yöntem (parça yoksa). */
export function fillMethod(fill: string | null): Method | null {
  return fill?.toUpperCase() === "7030A0" ? "nakit" : null;
}

/** İstanbul 12:00 → UTC 09:00 (mevcut içe aktarma düzeni). */
export function paidAtUtc(date: string) {
  return `${date} 09:00:00+00`;
}
