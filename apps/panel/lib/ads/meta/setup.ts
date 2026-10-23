// Meta kurulum adımları (kampanya, reklam seti, kreatif, reklam, kopya, durum) ve sıralı gönderici.
// Adım kurucular saftır: yalnız gönderilecek yükü tarif eder ("Sadece göster" listesi de bunlardan çıkar).
// Gönderici `runSetupSteps` canlı yazım kapısının (ADS_WRITE_ENABLED) arkasında çağrılır; burada kapı yok.
//
// Doğrulanan API bilgileri (kaynaklar):
// - Reels'i reklamda kullanma (object_id, instagram_user_id, source_instagram_media_id, call_to_action),
//   öne çıkarılamayan medya: https://developers.facebook.com/docs/instagram/ads-api/guides/use-posts-as-ads
// - instagram_actor_id kaldırıldı → instagram_user_id; dışlama excluded_custom_audiences:
//   https://developers.facebook.com/documentation/ads-commerce/marketing-api/marketing-api-changelog/version22.0.md
// - Kreatif url_tags (IG medya kreatifinde etkisi KISMEN):
//   https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-account/adcreatives
// - Kampanya (OUTCOME_LEADS, special_ad_categories, status ACTIVE/PAUSED):
//   https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-account/campaigns
// - Bütçe alt birimi (TRY ofset 100): https://developers.facebook.com/docs/marketing-api/currencies
// - custom_locations (1–80 km):
//   https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/reference/basic-targeting.md
// - Advantage+ kitle (advantage_audience 0/1):
//   https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/reference/targeting-expansion/advantage-audience
// - Reklam seti, optimizasyon hedefi (VARSAYIM: OFFSITE_CONVERSIONS):
//   https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-account/adsets
// - Reklam (POST /act_<id>/ads):
//   https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/partnership-ads/ads-creation/boost-existing-post.md
// - Kopya (POST /<ad_id>/copies → copied_ad_id):
//   https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/adgroup
// - Özel kitle: https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/guides/custom-audiences.md
// - İnceleme (effective_status, ad_review_feedback):
//   https://developers.facebook.com/docs/marketing-api/reference/adgroup-review-feedback/
// - Hesap (account_status, disable_reason, currency):
//   https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-account
import type { AdTemplate } from "../ad-template";
import type { FetchFn } from "../types";
import { appSecretProof, META_GRAPH_API_VERSION, META_GRAPH_BASE, type MetaConfig } from "./config";
import { headers, MetaApiError, sanitize, toApiError } from "./insights";

const SETUP_TIMEOUT_MS = 30_000;
const ID = /^\d{1,30}$/;
/** Düz yol: "act_<rakam>/<kenar>" ya da "<rakam>" ya da "<rakam>/<kenar>". */
const PLAIN_PATH = /^(act_\d{1,30}|\d{1,30})(\/[a-z_]+)?$/;
const SUFFIX = /^(\/[a-z_]+)?$/;

/**
 * Reklam seti optimizasyon hedefi. Spec B4 `LEAD` yazıyor; web formu + piksel için dokümanda `LEAD` değeri
 * görülmedi, masaüstü betiği `OFFSITE_CONVERSIONS` kullanıyor (VARSAYIM). Meta reddederse tek satır değişir.
 */
export const ADSET_OPTIMIZATION_GOAL = "OFFSITE_CONVERSIONS";

/**
 * TRY alt birimi (kuruş) çarpanı. Reklam seti için TEYİTLİ, kampanya bütçesi için TEYİTSİZ (çıkarım);
 * ilk gerçek yazımdan önce `metaGetDailyBudget` değeri Reklam Yöneticisi ile karşılaştırılır.
 * Kaynak: https://developers.facebook.com/docs/marketing-api/currencies
 */
export const TRY_MINOR_PER_TL = 100;

export function tlToMinor(tl: number): number {
  return Math.round(tl * TRY_MINOR_PER_TL);
}

export type Ref = { $ref: string };

/** Önceki adımın (anahtarı `key`) kimliğine işaret eder; gönderimde çözülür. */
export function ref(key: string): Ref {
  return { $ref: key };
}

