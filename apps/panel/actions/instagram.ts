"use server";
// Instagram'a yayın eylemleri (Reklam Konsolu Paket B, spec K15–K17, K22, §15 B2/B5/B6).
// actions/content.ts'e dokunulmaz (spec §11); yayın burada, kayıt ad_change_log'da.
import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@seker/auth/admin";
import { requireRole } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { igPublishEnabled, readMetaConfig } from "@/lib/ads/meta/config";
import { checkText } from "@/lib/content/checks";
import { getContentRules } from "@/lib/content/settings";
import { buildReelMediaMeta, DEFAULT_COVER_OFFSET_MS, reelUploadBlockers } from "@/lib/content/media-meta";
import {
  inPublishWindow,
  publishBlocker,
  scheduleWarning,
  validateSchedule,
  type IgPublishStatus,
} from "@/lib/content/publish-queue";
import { LOG_PENDING, supabasePublishStore } from "@/lib/content/publish-store";
import { processItem } from "@/lib/content/publish-runner";
import { formatDayTime } from "@/lib/lead-flow/business-hours";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOARD = "/reklam/icerik";
const NOT_FOUND = "İçerik bulunamadı";
const CHANGED = "İçerik değişti, sayfayı yenileyin";
/** Instagram açıklama üst sınırı. */
const IG_CAPTION_MAX = 2200;

export type PublishReelResult =
  | { ok: true; state: IgPublishStatus | "kapali"; message: string; warning?: string }
  | { error: string };

export async function publishReel(
  contentId: string,
  input: { caption: string; scheduledAt?: string | null },
): Promise<PublishReelResult> {
  // Rol kapısı gizli anahtarlı istemciden önce.
  const me = await requireRole("yonetici");
  if (!UUID_RE.test(contentId ?? "")) return { error: NOT_FOUND };
  const caption = typeof input?.caption === "string" ? input.caption : "";
  if (caption.length > IG_CAPTION_MAX) return { error: `Açıklama en fazla ${IG_CAPTION_MAX} karakter olabilir` };

  const admin = createAdminSupabase();
  const rules = await getContentRules(admin);
  const check = checkText(caption, { max: rules.limits.reelsCaption, min: rules.limits.min, banned: rules.banned });
  if (!check.ok) return { error: check.message };

  const now = new Date();
  let at: Date | null = null;
  if (input?.scheduledAt) {
    const v = validateSchedule(input.scheduledAt, now);
    if ("error" in v) return { error: v.error };
    at = v.at;
  }

  const store = supabasePublishStore(admin);
  const row = await store.load(contentId);
  if (!row) return { error: NOT_FOUND };
  const blocker = publishBlocker(row);
  if (blocker) return { error: blocker };

  const enabled = igPublishEnabled();
  // B2: önce kayıt. Bayrak kapalıyken yalnız bu satır yazılır (B5).
  try {
    await store.insertLog({
      platform: "meta",
      level: "icerik",
      objectId: row.id,
      objectName: `${row.code} · ${row.topic}`.slice(0, 200),
      action: "ig_yayin",
      oldValue: { ig_publish_status: row.igPublishStatus, caption: row.caption },
      newValue: {
        caption,
        scheduledAt: at ? at.toISOString() : null,
        thumbOffsetMs: row.mediaMeta?.coverOffsetMs ?? DEFAULT_COVER_OFFSET_MS,
        shareToFeed: true,
      },
      reason: null,
      gateRed: false,
      source: "icerik",
      recommendationId: null,
      status: enabled ? "hata" : "uygulanmadi_kapali",
      error: enabled ? LOG_PENDING : null,
      actorId: me.id,
    });
  } catch {
    return { error: "Kayıt yazılamadı; yayınlanmadı." };
  }
  if (!enabled) {
    revalidatePath(BOARD);
    return { ok: true, state: "kapali", message: "Kaydedildi · yayınlanmadı: içerik yayını kapalı" };
  }

  const moved = await store.transition(row.id, row.igPublishStatus, {
    ig_publish_status: "kuyruk",
    ig_publish_requested_by: me.id,
    ig_publish_requested_at: now.toISOString(),
    ig_publish_scheduled_at: at ? at.toISOString() : null,
    ig_publish_error: null,
    ig_container_id: null,
    caption,
  });
  if (!moved) {
    await store.finishLog(row.id, "hata", CHANGED);
    return { error: CHANGED };
  }
  revalidatePath(BOARD);

  if (at) {
    const warning = scheduleWarning(at);
    return { ok: true, state: "kuyruk", message: `Planlandı · ${formatDayTime(at)}`, ...(warning ? { warning } : {}) };
  }

  let result: { status: IgPublishStatus; error: string | null };
  try {
    result = await processItem({ store, cfg: readMetaConfig(), env: process.env }, row.id);
  } catch (err) {
    console.error("[publishReel]", err instanceof Error ? err.message : String(err));
    return { ok: true, state: "kuyruk", message: "Yayın sırada; birkaç dakika içinde tamamlanır" };
  }
  revalidatePath(BOARD);
  switch (result.status) {
    case "yayinda":
      return { ok: true, state: "yayinda", message: "Yayında · 72 saat başladı" };
    case "hata":
      return { error: `Yayınlanamadı: ${result.error ?? "bilinmeyen hata"}` };
    case "isleniyor":
      return {
        ok: true,
        state: "isleniyor",
        message: "Instagram videoyu işliyor; birkaç dakika içinde yayınlanır",
        ...(inPublishWindow(now) ? {} : { warning: "Gece yayın sırası kapalı; yayın sabah 07:00'den sonra tamamlanır." }),
      };
    default:
      return { ok: true, state: result.status, message: "Yayın sırada; birkaç dakika içinde tamamlanır" };
  }
}

