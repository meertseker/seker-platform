// Z4 "Reklam testine al" penceresinin saf yardımcıları: düğmenin görünmesi, ana düğmenin açılması,
// gerekçe alanı, kontrol düzeltme bağlantıları ve eyleme giden seçenekler.
import type { AdTestView } from "./ad-test-context";
import { MIN_REASON, type PreflightItem, type PreflightResult } from "./preflight";

export { MIN_REASON };

export type AdTestItem = {
  id: string;
  code: string;
  kind: "reels" | "sayfa";
  stage: string;
  status: string;
  /** Sayfa içeriklerinde "instagram" | "google"; Google sayfası reklam testine alınmaz. */
  platform?: string | null;
};

export type AdTestOverride = { skip72h: boolean; reason: string };

export const SETTINGS_HREF = "/reklam/ayarlar";
export const MSG_WRITE_OFF = "Canlı yazım kapalı: yalnız 'Sadece göster' çalışır.";
export const MSG_EXISTING = "Bu içerik için reklam zaten kuruldu.";

const STAGES = new Set(["organik", "test"]);
const SETTINGS_FIXES = new Set(["Ayarlar'a git", "Kampanyaları kur"]);

/** Düğme yalnız onaylı ve organik/test aşamasındaki Instagram içeriğinde görünür. */
export function showAdTestButton(item: AdTestItem): boolean {
  return item.status === "onaylandi" && STAGES.has(item.stage) && item.platform !== "google";
}

export function reasonValid(reason: string): boolean {
  return reason.trim().length >= MIN_REASON;
}

/** Gerekçe alanı: 72 saat atlanıyorsa, kapı kırmızıysa ya da sunucu `needsReason` döndüyse. */
export function reasonNeeded(view: AdTestView, override: AdTestOverride, serverNeedsReason: boolean): boolean {
  return (view.needs72hOverride && override.skip72h) || view.gateRed.length > 0 || serverNeedsReason;
}

function redItems(checklist: PreflightResult): PreflightItem[] {
  return checklist.items.filter((x) => !x.ok);
}

/**
 * "Reklamı kur ve başlat" açık mı; kapalıysa düğme altındaki neden. Kontrol listesi yeşil olmalı; tek kırmızı
 * 72 saat (#2) ise "72 saati bekleme" + geçerli gerekçe onu geçer (son karar sunucuda). Kapı kırmızıysa gerekçe ister.
 */
export function canLaunch(
  view: AdTestView,
  override: AdTestOverride,
  serverNeedsReason = false,
): { enabled: boolean; blockText: string | null } {
  if (view.existing) return { enabled: false, blockText: MSG_EXISTING };
  const reds = redItems(view.checklist);
  const only72h = reds.length === 1 && reds[0].key === "yayin" && view.needs72hOverride;
  if (reds.length > 0 && !(only72h && override.skip72h && reasonValid(override.reason))) {
    return { enabled: false, blockText: only72h && override.skip72h ? reasonText() : (view.blockText ?? reds[0].label) };
  }
  if (!view.writeEnabled) return { enabled: false, blockText: MSG_WRITE_OFF };
  if (reasonNeeded(view, override, serverNeedsReason) && !reasonValid(override.reason)) {
    return { enabled: false, blockText: reasonText() };
  }
  return { enabled: true, blockText: null };
}

function reasonText(): string {
  return `Devam etmek için nedenini yazın (en az ${MIN_REASON} karakter).`;
}

/** Kırmızı maddenin düzeltmesi: Ayarlar'a giden bağlantı ya da düz metin. */
export function fixHref(fix: string | null): string | null {
  return fix && SETTINGS_FIXES.has(fix) ? SETTINGS_HREF : null;
}

/** "Kontrol listesi · <yeşil> / <toplam>" sayacı. */
export function checklistCount(checklist: PreflightResult): string {
  return `${checklist.items.filter((x) => x.ok).length} / ${checklist.items.length}`;
}

/** Kurulu reklamın kart etiketi: "Testte · reklam <id>" (+ inceleme durumu). */
export function existingLabel(existing: { adId: string; review: string | null }): string {
  return `Testte · reklam ${existing.adId}${existing.review ? ` · ${existing.review}` : ""}`;
}

/** `launchAdTest` seçenekleri; gerekçe yalnız doluysa, 72 saat atlaması yalnız gerekiyorsa gider. */
export function launchOptions(
  mode: "kur" | "goster",
  view: AdTestView,
  override: AdTestOverride,
  recommendationId?: string,
): { mode: "kur" | "goster"; reason?: string; skip72h?: boolean; recommendationId?: string } {
  const reason = override.reason.trim();
  return {
    mode,
    ...(reason ? { reason } : {}),
    ...(mode === "kur" && view.needs72hOverride && override.skip72h ? { skip72h: true } : {}),
    ...(recommendationId ? { recommendationId } : {}),
  };
}
