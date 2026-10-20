import type { FetchFn } from "../types";
import { appSecretProof, META_GRAPH_API_VERSION, META_GRAPH_BASE, type MetaConfig } from "./config";
import { headers, MetaApiError, nextUrl, toApiError } from "./insights";

const TIMEOUT_MS = 30_000;
/** Medya listesi sayfa başına 50; çok eski gönderiler için en çok 5 sayfa taranır. */
const MEDIA_PAGES = 5;

/**
 * Reels metrikleri. `plays` v22'de kalktı (yerine `views`), `impressions` yeni medyada yok.
 * Kaynak: https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights
 */
const REEL_METRICS = "views,reach,saved,shares,total_interactions,ig_reels_avg_watch_time";

export interface ReelInsights {
  views: number | null;
  reach: number | null;
  saved: number | null;
  shares: number | null;
  totalInteractions: number | null;
  /** `ig_reels_avg_watch_time` milisaniyedir. */
  avgWatchMs: number | null;
}

/**
 * Gönderi anahtarı: /p/KOD, /reel/KOD, /reels/KOD ve /tv/KOD aynı kısa kodu verir; sorgu, parça ve sondaki "/" yok sayılır.
 * Kısa kod büyük/küçük harfe duyarlıdır.
 */
export function normalizePermalink(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    const m = /^\/(?:[^/]+\/)?(?:p|reels?|tv)\/([^/]+)/i.exec(url.pathname);
    return m ? m[1] : url.pathname.replace(/\/+$/, "") || null;
  } catch {
    return null;
  }
}

function signed(url: URL, cfg: MetaConfig): URL {
  url.searchParams.set("appsecret_proof", appSecretProof(cfg.accessToken, cfg.appSecret));
  return url;
}

async function getJson<T>(url: URL, cfg: MetaConfig, fetchFn: FetchFn, label: string): Promise<T> {
  const response = await fetchFn(url.toString(), { method: "GET", headers: headers(cfg), signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw await toApiError(response, cfg, label);
  return (await response.json()) as T;
}

export interface MediaRef {
  id: string;
  permalink: string;
  /** Instagram'daki paylaşım zamanı (Meta'nın verdiği biçim). */
  timestamp: string | null;
}

/**
 * Hesabın son gönderileri (sayfa başına 50, en çok 5 sayfa). Senkron başına bir kez çekilip tüm kartlar ona karşı eşlenir.
 * Alanlar: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media
 * (bu oturumda canlı doğrulanmadı; ilk gerçek hesapta bakılır). Yapılandırma yoksa istek gitmez.
 */
export async function listMedia(cfg: MetaConfig, fetchFn: FetchFn = fetch): Promise<MediaRef[]> {
  if (!cfg.instagramUserId) return [];
  const first = new URL(`${META_GRAPH_BASE}/${META_GRAPH_API_VERSION}/${cfg.instagramUserId}/media`);
  first.searchParams.set("fields", "id,permalink,media_product_type,timestamp");
  first.searchParams.set("limit", "50");
  const out: MediaRef[] = [];
  let url: URL | null = signed(first, cfg);
  for (let page = 0; url && page < MEDIA_PAGES; page++) {
    const body: { data?: { id?: string; permalink?: string; timestamp?: string }[]; paging?: { next?: string } } = await getJson(
      url,
      cfg,
      fetchFn,
      "Instagram medya listesi alınamadı",
    );
    if (!Array.isArray(body.data)) throw new MetaApiError("Meta yanıtı beklenmeyen biçimde", 502);
    for (const m of body.data) if (m.id && m.permalink) out.push({ id: String(m.id), permalink: m.permalink, timestamp: m.timestamp ?? null });
    url = body.paging?.next ? nextUrl(body.paging.next, cfg) : null;
  }
  return out;
}

/** Bağlantıyı hazır medya listesinde arar. */
export function findMedia(list: MediaRef[], permalink: string): MediaRef | null {
  const wanted = normalizePermalink(permalink);
  if (!wanted) return null;
  return list.find((m) => normalizePermalink(m.permalink) === wanted) ?? null;
}

/** Tek bağlantı için medya kimliği ve paylaşım zamanı; bulunamazsa ya da yapılandırma yoksa null. */
export async function resolveMediaId(
  cfg: MetaConfig,
  permalink: string,
  fetchFn: FetchFn = fetch,
): Promise<{ id: string; timestamp: string | null } | null> {
  if (!cfg.instagramUserId || !normalizePermalink(permalink)) return null;
  const hit = findMedia(await listMedia(cfg, fetchFn), permalink);
  return hit ? { id: hit.id, timestamp: hit.timestamp } : null;
}

type InsightEntry = { name?: string; values?: { value?: unknown }[]; total_value?: { value?: unknown } };

function metricValue(entries: InsightEntry[], name: string): number | null {
  const entry = entries.find((e) => e.name === name);
  const raw = entry?.total_value?.value ?? entry?.values?.[0]?.value;
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw !== "" ? Number(raw) : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Bir Reels'in ömür boyu organik sayıları. */
export async function fetchReelInsights(cfg: MetaConfig, mediaId: string, fetchFn: FetchFn = fetch): Promise<ReelInsights> {
  const url = new URL(`${META_GRAPH_BASE}/${META_GRAPH_API_VERSION}/${encodeURIComponent(mediaId)}/insights`);
  url.searchParams.set("metric", REEL_METRICS);
  const body = await getJson<{ data?: InsightEntry[] }>(signed(url, cfg), cfg, fetchFn, "Instagram insights isteği başarısız");
  if (!Array.isArray(body.data)) throw new MetaApiError("Meta yanıtı beklenmeyen biçimde", 502);
  return {
    views: metricValue(body.data, "views"),
    reach: metricValue(body.data, "reach"),
    saved: metricValue(body.data, "saved"),
    shares: metricValue(body.data, "shares"),
    totalInteractions: metricValue(body.data, "total_interactions"),
    avgWatchMs: metricValue(body.data, "ig_reels_avg_watch_time"),
  };
}
