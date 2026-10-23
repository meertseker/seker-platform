// Instagram yayın kuyruğunun veritabanı tarafı (servis rolü). Saf karar kuralları publish-queue.ts'te,
// adım motoru publish-runner.ts'te.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdChangeLogRow } from "@/lib/ads/writes";
import { insertNotifications } from "@/lib/notifications/insert";
import { parseReelMediaMeta } from "./media-meta";
import { toIgPublishStatus, type IgPublishStatus, type QueueRow } from "./publish-queue";
import { activeManagerIds, CONTENT_BUCKET } from "./store";

/** Yayın sürerken ad_change_log satırının hata metni (executeAdChange'in "Platform yanıtı bekleniyor" deseni). */
export const LOG_PENDING = "Yayın sürüyor";
/** Meta videoyu bu süre içinde indirir (spec K15: 1 saatlik imzalı URL). */
export const VIDEO_URL_SECONDS_FOR_META = 3600;

export type TransitionPatch = Partial<{
  ig_publish_status: IgPublishStatus;
  ig_container_id: string | null;
  ig_publish_error: string | null;
  ig_publish_scheduled_at: string | null;
  ig_publish_requested_by: string;
  ig_publish_requested_at: string;
  ig_media_id: string;
  ig_permalink: string;
  ig_published_at: string;
  caption: string;
}>;

export interface PublishStore {
  load(id: string): Promise<QueueRow | null>;
  /** Bekleyen (saati gelmiş) ve işlenen satırlar, eskiden yeniye. */
  listActive(limit: number): Promise<QueueRow[]>;
  /** Koşullu güncelleme: satır hâlâ `from` durumundaysa yazar; etkilenen satır yoksa false. */
  transition(id: string, from: IgPublishStatus, patch: TransitionPatch): Promise<boolean>;
  /**
   * media_publish'ten hemen önce sahiplenme: satır hâlâ `isleniyor` ve `updated_at` okunan değerse dokunur
   * (tetikleyici updated_at'i ilerletir); aynı anı okuyan ikinci koşu kaybeder ve yayınlamaz.
   */
  claim(id: string, updatedAt: string): Promise<boolean>;
  signedVideoUrl(path: string, seconds: number): Promise<string>;
  insertLog(row: AdChangeLogRow): Promise<string>;
  /** Bu içeriğin "Yayın sürüyor" bekleyen en yeni ig_yayin kaydını sonuçla günceller; yoksa hiçbir şey yapmaz. */
  finishLog(contentId: string, status: "uygulandi" | "hata", error: string | null, extra?: Record<string, unknown>): Promise<void>;
  notifyOwner(row: QueueRow, type: "ig_yayinlandi", payload: Record<string, unknown>): Promise<void>;
  notifyManagers(type: "ig_yayin_hata", payload: Record<string, unknown>): Promise<void>;
}

export const QUEUE_COLUMNS =
  "id, code, topic, owner_id, kind, status, stage, approver_face_check, media_path, media_meta, caption, ig_publish_status, ig_container_id, ig_publish_scheduled_at, ig_publish_requested_by, ig_publish_requested_at, ig_media_id, ig_permalink, updated_at";

type DbRow = {
  id: string;
  code: string;
  topic: string;
  owner_id: string;
  kind: string;
  status: string;
  stage: string;
  approver_face_check: boolean | null;
  media_path: string | null;
  media_meta: unknown;
  caption: string | null;
  ig_publish_status: string;
  ig_container_id: string | null;
  ig_publish_scheduled_at: string | null;
  ig_publish_requested_by: string | null;
  ig_publish_requested_at: string | null;
  ig_media_id: string | null;
  ig_permalink: string | null;
  updated_at: string;
};

export function toQueueRow(r: DbRow): QueueRow {
  return {
    id: r.id,
    code: r.code,
    topic: r.topic,
    ownerId: r.owner_id,
    kind: r.kind === "sayfa" ? "sayfa" : "reels",
    status: r.status,
    stage: r.stage,
    approverFaceCheck: r.approver_face_check,
    mediaPath: r.media_path,
    mediaMeta: parseReelMediaMeta(r.media_meta),
    caption: r.caption,
    igPublishStatus: toIgPublishStatus(r.ig_publish_status),
    igContainerId: r.ig_container_id,
    igPublishScheduledAt: r.ig_publish_scheduled_at,
    igPublishRequestedBy: r.ig_publish_requested_by,
    igPublishRequestedAt: r.ig_publish_requested_at,
    igMediaId: r.ig_media_id,
    igPermalink: r.ig_permalink,
    updatedAt: r.updated_at,
  };
}

