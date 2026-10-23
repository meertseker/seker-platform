// Bağlantı kartları için Meta okuma çağrıları (yalnız GET; IG_PUBLISH_ENABLED / ADS_WRITE_ENABLED'a bağlı değil).
import type { FetchFn } from "../types";
import type { MetaConfig } from "./config";
import { MetaApiError } from "./insights";
import { getFields } from "./publish";

const DIGITS = /^\d{1,30}$/;

function obj(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object") throw new MetaApiError("Meta yanıtı beklenmeyen biçimde", 502);
  return data as Record<string, unknown>;
}

function digits(id: string | null | undefined, what: string): string {
  const v = (id ?? "").trim();
  if (!DIGITS.test(v)) throw new MetaApiError(`${what} tanımlı değil`, 400);
  return v;
}

/** Kaynak: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user */
export async function fetchIgUsername(cfg: MetaConfig, fetchFn: FetchFn = fetch): Promise<string> {
  const id = digits(cfg.instagramUserId, "Instagram hesabı");
  const d = obj(await getFields(cfg, id, "username", "Instagram hesabı okunamadı", fetchFn));
  if (typeof d.username !== "string" || !d.username) throw new MetaApiError("Meta yanıtı beklenmeyen biçimde", 502);
  return d.username;
}

/** Kaynak: https://developers.facebook.com/docs/graph-api/reference/page/ */
export async function fetchFacebookPage(
  cfg: MetaConfig,
  pageId: string,
  fetchFn: FetchFn = fetch,
): Promise<{ name: string; instagramId: string | null }> {
  const id = digits(pageId, "Facebook sayfası");
  const d = obj(await getFields(cfg, id, "name,instagram_business_account", "Facebook sayfası okunamadı", fetchFn));
  const ig = d.instagram_business_account as { id?: unknown } | undefined;
  return {
    name: typeof d.name === "string" ? d.name : id,
    instagramId: ig && (typeof ig.id === "string" || typeof ig.id === "number") ? String(ig.id) : null,
  };
}

/**
 * account_status: 1 ACTIVE, 2 DISABLED, 3 UNSETTLED, 7 PENDING_RISK_REVIEW, 9 IN_GRACE_PERIOD, 101 CLOSED.
 * Kaynak: https://developers.facebook.com/docs/marketing-api/reference/ad-account/
 */
export async function fetchAdAccount(
  cfg: MetaConfig,
  fetchFn: FetchFn = fetch,
): Promise<{ name: string; currency: string; accountStatus: number }> {
  if (!/^act_\d{1,30}$/.test(cfg.adAccountId)) throw new MetaApiError("Reklam hesabı tanımlı değil", 400);
  const d = obj(await getFields(cfg, cfg.adAccountId, "name,currency,account_status", "Reklam hesabı okunamadı", fetchFn));
  const status = Number(d.account_status);
  if (!Number.isFinite(status)) throw new MetaApiError("Meta yanıtı beklenmeyen biçimde", 502);
  return { name: typeof d.name === "string" ? d.name : "", currency: typeof d.currency === "string" ? d.currency : "", accountStatus: status };
}

/** Piksel adı. TEYİTSİZ: `GET /{pixel-id}?fields=name` (https://developers.facebook.com/docs/marketing-api/reference/ads-pixel/). */
export async function fetchPixelName(cfg: MetaConfig, fetchFn: FetchFn = fetch): Promise<string> {
  const id = digits(cfg.pixelId, "Piksel");
  const d = obj(await getFields(cfg, id, "name", "Piksel okunamadı", fetchFn));
  return typeof d.name === "string" && d.name ? d.name : id;
}
