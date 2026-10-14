/**
 * "2026 - 2027 DÖNEMİ AİDAT LİSTESİ.xlsx" → öğrenci + ödeme planı taslağı.
 * Saf fonksiyonlar; dosya/DB erişimi YOK (bkz. docs/superpowers/specs/2026-09-12-*).
 *
 * KAYNAK KOLONLAR ("2026 - 2027" sayfası, 0-index):
 *   0 ÖĞRENCİ ADI VE SOYADI | 1 ANNE & BABA ADI | 2 KİTAP - KIRTASİYE
 *   3 AİDAT TUTARI (yıllık peşin) | 4 (boş) | 5 SERVİS TUTARI (kaynakta boş)
 *   6..17 TEMMUZ … HAZİRAN aylık defteri
 */
import { addMonthsClamped } from "../../../lib/installments";
import { tlToKurus, kurusToTl } from "../../../lib/money";
import { PROGRAMS, type Program } from "../../../lib/constants";

export const SHEET_NAME = "2026 - 2027";
export const SEASON = "2026-2027";
/** Aidat ve kitap planlarının ilk vadesi (Eylül). */
export const FIRST_DUE = "2026-09-05";
/** Plan ufku: Eylül–Haziran. */
export const PLAN_MONTHS = 10;
/** Aylık tutar bu eşiğin üstündeyse tam gün varsayılır (tek etiketli veri: 25.000 tam / 23.000 yarım). */
export const TAM_GUN_THRESHOLD = 25000;

export const COL = { name: 0, parents: 1, kitap: 2, annual: 3, servis: 5, firstMonth: 6 } as const;

/** Kolon 6'dan itibaren aylık defter başlıkları. Plan EYLÜL'den (index 2) başlar. */
export const MONTH_LABELS = [
  "temmuz", "agustos", "eylul", "ekim", "kasim", "aralik",
  "ocak", "subat", "mart", "nisan", "mayis", "haziran",
] as const;
const SEASON_START_INDEX = 2; // eylul

/** Plan aylarının etiketleri (Eylül…Haziran) — CSV başlıkları ve raporlar için. */
export const PLAN_MONTH_LABELS = MONTH_LABELS.slice(
  SEASON_START_INDEX,
  SEASON_START_INDEX + PLAN_MONTHS,
);

export type Cell = string | number | null | undefined;

/**
 * Hücreyi TL sayısına çevirir. Açık `0` korunur (ücretsiz ay), boş veya sayısal olmayan
 * ("?", "ÜCRETSİZ", "23.000 Y - 28.000 TAM") `null` döner.
 */
export function parseAmount(raw: Cell): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const s = String(raw ?? "").trim();
  if (!s || !/^\d[\d.\s]*$/.test(s)) return null;
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

/** Sayısal olmayan ama anlamlı hücre metnini (not olarak taşınmak üzere) döndürür. */
export function rawNote(raw: Cell): string | null {
  if (raw === null || raw === undefined || typeof raw === "number") return null;
  const s = String(raw).trim();
  return s ? s : null;
}

/**
 * Aylık defterden Eylül–Haziran için 10 elemanlı tutar dizisi üretir.
 * Boş bırakılan aylar, dolu olan son ayın tutarını devralır (Excel'de OCAK–HAZİRAN boş;
 * karar: ARALIK tutarı yıl sonuna kadar sürer).
 */
export function expandMonthlyAmounts(monthCells: Cell[]): (number | null)[] {
  const season = Array.from({ length: PLAN_MONTHS }, (_, i) => monthCells[SEASON_START_INDEX + i]);
  let carried: number | null = null;
  return season.map((cell) => {
    const parsed = parseAmount(cell);
    if (parsed !== null) carried = parsed;
    return parsed !== null ? parsed : carried;
  });
}

export type InstallmentDraft = {
  dueDate: string;
  amountTl: number;
  /** Eylül taksiti tahsil edilmiş kabul edilir (bkz. spec karar 1). */
  paid: boolean;
};

export type PlanDraft = {
  itemType: "aidat" | "kitap";
  totalTl: number;
  installmentCount: number;
  installments: InstallmentDraft[];
};

function makePlan(itemType: PlanDraft["itemType"], installments: InstallmentDraft[]): PlanDraft {
  const totalKurus = installments.reduce((sum, i) => sum + tlToKurus(i.amountTl), 0);
  return {
    itemType,
    totalTl: kurusToTl(totalKurus),
    installmentCount: installments.length,
    installments,
  };
}