export type SetupStep = {
  key: string;
  label: string;
  path: string | { ref: string; suffix: string };
  params: Record<string, unknown>;
  result: "id" | "copied_ad_id" | "success";
};

function isRef(value: unknown): value is Ref {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    typeof (value as Ref).$ref === "string"
  );
}

export function createCampaign(adAccountId: string, o: { key: string; name: string; dailyBudgetTl: number }): SetupStep {
  return {
    key: o.key,
    label: `Kampanya: ${o.name}`,
    path: `${adAccountId}/campaigns`,
    params: {
      name: o.name,
      objective: "OUTCOME_LEADS",
      status: "PAUSED",
      special_ad_categories: [],
      daily_budget: tlToMinor(o.dailyBudgetTl),
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    },
    result: "id",
  };
}

/**
 * Reklam setinin `targeting` yükü (kitle güncellemesinde yeniden gönderilir).
 * Geniş hedefleme: ilgi alanı yok, yalnız Instagram, Advantage+ kitle kapalı (1 iken yaş üst sınırı 65'e açılır).
 */
export function buildAdsetTargeting(template: AdTemplate, excludedAudience: string | Ref | null): Record<string, unknown> {
  if (template.lat === null || template.lng === null) throw new Error("Okul konumu eksik");
  const targeting: Record<string, unknown> = {
    geo_locations: {
      custom_locations: [
        { latitude: template.lat, longitude: template.lng, radius: template.yaricapKm, distance_unit: "kilometer" },
      ],
    },
    age_min: template.yasMin,
    age_max: template.yasMax,
    publisher_platforms: ["instagram"],
    targeting_automation: { advantage_audience: 0 },
  };
  // `[{id}]` şekli VARSAYIM (v22.0 changelog yalnız alan adını veriyor).
  if (excludedAudience !== null) targeting.excluded_custom_audiences = [{ id: excludedAudience }];
  return targeting;
}

export function createAdSet(
  adAccountId: string,
  o: {
    key: string;
    name: string;
    campaign: string | Ref;
    pixelId: string;
    template: AdTemplate;
    excludedAudience: string | Ref | null;
  },
): SetupStep {
  return {
    key: o.key,
    label: `Reklam seti: ${o.name}`,
    path: `${adAccountId}/adsets`,
    params: {
      name: o.name,
      campaign_id: o.campaign,
      status: "PAUSED",
      billing_event: "IMPRESSIONS",
      optimization_goal: ADSET_OPTIMIZATION_GOAL,
      destination_type: "WEBSITE",
      promoted_object: { pixel_id: o.pixelId, custom_event_type: "LEAD" },
      attribution_spec: [
        { event_type: "CLICK_THROUGH", window_days: 7 },
        { event_type: "VIEW_THROUGH", window_days: 1 },
      ],
      targeting: buildAdsetTargeting(o.template, o.excludedAudience),
    },
    result: "id",
  };
}

/** Reels'i reklamda kullanma: `instagram_actor_id` değil `instagram_user_id` (v22.0). */
export function createReelCreative(
  adAccountId: string,
  o: { key: string; name: string; pageId: string; igUserId: string; igMediaId: string; link: string; urlTags: string },
): SetupStep {
  return {
    key: o.key,
    label: `Kreatif (Reels): ${o.name}`,
    path: `${adAccountId}/adcreatives`,
    params: {
      name: o.name,
      object_id: o.pageId,
      instagram_user_id: o.igUserId,
      source_instagram_media_id: o.igMediaId,
      call_to_action: { type: "LEARN_MORE", value: { link: o.link } },
      url_tags: o.urlTags,
    },
    result: "id",
  };
}

export function createLinkCreative(
  adAccountId: string,
  o: {
    key: string;
    name: string;
    pageId: string;
    igUserId: string | null;
    imageUrl: string;
    message: string;
    headline: string;
    link: string;
    urlTags: string;
  },
): SetupStep {
  const objectStorySpec: Record<string, unknown> = { page_id: o.pageId };
  if (o.igUserId) objectStorySpec.instagram_user_id = o.igUserId;
  objectStorySpec.link_data = {
    link: o.link,
    message: o.message,
    name: o.headline,
    picture: o.imageUrl,
    call_to_action: { type: "LEARN_MORE", value: { link: o.link } },
  };
  return {
    key: o.key,
    label: `Kreatif (sayfa): ${o.name}`,
    path: `${adAccountId}/adcreatives`,
    params: { name: o.name, url_tags: o.urlTags, object_story_spec: objectStorySpec },
    result: "id",
  };
}

