import { createHmac } from "node:crypto";

/**
 * Meta Graph API sürümü tek yerde. En yeni sürüm v26.0 (29.07.2026).
 * Kaynak: https://developers.facebook.com/docs/graph-api/changelog/versions/
 * Google kodu v25'te kalır; o yükseltme bu aşamanın işi değil.
 */
export const META_GRAPH_API_VERSION = "v26.0";
export const META_GRAPH_BASE = "https://graph.facebook.com";

export interface MetaConfig {
  accessToken: string;
  appSecret: string;
  /** Her zaman "act_<rakam>". */
  adAccountId: string;
  pixelId: string | null;
  testEventCode: string | null;
  capiEnabled: boolean;
  /** Instagram işletme hesabı kimliği (META_INSTAGRAM_USER_ID); yoksa organik sayılar kapalı. */
  instagramUserId?: string | null;
  /** Instagram hesabının bağlı olduğu Facebook sayfası (META_FACEBOOK_PAGE_ID); yalnız bağlantı kartı okur. */
  facebookPageId?: string | null;
}

/**
 * Meta entegrasyonu için env değerlerini okur.
 * Erişim anahtarı, app secret ya da reklam hesabı eksikse null (entegrasyon kapalı, hata değil).
 * CAPI yalnız META_CAPI_ENABLED === "true" ve piksel varsa açılır.
 */
export function readMetaConfig(
  env: Record<string, string | undefined> = process.env,
): MetaConfig | null {
  const accessToken = env.META_ACCESS_TOKEN?.trim() ?? "";
  const appSecret = env.META_APP_SECRET?.trim() ?? "";
  const accountDigits = (env.META_AD_ACCOUNT_ID ?? "").replace(/\D/g, "");
  if (!accessToken || !appSecret || !accountDigits) return null;

  const pixelId = env.META_PIXEL_ID?.trim() || null;
  return {
    accessToken,
    appSecret,
    adAccountId: `act_${accountDigits}`,
    pixelId,
    testEventCode: env.META_CAPI_TEST_CODE?.trim() || null,
    capiEnabled: env.META_CAPI_ENABLED === "true" && pixelId !== null,
    instagramUserId: env.META_INSTAGRAM_USER_ID?.trim() || null,
    facebookPageId: env.META_FACEBOOK_PAGE_ID?.trim() || null,
  };
}

/**
 * Instagram içerik yayını bayrağı (spec K22). Yalnız "true" iken panel Reels'i Instagram'a gönderir;
 * ADS_WRITE_ENABLED'a bağlı değildir. Kapalıyken "Yayınla" yalnız ad_change_log satırı yazar.
 */
export function igPublishEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.IG_PUBLISH_ENABLED === "true";
}

/**
 * appsecret_proof = HMAC-SHA256(anahtar: app secret, ileti: erişim anahtarı), küçük harf hex.
 * Kaynak: https://developers.facebook.com/docs/graph-api/securing-requests/
 */
export function appSecretProof(accessToken: string, appSecret: string): string {
  return createHmac("sha256", appSecret).update(accessToken).digest("hex");
}