type VideoMetaInput = { durationS: number; width: number; height: number; coverOffsetMs?: number | null; subtitled: boolean };

/**
 * Öğretmen yüklemesinde K17 biçim bilgisini yazar (oturum istemcisi: RLS + kolon yetkisi).
 * saveContentDraft media_meta'yı {name,size,durationSec}'e indirdiği için ayrı eylem; mevcut alanlarla birleştirir.
 */
export async function saveReelVideoMeta(contentId: string, meta: VideoMetaInput): Promise<{ ok: true } | { error: string }> {
  const profile = await requireRole("ogretmen");
  if (!UUID_RE.test(contentId ?? "")) return { error: NOT_FOUND };
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  if (!meta || !num(meta.durationS) || !num(meta.width) || !num(meta.height) || typeof meta.subtitled !== "boolean") {
    return { error: "Video bilgisi geçersiz" };
  }
  if (meta.coverOffsetMs != null && !num(meta.coverOffsetMs)) return { error: "Video bilgisi geçersiz" };
  const blockers = reelUploadBlockers(meta);
  if (blockers.length > 0) return { error: blockers[0] };

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("content_items")
    .select("id, owner_id, kind, status, media_meta")
    .eq("id", contentId)
    .maybeSingle();
  const row = data as { id: string; owner_id: string; kind: string; status: string; media_meta: unknown } | null;
  const locked = { error: "Bu içerik şu an değiştirilemez" } as const;
  if (!row || row.owner_id !== profile.id) return { error: NOT_FOUND };
  if (row.kind !== "reels" || (row.status !== "taslak" && row.status !== "duzeltme")) return locked;

  const current =
    row.media_meta && typeof row.media_meta === "object" && !Array.isArray(row.media_meta)
      ? (row.media_meta as Record<string, unknown>)
      : {};
  const { data: updated, error } = await supabase
    .from("content_items")
    .update({ media_meta: { ...current, ...buildReelMediaMeta(meta) } })
    .eq("id", contentId)
    .eq("owner_id", profile.id)
    .in("status", ["taslak", "duzeltme"])
    .eq("kind", "reels")
    .select("id");
  if (error) return { error: "Video bilgisi kaydedilemedi" };
  if (!updated || (updated as unknown[]).length === 0) return locked;
  return { ok: true };
}