export function createAd(
  adAccountId: string,
  o: { key: string; name: string; adsetId: string; creative: string | Ref },
): SetupStep {
  return {
    key: o.key,
    label: `Reklam: ${o.name}`,
    path: `${adAccountId}/ads`,
    params: { name: o.name, adset_id: o.adsetId, creative: { creative_id: o.creative }, status: "PAUSED" },
    result: "id",
  };
}

export function setObjectStatus(o: {
  key: string;
  objectId: string | Ref;
  status: "ACTIVE" | "PAUSED";
  label: string;
}): SetupStep {
  return {
    key: o.key,
    label: o.label,
    path: isRef(o.objectId) ? { ref: o.objectId.$ref, suffix: "" } : o.objectId,
    params: { status: o.status },
    result: "success",
  };
}

export function copyAdToAdset(o: { key: string; adId: string; adsetId: string }): SetupStep {
  return {
    key: o.key,
    label: "Reklamı Büyütme setine kopyala",
    path: `${o.adId}/copies`,
    params: { adset_id: o.adsetId, status_option: "PAUSED", rename_options: { rename_strategy: "NO_RENAME" } },
    result: "copied_ad_id",
  };
}

class StepError extends Error {}

function resolveId(key: string, ids: Record<string, string>): string {
  const id = ids[key];
  if (!id) throw new StepError(`Önceki adımın kimliği yok (${key})`);
  return id;
}

/** İç içe tüm `Ref`'leri önceki adımların kimlikleriyle değiştirir. */
function resolveValue(value: unknown, ids: Record<string, string>): unknown {
  if (isRef(value)) return resolveId(value.$ref, ids);
  if (Array.isArray(value)) return value.map((v) => resolveValue(v, ids));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveValue(v, ids)]));
  }
  return value;
}

function resolvePath(path: SetupStep["path"], ids: Record<string, string>): string {
  if (typeof path === "string") {
    if (!PLAIN_PATH.test(path)) throw new StepError("Geçersiz Meta yolu");
    return path;
  }
  const id = resolveId(path.ref, ids);
  if (!ID.test(id) || !SUFFIX.test(path.suffix)) throw new StepError("Geçersiz Meta yolu");
  return `${id}${path.suffix}`;
}

/** Form gövdesi: metin olduğu gibi, sayı/mantıksal metne, nesne/dizi JSON. */
function formBody(params: Record<string, unknown>, cfg: MetaConfig): string {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    body.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  }
  body.set("appsecret_proof", appSecretProof(cfg.accessToken, cfg.appSecret));
  return body.toString();
}

async function postStep(
  cfg: MetaConfig,
  step: SetupStep,
  ids: Record<string, string>,
  fetchFn: FetchFn,
): Promise<string | null> {
  const path = resolvePath(step.path, ids);
  const params = resolveValue(step.params, ids) as Record<string, unknown>;
  const response = await fetchFn(`${META_GRAPH_BASE}/${META_GRAPH_API_VERSION}/${path}`, {
    method: "POST",
    headers: { ...headers(cfg), "content-type": "application/x-www-form-urlencoded" },
    body: formBody(params, cfg),
    signal: AbortSignal.timeout(SETUP_TIMEOUT_MS),
  });
  if (!response.ok) throw await toApiError(response, cfg, step.label);
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (step.result === "success") {
    if (data?.success !== true) throw new MetaApiError(`${step.label}: Meta başarı bildirmedi`, 502);
    return null;
  }
  const raw = data?.[step.result];
  const id = typeof raw === "string" || typeof raw === "number" ? String(raw) : "";
  if (!ID.test(id)) throw new MetaApiError(`${step.label}: Meta kimlik döndürmedi`, 502);
  return id;
}

