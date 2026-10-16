import type { ConversionAction } from "@/lib/constants";

/** Google Ads API sürümü tek yerde. Google yılda birkaç sürüm çıkarır; yükseltirken yalnızca burası değişir. */
export const GOOGLE_ADS_API_VERSION = "v25";

export interface AdsConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  customerId: string;
  loginCustomerId: string | null;
  conversionActionIds: Record<ConversionAction, string>;
}

function digits(value: string | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * Reklam entegrasyonu için gereken env değerlerini okur.
 * OAuth üçlüsü, müşteri ID'si veya dönüşüm aksiyonu ID'lerinden biri eksikse null (entegrasyon kapalı).
 * Geliştirici belirteci (developer token) 9 Eylül 2026'da kaldırıldı; erişim düzeyi artık OAuth istemcisinin
 * Google Cloud projesinden gelir. GOOGLE_ADS_DEVELOPER_TOKEN artık okunmaz.
 */
export function readAdsConfig(
  env: Record<string, string | undefined> = process.env,
): AdsConfig | null {
  const clientId = env.GOOGLE_ADS_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.GOOGLE_ADS_CLIENT_SECRET?.trim() ?? "";
  const refreshToken = env.GOOGLE_ADS_REFRESH_TOKEN?.trim() ?? "";
  const customerId = digits(env.GOOGLE_ADS_CUSTOMER_ID);
  const randevu = digits(env.GOOGLE_ADS_CONVERSION_ACTION_RANDEVU);
  const kayit = digits(env.GOOGLE_ADS_CONVERSION_ACTION_KAYIT);
  const login = digits(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);

  if (!clientId || !clientSecret || !refreshToken || !customerId || !randevu || !kayit) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    refreshToken,
    customerId,
    loginCustomerId: login || null,
    conversionActionIds: { randevu, kayit },
  };
}
