// Reklam öncesi kontrolün (preflight) Paket A ve B'ye dayanan tek kaynağı.
//
// A (`lib/pages/store.ts` getLandingPageByContent, `lib/pages/media.ts` mediaUrlFor — spec B18) ve
// B (0025 kolonları ig_publish_status, media_meta.{vertical,durationS,subtitled}) birleşene kadar stub;
// rebase sonrası yalnız bu dosya değişir.
//
// Birleşme sonrası yapılacak olan:
// - loadContentForAd: select'e `ig_publish_status` eklenir ve `igPublishStatus` doğrudan bu kolondan
//   okunur (bilinmeyen değer → "yok"). `media_meta` B biçiminde `{vertical, durationS, subtitled}`
//   okunur; eski `durationSec` yedeği B'nin verisi geçtikten sonra silinebilir.
// - loadLandingForAd: `getLandingPageByContent(contentId)` çağrılır; sayfa yoksa null. Dönüş:
//   `status` (taslak|yayinda|arsiv), `slug`, `headline = fields.adHeadline`,
//   `primaryText = fields.adPrimaryText`, `imageUrl = fields.mediaKey ? mediaUrlFor(fields.mediaKey) : null`
//   (B18: mutlak adres, SITE_PUBLIC_URL tabanlı; A farklı taban kullanıyorsa `siteBase` ile birleştirilir).
// - loadWeekInstagramPageSlug: `instagramPageCodeFor(reelsCode)` ile `S-<yyww>-I` içeriği
//   `content_items`'tan kodla bulunur, `loadLandingForAd` ile okunur; `status === "yayinda"` ise slug,
//   değilse null (B14: çağıran `/lp/az-mevcutlu-anaokulu`'na düşer).
import type { SupabaseClient } from "@supabase/supabase-js";

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

// B öncesi: yalnız bugünkü DB'de olan kolonlar (ig_publish_status yok).
const CONTENT_COLUMNS =
  "id, code, topic, kind, platform, stage, status, approver_face_check, caption, ig_media_id, ig_permalink, ig_published_at, media_meta";

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
  media_meta: unknown;
};

function boolOrNull(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** media_meta'yı B biçimine çevirir; eski `durationSec` de okunur. */
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
  const { data } = await db.from("content_items").select(CONTENT_COLUMNS).eq("id", contentId).maybeSingle();
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
    // Stub: B'nin yayın durumu kolonu yok; yayın zamanı varsa yayında sayılır.
    igPublishStatus: r.ig_published_at ? "yayinda" : "yok",
    mediaMeta: parseMediaMeta(r.media_meta),
  };
}

/** İçeriğin açılış sayfası. Stub (A öncesi): her zaman null. */
export async function loadLandingForAd(
  db: SupabaseClient,
  contentId: string,
  siteBase: string,
): Promise<LandingForAd | null> {
  void db;
  void contentId;
  void siteBase;
  return null;
}

const REELS_CODE_RE = /^R-(\d{4})-[A-Z]$/;

/** Reels kodundan aynı haftanın Instagram sayfa kodu: R-2644-A → S-2644-I. */
export function instagramPageCodeFor(reelsCode: string): string | null {
  const m = REELS_CODE_RE.exec(reelsCode);
  return m ? `S-${m[1]}-I` : null;
}

/** Aynı haftanın Instagram sayfası yayındaysa slug'ı (B14). Stub (A öncesi): null. */
export async function loadWeekInstagramPageSlug(db: SupabaseClient, reelsCode: string): Promise<string | null> {
  void db;
  void reelsCode;
  return null;
}
