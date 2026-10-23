import { parseContentCode } from "../content-code";
import type { FetchFn, PlatformSpendRow } from "../types";
import { appSecretProof, META_GRAPH_API_VERSION, META_GRAPH_BASE, type MetaConfig } from "./config";

const MAX_ERROR_LENGTH = 500;
const INSIGHTS_TIMEOUT_MS = 30_000;
/** Sonsuz sayfalama döngüsüne karşı üst sınır. */
const MAX_PAGES = 20;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Kaynak: https://developers.facebook.com/docs/marketing-api/reference/ad-account/insights/ */
const INSIGHT_FIELDS =
  "date_start,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,reach,frequency,clicks,inline_link_clicks,actions";
/** Atıf penceresi açıkça verilir; varsayılan Meta sayfalarında çelişkili. Aynı kaynak. */
const ATTRIBUTION_WINDOWS = ["7d_click", "1d_view"];

export class MetaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: number | null = null,
    /** Meta `error_subcode` (Instagram yayın hataları 2207xxx). */
    readonly subcode: number | null = null,
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

/** Mesajdan erişim anahtarını ve appsecret_proof'u siler, sonra kısaltır. */
export function sanitize(text: string, cfg: MetaConfig): string {
  let out = text;
  for (const secret of [cfg.accessToken, appSecretProof(cfg.accessToken, cfg.appSecret)]) {
    if (secret) out = out.split(secret).join("[gizli]");
  }
  return out.length > MAX_ERROR_LENGTH ? out.slice(0, MAX_ERROR_LENGTH) : out;
}

/** Hata biçimi `{error:{message,code,...}}`; kaynak: https://developers.facebook.com/docs/graph-api/guides/error-handling/ */
export async function toApiError(
  response: Response,
  cfg: MetaConfig,
  label = "Meta insights isteği başarısız",
): Promise<MetaApiError> {
  const raw = await response.text();
  let message = raw ? `HTTP ${response.status}: ${raw}` : `HTTP ${response.status}`;
  let code: number | null = null;
  let subcode: number | null = null;
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string; code?: number; error_subcode?: number } };
    if (parsed.error?.message) message = parsed.error.message;
    if (typeof parsed.error?.code === "number") code = parsed.error.code;
    if (typeof parsed.error?.error_subcode === "number") subcode = parsed.error.error_subcode;
  } catch {
    // JSON değilse ham metin
  }
  return new MetaApiError(`${label}: ${sanitize(message, cfg)}`, response.status, code, subcode);
}

export function headers(cfg: MetaConfig): Record<string, string> {
  // Erişim anahtarı yalnız başlıkta; URL'ye (günlüklere, hata mesajlarına) girmez.
  return { authorization: `Bearer ${cfg.accessToken}` };
}

function firstUrl(cfg: MetaConfig, from: string, to: string): URL {
  const url = new URL(`${META_GRAPH_BASE}/${META_GRAPH_API_VERSION}/${cfg.adAccountId}/insights`);
  url.searchParams.set("level", "ad");
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("time_range", JSON.stringify({ since: from, until: to }));
  url.searchParams.set("action_attribution_windows", JSON.stringify(ATTRIBUTION_WINDOWS));
  url.searchParams.set("fields", INSIGHT_FIELDS);
  url.searchParams.set("limit", "500");
  url.searchParams.set("appsecret_proof", appSecretProof(cfg.accessToken, cfg.appSecret));
  return url;
}

/**
 * `paging.next` Meta'dan tam URL gelir ve içinde access_token taşır. Yalnız graph.facebook.com'a gidilir
 * (başka sunucuya anahtar sızmaz), access_token düşürülür, anahtar başlıkla gider.
 */
export function nextUrl(raw: string, cfg: MetaConfig): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new MetaApiError("Meta sayfalama adresi geçersiz", 502);
  }
  if (url.origin !== META_GRAPH_BASE) throw new MetaApiError("Meta sayfalama adresi beklenmeyen sunucuya işaret ediyor", 502);
  url.searchParams.delete("access_token");
  url.searchParams.set("appsecret_proof", appSecretProof(cfg.accessToken, cfg.appSecret));
  return url;
}

interface InsightRow {
  date_start?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  clicks?: string;
  inline_link_clicks?: string;
  actions?: { action_type?: string; value?: string }[];
}

interface InsightPage {
  data?: InsightRow[];
  paging?: { next?: string };
}

function num(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Web formu başvurusu `offsite_conversion.fb_pixel_lead`; yoksa toplam `lead`. İkisini toplamak çift sayar.
 * Anlamlar ilk gerçek hesapta Reklam Yöneticisi ile doğrulanacak (araştırma notu: TEYİTSİZ).
 */
function platformResults(actions: InsightRow["actions"]): number {
  const find = (type: string) => actions?.find((a) => a.action_type === type);
  const picked = find("offsite_conversion.fb_pixel_lead") ?? find("lead");
  return num(picked?.value) ?? 0;
}

function toRow(row: InsightRow, fallbackDate: string): PlatformSpendRow {
  const adId = row.ad_id ? String(row.ad_id) : "";
  return {
    date: row.date_start ?? fallbackDate,
    campaignId: String(row.campaign_id ?? ""),
    campaignName: row.campaign_name ?? "",
    // spend hesap para biriminde ondalıklı metin (TRY); mikroya çevrilir.
    costMicros: Math.round(Number(row.spend ?? 0) * 1_000_000),
    clicks: num(row.clicks) ?? 0,
    impressions: num(row.impressions) ?? 0,
    platform: "meta",
    level: "ad",
    objectId: adId,
    adsetId: row.adset_id ? String(row.adset_id) : null,
    adsetName: row.adset_name ?? null,
    adId: adId || null,
    adName: row.ad_name ?? null,
    contentCode: parseContentCode(row.ad_name),
    reach: num(row.reach),
    frequency: num(row.frequency),
    platformResults: platformResults(row.actions),
  };
}

/** Reklam seviyesinde günlük harcamayı çeker. Tarihler YYYY-MM-DD, iki uç dahil. */
export async function fetchMetaAdSpend(
  cfg: MetaConfig,
  from: string,
  to: string,
  fetchFn: FetchFn = fetch,
): Promise<PlatformSpendRow[]> {
  if (!YMD.test(from) || !YMD.test(to)) throw new Error("Geçersiz tarih");

  const rows: PlatformSpendRow[] = [];
  let url: URL | null = firstUrl(cfg, from, to);
  for (let page = 0; url && page < MAX_PAGES; page++) {
    const response: Response = await fetchFn(url.toString(), {
      method: "GET",
      headers: headers(cfg),
      signal: AbortSignal.timeout(INSIGHTS_TIMEOUT_MS),
    });
    if (!response.ok) throw await toApiError(response, cfg);
    const body = (await response.json()) as InsightPage;
    if (!Array.isArray(body.data)) throw new MetaApiError("Meta yanıtı beklenmeyen biçimde", 502);
    for (const item of body.data) rows.push(toRow(item, from));
    url = body.paging?.next ? nextUrl(body.paging.next, cfg) : null;
  }
  return rows;
}
