import type { AdsConfig } from "@/lib/ads/config";
import type { MetaConfig } from "@/lib/ads/meta/config";

/** /pazarlama sayfasındaki durum satırları: Google ve Instagram için harcama kaynağı ile dönüşüm bildirimi. */
export function adsStatusLines(
  google: AdsConfig | null,
  meta: MetaConfig | null = null,
): { spend: string; conversion: string; metaSpend: string; metaConversion: string } {
  return {
    spend: google
      ? "her sabah 06:00'da otomatik"
      : "Google Ads bağlantısı yok — harcamayı CSV ile yükleyin",
    conversion: google
      ? "açık"
      : "kapalı (Google bağlantısı kurulmadı); bekleyen kayıtlar bağlantı kurulunca gönderilir",
    metaSpend: meta
      ? "her sabah 06:00'da otomatik (son 7 gün)"
      : "Instagram bağlantısı yok — Meta hesabı kurulunca her sabah 06:00'da otomatik",
    metaConversion: !meta
      ? "kapalı (Meta bağlantısı yok)"
      : meta.capiEnabled
        ? "açık"
        : "kapalı (hukuk onayı bekleniyor · META_CAPI_ENABLED)",
  };
}