/**
 * Aylık tutar dizisinden aidat planı kurar. Tutarı `0`/`null` olan ay için taksit
 * üretilmez (şema `amount > 0` şartı koyar); sadece Eylül taksiti ödenmiş işaretlenir.
 */
export function buildMonthlyAidatPlan(amounts: (number | null)[]): PlanDraft | null {
  const installments: InstallmentDraft[] = [];
  amounts.forEach((tl, index) => {
    if (tl === null || tl <= 0) return;
    installments.push({ dueDate: addMonthsClamped(FIRST_DUE, index), amountTl: tl, paid: index === 0 });
  });
  return installments.length ? makePlan("aidat", installments) : null;
}

/** Yıllık peşin aidat: tek taksit, Eylül vadeli, bekliyor. */
export function buildAnnualAidatPlan(annualTl: number): PlanDraft | null {
  if (annualTl <= 0) return null;
  return makePlan("aidat", [{ dueDate: FIRST_DUE, amountTl: annualTl, paid: false }]);
}

/** Kitap-kırtasiye: tek taksit, Eylül vadeli, bekliyor. */
export function buildKitapPlan(kitapTl: number): PlanDraft | null {
  if (kitapTl <= 0) return null;
  return makePlan("kitap", [{ dueDate: FIRST_DUE, amountTl: kitapTl, paid: false }]);
}

/** Referans aylık tutardan program tahmini. */
export function guessProgram(referenceMonthlyTl: number | null): Program | null {
  if (referenceMonthlyTl === null || referenceMonthlyTl <= 0) return null;
  return referenceMonthlyTl >= TAM_GUN_THRESHOLD ? "tam_gun" : "yarim_gun";
}

export type AidatMode = "aylik" | "yillik" | "yok";

export type StudentDraft = {
  sourceRow: number;
  fullName: string;
  parentName: string | null;
  mode: AidatMode;
  /** Eylül…Haziran, 10 eleman. `yillik`/`yok` modunda tamamı null. */
  monthlyAmounts: (number | null)[];
  annualTl: number | null;
  kitapTl: number | null;
  /** Program tahmininde kullanılan aylık referans tutar. */
  referenceMonthlyTl: number | null;
  guessedProgram: Program | null;
  plans: PlanDraft[];
  notes: string[];
};

/** Bir Excel satırını öğrenci taslağına çevirir. İsim boşsa `null` (satır atlanır). */
export function buildStudentDraft(row: Cell[], sourceRow: number): StudentDraft | null {
  const fullName = String(row[COL.name] ?? "").trim();
  if (!fullName) return null;

  const notes: string[] = [];
  const parentName = String(row[COL.parents] ?? "").trim() || null;

  const annualTl = parseAmount(row[COL.annual]);
  const monthCells = row.slice(COL.firstMonth, COL.firstMonth + MONTH_LABELS.length);
  const monthlyAmounts = expandMonthlyAmounts(monthCells);
  const hasMonthly = monthlyAmounts.some((v) => v !== null);

  // Aylık defter doluysa o kazanır: ÖMER GÜNEŞ satırında kolon 3 sayısal değil, sadece not.
  const mode: AidatMode = hasMonthly ? "aylik" : annualTl !== null ? "yillik" : "yok";

  const annualNote = rawNote(row[COL.annual]);
  if (annualNote && annualTl === null) notes.push(`aidat hücresi: ${annualNote}`);
  if (mode === "aylik" && annualTl !== null) {
    notes.push(`aidat hücresinde yıllık tutar da var: ${annualTl} (aylık defter kullanıldı)`);
  }
  if (mode === "yok") notes.push("aidat tutarı okunamadı — plan oluşturulmadı");
  if (monthlyAmounts[0] === 0) notes.push("Eylül tahsilatı yok/ücretsiz — Eylül taksiti oluşturulmadı");

  const kitapTl = parseAmount(row[COL.kitap]);
  const kitapNote = rawNote(row[COL.kitap]);
  if (kitapNote && kitapTl === null) notes.push(`kitap hücresi: ${kitapNote}`);

  const servisNote = rawNote(row[COL.servis]);
  if (servisNote || parseAmount(row[COL.servis]) !== null) {
    notes.push(`servis hücresi dolu: ${servisNote ?? row[COL.servis]}`);
  }

  const plans: PlanDraft[] = [];
  const aidatPlan =
    mode === "aylik"
      ? buildMonthlyAidatPlan(monthlyAmounts)
      : mode === "yillik" && annualTl !== null
        ? buildAnnualAidatPlan(annualTl)
        : null;
  if (aidatPlan) plans.push(aidatPlan);
  const kitapPlan = kitapTl !== null ? buildKitapPlan(kitapTl) : null;
  if (kitapPlan) plans.push(kitapPlan);

  const referenceMonthlyTl =
    mode === "aylik"
      ? ([...monthlyAmounts].reverse().find((v) => v !== null && v > 0) ?? null)
      : mode === "yillik" && annualTl !== null
        ? annualTl / PLAN_MONTHS
        : null;

  return {
    sourceRow,
    fullName,
    parentName,
    mode,
    monthlyAmounts: mode === "aylik" ? monthlyAmounts : monthlyAmounts.map(() => null),
    annualTl,
    kitapTl,
    referenceMonthlyTl,
    guessedProgram: guessProgram(referenceMonthlyTl),
    plans,
    notes,
  };
}

