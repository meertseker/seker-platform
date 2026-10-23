// Reklam öncesi kontrolün (preflight) Paket A ve B'ye dayanan tek kaynağı.
//
// A: `lib/pages/store.ts` getLandingPageByContent (sayfa satırı), görsel adresi LP_MEDIA_OPTIONS (B18).
// B: 0025 kolonu ig_publish_status ve media_meta {vertical, durationS, subtitled}.
import type { SupabaseClient } from "@supabase/supabase-js";
import { LP_MEDIA_OPTIONS } from "@seker/shared/landing";
import { getLandingPageByContent } from "@/lib/pages/store";

export type IgPublishStatus = "yok" | "kuyruk" | "isleniyor" | "yayinda" | "hata";

export type ContentForAd = {
  id: string;
  code: string;
  topic: string;
  kind: "reels" | "sayfa";
  platform: "instagram" | "google";
  stage: string;
  status: string;
  approverFaceCheck: boolean;
  caption: string | null;
  igMediaId: string | null;
  igPermalink: string | null;
  igPublishedAt: string | null;
  igPublishStatus: IgPublishStatus;
  mediaMeta: { vertical: boolean | null; durationS: number | null; subtitled: boolean | null };
};

export type LandingForAd = {
  status: "taslak" | "yayinda" | "arsiv";
  slug: string;
  headline: string | null;
  primaryText: string | null;
  imageUrl: string | null;
};

const CONTENT_COLUMNS =
  "id, code, topic, kind, platform, stage, status, approver_face_check, caption, ig_media_id, ig_permalink, ig_published_at, ig_publish_status, media_meta";

const IG_PUBLISH_STATUSES: readonly IgPublishStatus[] = ["yok", "kuyruk", "isleniyor", "yayinda", "hata"];

function toIgPublishStatus(v: unknown): IgPublishStatus {
  return IG_PUBLISH_STATUSES.includes(v as IgPublishStatus) ? (v as IgPublishStatus) : "yok";
}

type ContentRow = {
  id: string;
  code: string;
  topic: string;
  kind: string;
  platform: string;
  stage: string;
  status: string;
  approver_face_check: boolean | null;
  caption: string | null;
  ig_media_id: string | null;
  ig_permalink: string | null;
  ig_published_at: string | null;
  ig_publish_status: string | null;
  media_meta: unknown;
};

function boolOrNull(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** media_meta'yı B biçimine çevirir; B öncesi yüklemelerin `durationSec` alanı yedek olarak okunur. */
function parseMediaMeta(value: unknown): ContentForAd["mediaMeta"] {
  const m = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    vertical: boolOrNull(m.vertical),
    durationS: numOrNull(m.durationS) ?? numOrNull(m.durationSec),
    subtitled: boolOrNull(m.subtitled),
  };
}

/** Reklam için içerik satırını okur; yoksa ya da türü bilinmiyorsa null. */
export async function loadContentForAd(db: SupabaseClient, contentId: string): Promise<ContentForAd | null> {
  const { data, error } = await db.from("content_items").select(CONTENT_COLUMNS).eq("id", contentId).maybeSingle();
  if (error) throw new Error(`İçerik okunamadı: ${error.message}`);
  const r = data as ContentRow | null;
  if (!r) return null;
  if (r.kind !== "reels" && r.kind !== "sayfa") return null;
  return {
    id: r.id,
    code: r.code,
    topic: r.topic,
    kind: r.kind,
    platform: r.platform === "google" ? "google" : "instagram",
    stage: r.stage,
    status: r.status,
    approverFaceCheck: r.approver_face_check === true,
    caption: r.caption,
    igMediaId: r.ig_media_id,
    igPermalink: r.ig_permalink,
    igPublishedAt: r.ig_published_at,
    igPublishStatus: toIgPublishStatus(r.ig_publish_status),
    mediaMeta: parseMediaMeta(r.media_meta),
  };
}

/** Görselin sitedeki mutlak adresi; `siteBase` panelin okuduğu SITE_PUBLIC_URL tabanıdır. */
function imageUrlFor(siteBase: string, mediaKey: string | null): string | null {
  const option = mediaKey ? LP_MEDIA_OPTIONS.find((o) => o.key === mediaKey) : undefined;
  return option ? `${siteBase.replace(/\/+$/, "")}${option.src}` : null;
}

/** İçeriğin açılış sayfası (A); yoksa null. Adressiz satır yayında sayılmaz. */
export async function loadLandingForAd(
  db: SupabaseClient,
  contentId: string,
  siteBase: string,
): Promise<LandingForAd | null> {
  const row = await getLandingPageByContent(contentId, db);
  if (!row) return null;
  return {
    status: row.slug ? row.status : "taslak",
    slug: row.slug ?? "",
    headline: row.fields.adHeadline || null,
    primaryText: row.fields.adPrimaryText || null,
    imageUrl: imageUrlFor(siteBase, row.fields.mediaKey),
  };
}

const REELS_CODE_RE = /^R-(\d{4})-[A-Z]$/;

/** Reels kodundan aynı haftanın Instagram sayfa kodu: R-2644-A → S-2644-I. */
export function instagramPageCodeFor(reelsCode: string): string | null {
  const m = REELS_CODE_RE.exec(reelsCode);
  return m ? `S-${m[1]}-I` : null;
}

/** Aynı haftanın Instagram sayfası yayındaysa slug'ı (B14); değilse null (çağıran genel sayfaya düşer). */
export async function loadWeekInstagramPageSlug(db: SupabaseClient, reelsCode: string): Promise<string | null> {
  const code = instagramPageCodeFor(reelsCode);
  if (!code) return null;
  const { data, error } = await db.from("content_items").select("id").eq("code", code).maybeSingle();
  if (error) throw new Error(`İçerik okunamadı: ${error.message}`);
  if (!data) return null;
  const row = await getLandingPageByContent((data as { id: string }).id, db);
  return row?.status === "yayinda" && row.slug ? row.slug : null;
}
