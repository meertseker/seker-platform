import type {
  AppointmentOutcome,
  LeadStatus,
  OfferStatus,
} from "@/lib/constants";

/*
 * Merkezi durum → renk haritası. Tüm rozetler bu sınıfları kullanır ki
 * aynı durum her ekranda aynı renkte görünsün. Tüm eşleşmeler beyaz
 * zeminde 4.5:1 kontrastı sağlayan koyu metin tonları kullanır ve renk
 * tek başına anlam taşımaz (rozetlerde her zaman Türkçe etiket vardır).
 */

export const BADGE_BASE =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset";

export const LEAD_STATUS_STYLES: Record<LeadStatus, string> = {
  yeni: "bg-blue-50 text-blue-700 ring-blue-200",
  ulasildi: "bg-sky-50 text-sky-700 ring-sky-200",
  randevu: "bg-violet-50 text-violet-700 ring-violet-200",
  gorusme_yapildi: "bg-amber-50 text-amber-800 ring-amber-200",
  teklif: "bg-orange-50 text-orange-700 ring-orange-200",
  kazanildi: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  kaybedildi: "bg-red-50 text-red-700 ring-red-200",
};

export const OFFER_STATUS_STYLES: Record<OfferStatus, string> = {
  onay_bekliyor: "bg-amber-50 text-amber-800 ring-amber-200",
  onaylandi: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  revize_edildi: "bg-violet-50 text-violet-700 ring-violet-200",
  reddedildi: "bg-red-50 text-red-700 ring-red-200",
  gecersiz: "bg-slate-100 text-slate-600 ring-slate-200",
};

export const APPOINTMENT_OUTCOME_STYLES: Record<AppointmentOutcome, string> = {
  bekliyor: "bg-blue-50 text-blue-700 ring-blue-200",
  geldi: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  gelmedi: "bg-red-50 text-red-700 ring-red-200",
  ertelendi: "bg-amber-50 text-amber-800 ring-amber-200",
  iptal: "bg-slate-100 text-slate-600 ring-slate-200",
};

export const INSTALLMENT_STATUS_STYLES: Record<"bekliyor" | "odendi", string> = {
  bekliyor: "bg-slate-100 text-slate-600 ring-slate-200",
  odendi: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export const STUDENT_STATUS_STYLES: Record<
  "aktif" | "ayrildi" | "mezun",
  string
> = {
  aktif: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ayrildi: "bg-red-50 text-red-700 ring-red-200",
  mezun: "bg-blue-50 text-blue-700 ring-blue-200",
};

export function badgeClass(styles: string) {
  return `${BADGE_BASE} ${styles}`;
}