/** Sayfanın tamamını taslaklara çevirir (başlık satırı atlanır). */
export function buildStudentDrafts(rows: Cell[][], firstDataRow = 2): StudentDraft[] {
  return rows
    .map((row, index) => buildStudentDraft(row, firstDataRow + index))
    .filter((d): d is StudentDraft => d !== null);
}

/** İnsan onayı için üretilen CSV'nin kolon düzeni. */
export const CSV_HEADER = [
  "source_row",
  "full_name",
  "parent_name",
  "season",
  "mode",
  "program_guess",
  "reference_monthly_tl",
  "annual_tl",
  ...PLAN_MONTH_LABELS,
  "kitap_tl",
  "aidat_total_tl",
  "aidat_count",
  "aidat_sep_paid_tl",
  "note",
];

export function draftToCsvRow(d: StudentDraft): (string | number | null)[] {
  const aidat = d.plans.find((p) => p.itemType === "aidat");
  return [
    d.sourceRow,
    d.fullName,
    d.parentName,
    SEASON,
    d.mode,
    d.guessedProgram,
    d.referenceMonthlyTl,
    d.annualTl,
    ...d.monthlyAmounts,
    d.kitapTl,
    aidat?.totalTl ?? null,
    aidat?.installmentCount ?? null,
    aidat?.installments.find((i) => i.paid)?.amountTl ?? null,
    d.notes.join(" | "),
  ];
}

/**
 * Gözden geçirilmiş CSV satırını yeniden taslağa çevirir. Yüklemenin tek doğruluk
 * kaynağı CSV'dir: insan bir ay tutarını veya programı düzeltirse plan buna göre kurulur.
 */
export function draftFromCsvRow(o: Record<string, string>, fallbackRow: number): StudentDraft | null {
  const fullName = (o.full_name ?? "").trim();
  if (!fullName) return null;

  const monthlyAmounts = PLAN_MONTH_LABELS.map((label) => parseAmount(o[label]));
  const annualTl = parseAmount(o.annual_tl);
  const kitapTl = parseAmount(o.kitap_tl);
  const csvMode = (o.mode ?? "").trim();
  const mode: AidatMode =
    csvMode === "aylik" || csvMode === "yillik" || csvMode === "yok"
      ? csvMode
      : monthlyAmounts.some((v) => v !== null)
        ? "aylik"
        : annualTl !== null
          ? "yillik"
          : "yok";

  const plans: PlanDraft[] = [];
  const aidatPlan =
    mode === "aylik"
      ? buildMonthlyAidatPlan(monthlyAmounts)
      : mode === "yillik" && annualTl !== null
        ? buildAnnualAidatPlan(annualTl)
        : null;
  if (aidatPlan) plans.push(aidatPlan);
  if (kitapTl !== null) {
    const kitapPlan = buildKitapPlan(kitapTl);
    if (kitapPlan) plans.push(kitapPlan);
  }

  const programRaw = (o.program_guess ?? "").trim();
  const guessedProgram = programRaw in PROGRAMS ? (programRaw as Program) : null;

  return {
    sourceRow: Number(o.source_row) || fallbackRow,
    fullName,
    parentName: (o.parent_name ?? "").trim() || null,
    mode,
    monthlyAmounts,
    annualTl,
    kitapTl,
    referenceMonthlyTl: parseAmount(o.reference_monthly_tl),
    guessedProgram,
    plans,
    notes: (o.note ?? "").trim() ? [o.note.trim()] : [],
  };
}
