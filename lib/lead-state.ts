import type { LeadStatus } from "./constants";

const FLOW: LeadStatus[] = ["yeni", "ulasildi", "randevu", "gorusme_yapildi", "teklif", "kazanildi"];

export function requiresLostReason(to: LeadStatus): boolean {
  return to === "kaybedildi";
}
export function reopenTarget(): "ulasildi" {
  return "ulasildi";
}

export function canTransition(
  from: LeadStatus, to: LeadStatus, opts: { converted: boolean }
): { ok: true } | { ok: false; reason: string } {
  if (opts.converted) return { ok: false, reason: "Öğrenciye dönüştürülmüş lead kilitlidir" };
  if (from === to) return { ok: false, reason: "Durum zaten bu" };
  if (to === "kaybedildi") return { ok: true };
  if (from === "kaybedildi") {
    return to === reopenTarget()
      ? { ok: true }
      : { ok: false, reason: "Kaybedilen lead yalnızca 'Ulaşıldı' olarak yeniden açılabilir" };
  }
  // ileri veya geri geçiş FLOW içinde serbest (spec §6.1)
  if (FLOW.includes(from) && FLOW.includes(to)) return { ok: true };
  return { ok: false, reason: "Geçersiz durum geçişi" };
}
