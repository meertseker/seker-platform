import { GOOGLE_ADS_API_VERSION, type AdsConfig } from "./config";
import type { FetchFn, PendingConversion, SpendRow } from "./types";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DATA_MANAGER_INGEST_URL = "https://datamanager.googleapis.com/v1/events:ingest";
const MAX_ERROR_LENGTH = 500;
/** Her HTTP çağrısının üst sınırı; yanıt gelmezse cron süresiz beklemez. */
const OAUTH_TIMEOUT_MS = 15_000;
const ADS_TIMEOUT_MS = 30_000;
const INGEST_TIMEOUT_MS = 15_000;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export class GoogleApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "GoogleApiError";
  }
}

function truncate(text: string): string {
  return text.length > MAX_ERROR_LENGTH ? text.slice(0, MAX_ERROR_LENGTH) : text;
}

async function errorText(response: Response): Promise<string> {
  const raw = await response.text();
  try {
    const parsed = JSON.parse(raw) as { error?: string | { message?: string }; error_description?: string };
    if (typeof parsed.error === "string") return truncate(parsed.error_description ?? parsed.error);
    if (parsed.error?.message) return truncate(parsed.error.message);
  } catch {
    // JSON değilse ham metin
  }
  return truncate(raw ? `HTTP ${response.status}: ${raw}` : `HTTP ${response.status}`);
}

/** Refresh token'ı kısa ömürlü access token'a çevirir. */
export async function getAccessToken(cfg: AdsConfig, fetchFn: FetchFn = fetch): Promise<string> {
  const response = await fetchFn(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: cfg.refreshToken,
      grant_type: "refresh_token",
    }).toString(),
    signal: AbortSignal.timeout(OAUTH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new GoogleApiError(`OAuth token alınamadı: ${await errorText(response)}`, response.status);
  }
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new GoogleApiError("OAuth yanıtında access_token yok", 500);
  return data.access_token;
}

/**
 * developer-token başlığı gönderilmez: Google 9 Eylül 2026'da belirteçleri kaldırdı, başlığı yok sayıyor ve
 * gelecek bir ana sürümde reddedecek. Erişim düzeyi OAuth istemcisinin Cloud projesinden gelir.
 */
function adsHeaders(cfg: AdsConfig, token: string): Record<string, string> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
  if (cfg.loginCustomerId) headers["login-customer-id"] = cfg.loginCustomerId;
  return headers;
}

/** GAQL sorgusunu searchStream ile çalıştırır; tüm parçaların `results` dizilerini tek diziye düzleştirir. */
export async function searchStream(
  cfg: AdsConfig,
  token: string,
  query: string,
  fetchFn: FetchFn = fetch,
): Promise<unknown[]> {
  const url = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${cfg.customerId}/googleAds:searchStream`;
  const response = await fetchFn(url, {
    method: "POST",
    headers: adsHeaders(cfg, token),
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(ADS_TIMEOUT_MS),
  });
  if (!response.ok) {
    const text = await errorText(response);
    const hint = /CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION|ACTION_NOT_PERMITTED/.test(text)
      ? " (Google Cloud projesi henüz Explorer erişimi almadı; kurulum belgesi §2)"
      : "";
    throw new GoogleApiError(`Google Ads sorgusu başarısız: ${text}${hint}`, response.status);
  }
  const batches: unknown = await response.json();
  if (!Array.isArray(batches)) {
    throw new GoogleApiError("Google Ads yanıtı beklenmeyen biçimde", 502);
  }
  return (batches as { results?: unknown[] }[]).flatMap((batch) => batch?.results ?? []);
}

interface CampaignMetricsResult {
  campaign?: { id?: string; name?: string };
  metrics?: { costMicros?: string; clicks?: string; impressions?: string };
  segments?: { date?: string };
}

/** Kampanya bazında günlük harcamayı çeker. Tarihler YYYY-MM-DD, iki uç dahil. */
export async function fetchCampaignSpend(
  cfg: AdsConfig,
  token: string,
  from: string,
  to: string,
  fetchFn: FetchFn = fetch,
): Promise<SpendRow[]> {
  if (!YMD.test(from) || !YMD.test(to)) throw new Error("Geçersiz tarih");
  const query =
    "SELECT segments.date, campaign.id, campaign.name, metrics.cost_micros, metrics.clicks, metrics.impressions " +
    `FROM campaign WHERE segments.date BETWEEN '${from}' AND '${to}'`;
  const results = (await searchStream(cfg, token, query, fetchFn)) as CampaignMetricsResult[];
  return results.map((row) => ({
    date: row.segments?.date ?? from,
    campaignId: String(row.campaign?.id ?? ""),
    campaignName: row.campaign?.name ?? "",
    costMicros: Number(row.metrics?.costMicros ?? 0),
    clicks: Number(row.metrics?.clicks ?? 0),
    impressions: Number(row.metrics?.impressions ?? 0),
  }));
}

export type IngestResult = { ok: true; requestId: string | null } | { ok: false; error: string };

/**
 * Tek bir offline dönüşümü Data Manager API'ye gönderir.
 * Data Manager bir istekteki tek hatalı olayda tüm isteği reddettiği için her dönüşüm ayrı istektir.
 * Gövde yalnızca tanımlayıcı taşır (gclid, transactionId, değer, onay); kullanıcı verisi (e-posta, telefon) asla gönderilmez.
 */
export async function ingestConversion(
  cfg: AdsConfig,
  token: string,
  conv: PendingConversion,
  eventTimestamp: string,
  fetchFn: FetchFn = fetch,
): Promise<IngestResult> {
  const event: Record<string, unknown> = {
    adIdentifiers: { gclid: conv.gclid },
    eventTimestamp,
    transactionId: `${conv.leadId}:${conv.action}`,
    eventSource: "WEB",
  };
  if (conv.value != null && conv.value > 0) {
    event.conversionValue = conv.value;
    event.currency = "TRY";
  }

  const destination: Record<string, unknown> = {
    operatingAccount: { accountType: "GOOGLE_ADS", accountId: cfg.customerId },
    productDestinationId: cfg.conversionActionIds[conv.action],
  };
  if (cfg.loginCustomerId) {
    destination.loginAccount = { accountType: "GOOGLE_ADS", accountId: cfg.loginCustomerId };
  }

  const body: Record<string, unknown> = {
    destinations: [destination],
    events: [event],
    validateOnly: false,
  };
  // Yalnızca açık onay "CONSENT_GRANTED" olarak gider. "denied" ve null alanı hiç göndermez (muhafazakâr).
  if (conv.adUserData === "granted") body.consent = { adUserData: "CONSENT_GRANTED" };

  // Ağ hatası, zaman aşımı veya iptal bu olayı başarısız sayar; toplu işlemi düşürmez.
  try {
    const response = await fetchFn(DATA_MANAGER_INGEST_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(INGEST_TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, error: await errorText(response) };
    const data = (await response.json().catch(() => ({}))) as { requestId?: string };
    return { ok: true, requestId: data.requestId ?? null };
  } catch (err) {
    const name = err instanceof Error ? err.name : "bilinmeyen";
    return { ok: false, error: truncate(`Data Manager isteği başarısız (${name})`) };
  }
}
