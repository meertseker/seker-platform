/**
 * Kayıtta kurulan ödeme planı — saf fonksiyon. Okulda konuşulan rakamlarla çalışır:
 * aylık aidat (ilk ay farklı olabilir) ya da yıllık peşin, ve kitap - kırtasiye ücreti
 * (1–4 taksit). Aylık aidat ilk vadeden sezon sonuna (Haziran) kadar sürer.
 */
import { addMonthsClamped, generateInstallments } from "@/lib/installments";

export type AidatMode = "aylik" | "pesin";

export interface EnrollmentInput {
  aidatMode: AidatMode;
  /** Aylık modda her ayın tutarı (kuruş). */
  monthlyKurus?: number;
  /** Aylık modda ilk ayın farklı tutarı (ör. ayın ortasında başlayan: yarım aidat). */
  firstMonthKurus?: number | null;
  /** Peşin modda yıllık tutar (kuruş). */
  annualKurus?: number;
  /** İlk vade "YYYY-MM-DD". */
  firstDueDate: string;
  /** Sezonun son ayı "YYYY-MM" (ör. "2027-06"). */
  lastMonth: string;
  kitapKurus?: number | null;
  kitapCount?: number;
}

export interface PlanDraft {
  itemType: "aidat" | "kitap";
  totalKurus: number;
  installmentCount: number;
  installments: { dueDate: string; amountKurus: number }[];
}

export type EnrollmentResult = { ok: true; plans: PlanDraft[] } | { ok: false; error: string };

/** "2026-2027" → "2027-06" */
export function seasonLastMonth(season: string) {
  const end = Number(season.split("-")[1]);
  return Number.isFinite(end) && end > 2000 ? `${end}-06` : null;
}

function monthsBetween(firstDueDate: string, lastMonth: string) {
  const [fy, fm] = firstDueDate.slice(0, 7).split("-").map(Number);
  const [ly, lm] = lastMonth.split("-").map(Number);
  return (ly - fy) * 12 + (lm - fm) + 1;
}

export function buildEnrollmentPlans(input: EnrollmentInput): EnrollmentResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.firstDueDate)) return { ok: false, error: "Geçerli bir ilk vade girin" };
  const plans: PlanDraft[] = [];

  if (input.aidatMode === "aylik") {
    const monthly = input.monthlyKurus ?? 0;
    if (!Number.isInteger(monthly) || monthly <= 0) return { ok: false, error: "Aylık aidatı girin" };
    const count = monthsBetween(input.firstDueDate, input.lastMonth);
    if (count < 1) return { ok: false, error: "İlk vade sezon bitmeden önce olmalı" };
    if (count > 12) return { ok: false, error: "Plan en fazla 12 ay olabilir" };
    const first = input.firstMonthKurus ?? null;
    if (first !== null && (!Number.isInteger(first) || first <= 0)) {
      return { ok: false, error: "İlk ay tutarı 0'dan büyük olmalı" };
    }
    const installments = Array.from({ length: count }, (_, index) => ({
      dueDate: addMonthsClamped(input.firstDueDate, index),
      amountKurus: index === 0 && first !== null ? first : monthly,
    }));
    plans.push({
      itemType: "aidat",
      totalKurus: installments.reduce((sum, item) => sum + item.amountKurus, 0),
      installmentCount: count,
      installments,
    });
  } else {
    const annual = input.annualKurus ?? 0;
    if (!Number.isInteger(annual) || annual <= 0) return { ok: false, error: "Yıllık tutarı girin" };
    plans.push({
      itemType: "aidat",
      totalKurus: annual,
      installmentCount: 1,
      installments: [{ dueDate: input.firstDueDate, amountKurus: annual }],
    });
  }

  const kitap = input.kitapKurus ?? 0;
  if (kitap > 0) {
    const count = input.kitapCount ?? 1;
    if (!Number.isInteger(count) || count < 1 || count > 4) {
      return { ok: false, error: "Kitap taksiti 1-4 arasında olmalı" };
    }
    const drafts = generateInstallments(kitap, count, input.firstDueDate);
    plans.push({
      itemType: "kitap",
      totalKurus: kitap,
      installmentCount: count,
      installments: drafts.map((draft) => ({ dueDate: draft.dueDate, amountKurus: draft.amountKurus })),
    });
  }

  return { ok: true, plans };
}
