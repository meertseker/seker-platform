// Google Ads'e yazma: kampanya durumu ve günlük bütçe. Yalnız değişiklik kapısı (lib/ads/writes.ts) çağırır.
import { GOOGLE_ADS_API_VERSION, type AdsConfig } from "./config";
import { GoogleApiError } from "./googleAds";
import type { FetchFn } from "./types";

const MUTATE_TIMEOUT_MS = 30_000;
const MAX_ERROR_LENGTH = 500;
const DIGITS = /^\d{1,30}$/;

function baseUrl(cfg: AdsConfig): string {
  return `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${cfg.customerId}`;
}

/** developer-token başlığı gönderilmez (googleAds.ts ile aynı gerekçe); erişim düzeyi Cloud projesinden gelir. */
function headers(cfg: AdsConfig, token: string): Record<string, string> {
  const h: Record<string, string> = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  if (cfg.loginCustomerId) h["login-customer-id"] = cfg.loginCustomerId;
  return h;
}

/** Hata metni: Google'ın `error.message`'ı; erişim anahtarı geçiyorsa silinir, kısaltılır. */
async function mutateError(response: Response, token: string, label: string): Promise<GoogleApiError> {
  const raw = await response.text();
  let message = raw ? `HTTP ${response.status}: ${raw}` : `HTTP ${response.status}`;
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    if (parsed.error?.message) message = parsed.error.message;
  } catch {
    // JSON değilse ham metin
  }
  if (token) message = message.split(token).join("[gizli]");
  if (message.length > MAX_ERROR_LENGTH) message = message.slice(0, MAX_ERROR_LENGTH);
  return new GoogleApiError(`${label}: ${message}`, response.status);
}

async function mutate(
  cfg: AdsConfig,
  token: string,
  service: "campaigns" | "campaignBudgets",
  operation: Record<string, unknown>,
  label: string,
  fetchFn: FetchFn,
): Promise<void> {
  const response = await fetchFn(`${baseUrl(cfg)}/${service}:mutate`, {
    method: "POST",
    headers: headers(cfg, token),
    body: JSON.stringify({ operations: [operation] }),
    signal: AbortSignal.timeout(MUTATE_TIMEOUT_MS),
  });
  if (!response.ok) throw await mutateError(response, token, label);
}

/**
 * Kampanya durumunu değiştirir.
 * `POST .../customers/<cid>/campaigns:mutate` `{operations:[{update:{resourceName,status},updateMask:"status"}]}`.
 * Kaynak: https://developers.google.com/google-ads/api/rest/common/mutate
 */
export async function googleSetStatus(
  cfg: AdsConfig,
  token: string,
  campaignId: string,
  status: "PAUSED" | "ENABLED",
  fetchFn: FetchFn = fetch,
): Promise<void> {
  if (!DIGITS.test(campaignId)) throw new GoogleApiError("Geçersiz kampanya kimliği", 400);
  await mutate(
    cfg,
    token,
    "campaigns",
    { update: { resourceName: `customers/${cfg.customerId}/campaigns/${campaignId}`, status }, updateMask: "status" },
    "Google kampanya durumu değiştirilemedi",
    fetchFn,
  );
}

/**
 * Kampanya bütçesinin günlük tutarını değiştirir (mikro birim: TL × 1.000.000; int64 JSON'da metin).
 * `POST .../campaignBudgets:mutate` `{update:{resourceName,amountMicros},updateMask:"amount_micros"}` — TEYİTSİZ, aynı desen.
 * Kaynak: https://developers.google.com/google-ads/api/rest/common/mutate
 * Paylaşılan bütçe birden çok kampanyayı birlikte etkiler.
 */
export async function googleSetBudget(
  cfg: AdsConfig,
  token: string,
  budgetResource: string,
  amountMicros: number,
  fetchFn: FetchFn = fetch,
): Promise<void> {
  const prefix = `customers/${cfg.customerId}/campaignBudgets/`;
  if (!budgetResource.startsWith(prefix) || !DIGITS.test(budgetResource.slice(prefix.length))) {
    throw new GoogleApiError("Geçersiz bütçe kaynağı", 400);
  }
  if (!Number.isSafeInteger(amountMicros) || amountMicros <= 0) throw new GoogleApiError("Geçersiz bütçe tutarı", 400);
  await mutate(
    cfg,
    token,
    "campaignBudgets",
    { update: { resourceName: budgetResource, amountMicros: String(amountMicros) }, updateMask: "amount_micros" },
    "Google bütçesi değiştirilemedi",
    fetchFn,
  );
}
