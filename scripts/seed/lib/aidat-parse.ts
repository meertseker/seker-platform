/**
 * Aidat çalışma kitabının "2026 - 2027" sayfasındaki bir satırı, insan onayı için
 * CSV'ye yazılacak yapıya çevirir. Saf fonksiyonlar — dosya/DB erişimi YOK.
 *
 * KOLONLAR (2026 - 2027 sayfası, 0-index):
 *   0 ÖĞRENCİ ADI VE SOYADI | 1 ANNE & BABA ADI | 2 KİTAP - KIRTASİYE
 *   3 AİDAT TUTARI | 4 (boş) | 5 SERVİS TUTARI  (6..17 aylık defter — YOK SAYILIR)
 */
import { PROGRAMS, type Program } from "../../../lib/constants";

export const SEASON = "2026-2027";

const ANNUAL_LUMP_THRESHOLD = 100000; // bundan büyük tek sayı yıllık kabul edilir
const TAM_MONTHLY_THRESHOLD = 25000; // aylık >= bu -> tam_gun (tek etiketli veri noktası: 25000=tam, 23000=yarım)

export type ParsedAidat = {
  monthlyTl: number | null;
  program: Program | null;
  programNote: string;
  note: string;
};

/** Bir sayı metnini TL'ye çevirir ("45.000" / "45000" / 45000 -> 45000). Aksi halde null. */
export function parseTl(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? raw : null;
  const s = String(raw ?? "").trim();
  if (!s) return null;
  // "23.000" (binlik nokta) ve "23,5" (ondalık virgül) karışık olabilir; sadece rakamları al.
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function inferProgram(monthlyTl: number | null, hasTamText: boolean): Program | null {
  if (hasTamText) return "tam_gun";
  if (monthlyTl === null) return null;
  return monthlyTl >= TAM_MONTHLY_THRESHOLD ? "tam_gun" : "yarim_gun";
}

export function parseAidatCell(rawAidat: unknown): ParsedAidat {
  // Sayısal hücre: büyükse yıllık (÷10), küçükse aylık.
  if (typeof rawAidat === "number" && rawAidat > 0) {
    const monthly = rawAidat >= ANNUAL_LUMP_THRESHOLD ? rawAidat / 10 : rawAidat;
    return { monthlyTl: monthly, program: inferProgram(monthly, false), programNote: "guess: aidat", note: "" };
  }
  const s = String(rawAidat ?? "").trim();
  if (!s) return { monthlyTl: null, program: null, programNote: "", note: "" };

  // "23.000 Y - 28.000 TAM" gibi metin: TAM figürünü aylık al, ham metni not'a koy.
  const hasTam = /TAM/i.test(s);
  const nums = [...s.matchAll(/\d[\d.]*/g)].map((m) => Number(m[0].replace(/\./g, ""))).filter((n) => n > 0);
  if (hasTam && nums.length > 0) {
    const monthly = Math.max(...nums); // TAM figürü genelde en büyüğü
    return { monthlyTl: monthly, program: "tam_gun", programNote: "guess: 'TAM' metni", note: s };
  }
  // ÜCRETSİZ / burslu / '?' vb. — tutar/program yok, ham metni sakla.
  return { monthlyTl: null, program: null, programNote: "", note: s };
}

export type RosterRow = {
  source_row: number;
  full_name: string;
  parent_name: string;
  program: Program | null;
  program_note: string;
  season: string;
  aidat_monthly: number | null;
  servis_monthly: number | null;
  kitap_amount: number | null;
  note: string;
};

export function buildRosterRow(excelRow: unknown[], sourceRow: number): RosterRow | null {
  const full_name = String(excelRow[0] ?? "").trim();
  if (!full_name) return null;
  const parent_name = String(excelRow[1] ?? "").trim();
  const parsed = parseAidatCell(excelRow[3]);
  const kitap_amount = parseTl(excelRow[2]);
  const servis_monthly = parseTl(excelRow[5]);

  const notes: string[] = [];
  if (parsed.note) notes.push(`aidat_ham: ${parsed.note}`);

  return {
    source_row: sourceRow,
    full_name,
    parent_name,
    program: parsed.program,
    program_note: parsed.programNote,
    season: SEASON,
    aidat_monthly: parsed.monthlyTl,
    servis_monthly,
    kitap_amount,
    note: notes.join(" | "),
  };
}

// PROGRAMS importunun kullanıldığından emin ol (tip güvenliği + geçerli enum kontrolü ileride).
void PROGRAMS;
