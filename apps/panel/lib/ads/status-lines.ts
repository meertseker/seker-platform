import type { AdsConfig } from "@/lib/ads/config";

/** /pazarlama sayfasındaki iki durum satırı: harcama kaynağı ve dönüşüm bildirimi. */
export function adsStatusLines(config: AdsConfig | null): { spend: string; conversion: string } {
  return {
    spend: config
      ? "her sabah 06:00'da otomatik"
      : "Google Ads bağlantısı yok — harcamayı CSV ile yükleyin",
    conversion: config
      ? "açık"
      : "kapalı (Google bağlantısı kurulmadı); bekleyen kayıtlar bağlantı kurulunca gönderilir",
  };
}
