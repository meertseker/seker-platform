import type { FetchFn } from "../types";
import { appSecretProof, META_GRAPH_API_VERSION, META_GRAPH_BASE, type MetaConfig } from "./config";
import { headers, MetaApiError, toApiError } from "./insights";

/**
 * Instagram Reels yayını (Content Publishing API, Graph v26.0): konteyner → durum → media_publish → permalink.
 * Saf modül: `fetch` enjekte edilir; anahtar yalnız `authorization` başlığında, `appsecret_proof` gövde/sorguda.
 * Rehber: https://developers.facebook.com/docs/instagram-platform/content-publishing/
 */

const TIMEOUT_MS = 30_000;
const DIGITS = /^\d{1,30}$/;

export type ContainerStatusCode = "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED" | "UNKNOWN";
const KNOWN_STATUS: ReadonlySet<string> = new Set(["EXPIRED", "ERROR", "FINISHED", "IN_PROGRESS", "PUBLISHED"]);

function igUser(cfg: MetaConfig): string {
  const id = cfg.instagramUserId?.trim();
  if (!id) throw new MetaApiError("Instagram hesabı tanımlı değil", 400);
  if (!DIGITS.test(id)) throw new MetaApiError("Geçersiz Instagram hesap kimliği", 400);
  return id;
}

function checkId(id: string): string {
  if (!DIGITS.test(id)) throw new MetaApiError("Geçersiz Meta nesne kimliği", 400);
  return id;
}

function graphUrl(path: string): URL {
  return new URL(`${META_GRAPH_BASE}/${META_GRAPH_API_VERSION}/${path}`);
}

function unexpected(): MetaApiError {
  return new MetaApiError("Meta yanıtı beklenmeyen biçimde", 502);
}

async function postForm(
  cfg: MetaConfig,
  path: string,
  fields: Record<string, string>,
  label: string,
  fetchFn: FetchFn,
): Promise<unknown> {
  const body = new URLSearchParams({ ...fields, appsecret_proof: appSecretProof(cfg.accessToken, cfg.appSecret) });
  const response = await fetchFn(graphUrl(path).toString(), {
    method: "POST",
    headers: { ...headers(cfg), "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw await toApiError(response, cfg, label);
  return response.json().catch(() => null);
}

/** GET `{base}/{v}/{path}?fields=…`; anahtar başlıkta, appsecret_proof sorguda. Bağlantı kartları da kullanır. */
export async function getFields(cfg: MetaConfig, path: string, fields: string, label: string, fetchFn: FetchFn): Promise<unknown> {
  const url = graphUrl(path);
  url.searchParams.set("fields", fields);
  url.searchParams.set("appsecret_proof", appSecretProof(cfg.accessToken, cfg.appSecret));
  const response = await fetchFn(url.toString(), {
    method: "GET",
    headers: headers(cfg),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw await toApiError(response, cfg, label);
  return response.json().catch(() => null);
}

function idOf(data: unknown): string {
  const id = (data as { id?: unknown } | null)?.id;
  if ((typeof id === "string" || typeof id === "number") && DIGITS.test(String(id))) return String(id);
  throw unexpected();
}

/**
 * Reels konteyneri açar. `thumb_offset` milisaniyedir; `share_to_feed` varsayılanı yazmadığı için açıkça `true`.
 * Kaynak: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media
 */
export async function createReelContainer(
  cfg: MetaConfig,
  input: { videoUrl: string; caption: string; thumbOffsetMs: number },
  fetchFn: FetchFn = fetch,
): Promise<string> {
  const user = igUser(cfg);
  const data = await postForm(
    cfg,
    `${user}/media`,
    {
      media_type: "REELS",
      video_url: input.videoUrl,
      caption: input.caption,
      thumb_offset: String(Math.max(0, Math.round(input.thumbOffsetMs))),
      share_to_feed: "true",
    },
    "Instagram konteyneri açılamadı",
    fetchFn,
  );
  return idOf(data);
}

/**
 * Konteyner durumu. `status_code` ∈ EXPIRED, ERROR, FINISHED, IN_PROGRESS, PUBLISHED; ERROR iken `status`
 * bir alt kod taşır (metin biçimi TEYİTSİZ: ilk 4–9 haneli sayı alınır).
 * Kaynak: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-container
 */
export async function getContainerStatus(
  cfg: MetaConfig,
  containerId: string,
  fetchFn: FetchFn = fetch,
): Promise<{ statusCode: ContainerStatusCode; status: string | null; errorSubcode: number | null }> {
  checkId(containerId);
  const data = (await getFields(cfg, containerId, "status_code,status", "Instagram konteyner durumu okunamadı", fetchFn)) as {
    status_code?: unknown;
    status?: unknown;
  } | null;
  if (!data || typeof data !== "object") throw unexpected();
  const raw = typeof data.status_code === "string" ? data.status_code : "";
  const statusCode = (KNOWN_STATUS.has(raw) ? raw : "UNKNOWN") as ContainerStatusCode;
  const status = typeof data.status === "string" ? data.status : null;
  const m = status ? /\b(\d{4,9})\b/.exec(status) : null;
  return { statusCode, status, errorSubcode: m ? Number(m[1]) : null };
}

/**
 * Konteyneri yayınlar → Instagram medya kimliği.
 * Kaynak: https://developers.facebook.com/docs/instagram-platform/content-publishing/
 */
export async function publishContainer(cfg: MetaConfig, containerId: string, fetchFn: FetchFn = fetch): Promise<string> {
  const user = igUser(cfg);
  checkId(containerId);
  const data = await postForm(cfg, `${user}/media_publish`, { creation_id: containerId }, "Instagram yayını yapılamadı", fetchFn);
  return idOf(data);
}

/**
 * Yayınlanan medyanın bağlantısı ve zamanı (ISO 8601 UTC).
 * Kaynak: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-media
 */
export async function fetchPublishedMedia(
  cfg: MetaConfig,
  mediaId: string,
  fetchFn: FetchFn = fetch,
): Promise<{ id: string; permalink: string | null; timestamp: string | null }> {
  checkId(mediaId);
  const data = (await getFields(cfg, mediaId, "id,permalink,timestamp", "Instagram gönderisi okunamadı", fetchFn)) as {
    permalink?: unknown;
    timestamp?: unknown;
  } | null;
  const id = idOf(data);
  return {
    id,
    permalink: typeof data?.permalink === "string" ? data.permalink : null,
    timestamp: typeof data?.timestamp === "string" ? data.timestamp : null,
  };
}

/**
 * Günlük yayın hakkı. Sayı sabitlenmez (Meta sayfaları 25/50/100 diyor), API'den okunur.
 * Kaynak: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit
 */
export async function getPublishingLimit(
  cfg: MetaConfig,
  fetchFn: FetchFn = fetch,
): Promise<{ used: number; total: number; remaining: number }> {
  const user = igUser(cfg);
  const data = (await getFields(
    cfg,
    `${user}/content_publishing_limit`,
    "quota_usage,config",
    "Instagram yayın hakkı okunamadı",
    fetchFn,
  )) as { data?: { quota_usage?: unknown; config?: { quota_total?: unknown } }[] } | null;
  const row = Array.isArray(data?.data) ? data.data[0] : undefined;
  const used = Number(row?.quota_usage);
  const total = Number(row?.config?.quota_total);
  if (!row || !Number.isFinite(used) || !Number.isFinite(total)) throw unexpected();
  return { used, total, remaining: Math.max(0, total - used) };
}