function must(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export function supabasePublishStore(db: SupabaseClient): PublishStore {
  return {
    async load(id) {
      const { data, error } = await db.from("content_items").select(QUEUE_COLUMNS).eq("id", id).maybeSingle();
      must(error);
      return data ? toQueueRow(data as unknown as DbRow) : null;
    },
    async listActive(limit) {
      const nowIso = new Date().toISOString();
      const { data, error } = await db
        .from("content_items")
        .select(QUEUE_COLUMNS)
        .in("ig_publish_status", ["kuyruk", "isleniyor"])
        .or(`ig_publish_scheduled_at.is.null,ig_publish_scheduled_at.lte.${nowIso}`)
        .order("updated_at", { ascending: true })
        .limit(limit);
      must(error);
      return ((data ?? []) as unknown as DbRow[]).map(toQueueRow);
    },
    async transition(id, from, patch) {
      // updated_at content_items_touch tetikleyicisiyle güncellenir (konteyner zaman aşımı buna dayanır).
      const { data, error } = await db
        .from("content_items")
        .update(patch)
        .eq("id", id)
        .eq("ig_publish_status", from)
        .select("id");
      must(error);
      return (data ?? []).length > 0;
    },
    async claim(id, updatedAt) {
      const { data, error } = await db
        .from("content_items")
        .update({ ig_publish_error: null })
        .eq("id", id)
        .eq("ig_publish_status", "isleniyor")
        .eq("updated_at", updatedAt)
        .select("id");
      must(error);
      return (data ?? []).length > 0;
    },
    async signedVideoUrl(path, seconds) {
      const { data, error } = await db.storage.from(CONTENT_BUCKET).createSignedUrl(path, seconds);
      if (error || !data?.signedUrl) throw new Error(error?.message ?? "İmzalı video adresi üretilemedi");
      return data.signedUrl;
    },
    async insertLog(row) {
      const { data, error } = await db
        .from("ad_change_log")
        .insert({
          platform: row.platform,
          level: row.level,
          object_id: row.objectId,
          object_name: row.objectName,
          action: row.action,
          old_value: row.oldValue,
          new_value: row.newValue,
          reason: row.reason,
          gate_red: row.gateRed,
          source: row.source,
          recommendation_id: row.recommendationId,
          status: row.status,
          error: row.error,
          actor_id: row.actorId,
        })
        .select("id")
        .single();
      must(error);
      return (data as { id: string }).id;
    },
    async finishLog(contentId, status, error, extra) {
      const found = await db
        .from("ad_change_log")
        .select("id, new_value")
        .eq("action", "ig_yayin")
        .eq("object_id", contentId)
        .eq("status", "hata")
        .eq("error", LOG_PENDING)
        .order("created_at", { ascending: false })
        .limit(1);
      must(found.error);
      const hit = (found.data ?? [])[0] as { id: string; new_value: Record<string, unknown> | null } | undefined;
      if (!hit) return;
      const patch: Record<string, unknown> = { status, error };
      if (extra) patch.new_value = { ...(hit.new_value ?? {}), ...extra };
      const upd = await db.from("ad_change_log").update(patch).eq("id", hit.id);
      must(upd.error);
    },
    async notifyOwner(row, type, payload) {
      const { error } = await insertNotifications(db, [{ user_id: row.ownerId, type, payload }]);
      if (error) console.error(`Bildirim yazılamadı: ${error.message}`);
    },
    async notifyManagers(type, payload) {
      const ids = await activeManagerIds(db);
      if (ids.length === 0) return;
      const { error } = await insertNotifications(
        db,
        ids.map((user_id) => ({ user_id, type, payload })),
      );
      if (error) console.error(`Bildirim yazılamadı: ${error.message}`);
    },
  };
}
