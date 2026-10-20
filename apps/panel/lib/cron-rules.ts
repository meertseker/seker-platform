import type { LeadStatus } from "./constants";
import { tlToKurus } from "./money";

/** Kural §8.1: takipsizlik kontrolüne giren açık lead durumları. */
export type StaleLeadStatus = Extract<
  LeadStatus,
  "yeni" | "ulasildi" | "randevu" | "gorusme_yapildi" | "teklif"
>;

// randevu da listede (H1/H7): ziyareti sonuçlanmamış ya da iptal edilmiş veli sessiz kalınca görünsün.
export const STALE_LEAD_STATUSES: StaleLeadStatus[] = [
  "yeni",
  "ulasildi",
  "randevu",
  "gorusme_yapildi",
  "teklif",
];

/** `days` gün önceye denk gelen ISO zaman damgasını üretir (spec §8.1 son işlem eşiği). */
export function staleCutoffIso(now: Date | string, days: number): string {
  const nowMs = typeof now === "string" ? new Date(now).getTime() : now.getTime();
  return new Date(nowMs - days * 86400000).toISOString();
}

/** Europe/Istanbul takvim gününü YYYY-MM-DD olarak döner. */
export function istanbulDateString(now: Date | string = new Date()): string {
  const date = typeof now === "string" ? new Date(now) : now;
  return date.toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
}

/** spec §8.5: özet yalnızca İstanbul saatiyle pazartesi günü gönderilir. */
export function isIstanbulMonday(now: Date | string = new Date()): boolean {
  const date = typeof now === "string" ? new Date(now) : now;
  return (
    date.toLocaleDateString("en-US", {
      timeZone: "Europe/Istanbul",
      weekday: "short",
    }) === "Mon"
  );
}

/** Geciken taksit satırlarının (TL) toplamını kuruş cinsinden döner (spec §8.5). */
export function overdueTotalKurus(rows: { amount: number | string }[]): number {
  return rows.reduce((sum, row) => sum + tlToKurus(Number(row.amount)), 0);
}