/**
 * Adımları sırayla gönderir. İlk hatada durur; o ana kadar kurulan kimlikleri ve patlayan adımı döner
 * (geri alma denenmez, kurulanlar PAUSED kalır). Hata metni `sanitize`'dan geçer; atmaz.
 */
export async function runSetupSteps(
  cfg: MetaConfig,
  steps: SetupStep[],
  fetchFn: FetchFn = fetch,
): Promise<
  { ok: true; ids: Record<string, string> } | { ok: false; ids: Record<string, string>; failedKey: string; error: string }
> {
  const ids: Record<string, string> = {};
  for (const step of steps) {
    try {
      const id = await postStep(cfg, step, ids, fetchFn);
      if (id !== null) ids[step.key] = id;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const text = err instanceof MetaApiError || err instanceof StepError ? message : `${step.label}: ${message}`;
      return { ok: false, ids: { ...ids }, failedKey: step.key, error: sanitize(text, cfg) };
    }
  }
  return { ok: true, ids };
}

export type AccountHealth = {
  readable: boolean;
  active: boolean;
  status: number | null;
  currency: string | null;
  text: string;
};

const ACCOUNT_STATUS_TEXT: Record<number, string> = {
  1: "Sağlıklı",
  2: "Kapalı",
  3: "Ödenmemiş bakiye",
  7: "Risk incelemesinde",
  8: "Ödeme bekleniyor",
  9: "Ödeme ek süresinde",
  100: "Kapanmak üzere",
  101: "Kapatıldı",
};

const UNREADABLE: AccountHealth = {
  readable: false,
  active: false,
  status: null,
  currency: null,
  text: "Reklam hesabı okunamadı",
};

/**
 * Reklam hesabının durumunu okur (GET; yazım kapısı gerekmez). Hata atmaz; okunamazsa `readable:false`.
 * Kaynak: https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-account
 */
export async function readAccountHealth(
  cfg: MetaConfig,
  fetchFn: FetchFn = fetch,
  timeoutMs = 5000,
): Promise<AccountHealth> {
  try {
    const url = new URL(`${META_GRAPH_BASE}/${META_GRAPH_API_VERSION}/${cfg.adAccountId}`);
    url.searchParams.set("fields", "account_status,disable_reason,currency,name");
    url.searchParams.set("appsecret_proof", appSecretProof(cfg.accessToken, cfg.appSecret));
    const response = await fetchFn(url.toString(), {
      method: "GET",
      headers: headers(cfg),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return { ...UNREADABLE };
    const data = (await response.json().catch(() => null)) as { account_status?: unknown; currency?: unknown } | null;
    const status = typeof data?.account_status === "number" ? data.account_status : Number(data?.account_status);
    if (!Number.isInteger(status)) return { ...UNREADABLE };
    return {
      readable: true,
      active: status === 1,
      status,
      currency: typeof data?.currency === "string" ? data.currency : null,
      text: ACCOUNT_STATUS_TEXT[status] ?? `Bilinmeyen hesap durumu (${status})`,
    };
  } catch {
    return { ...UNREADABLE };
  }
}

/** Reklamın inceleme durumunu Türkçe etikete çevirir; inceleme dışı durumlar için null. */
export function reviewLabel(effectiveStatus: string | null, feedback: string | null): string | null {
  switch (effectiveStatus) {
    case "PENDING_REVIEW":
    case "IN_PROCESS":
      return "İncelemede";
    case "DISAPPROVED":
      return feedback ? `Reddedildi: ${feedback}` : "Reddedildi";
    case "WITH_ISSUES":
      return "Sorunlu";
    default:
      return null;
  }
}

const FEEDBACK_MAX = 300;

/** `ad_review_feedback` `{global:{anahtar:açıklama}}` → açıklamalar " · " ile, en çok 300 karakter. */
export function reviewFeedbackText(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return null;
  const global = (raw as { global?: unknown }).global;
  if (typeof global !== "object" || global === null) return null;
  const parts = Object.values(global as Record<string, unknown>)
    .filter((v): v is string => typeof v === "string" && v.trim() !== "")
    .map((v) => v.trim());
  if (parts.length === 0) return null;
  const text = parts.join(" · ");
  return text.length > FEEDBACK_MAX ? text.slice(0, FEEDBACK_MAX) : text;
}
