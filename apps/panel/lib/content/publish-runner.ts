// Instagram yayınının tek adım motoru. Hem "Instagram'da yayınla" eylemi (ilk adım) hem /api/cron/content
// (kalan adımlar) çağırır. Her adımdan önce satır yeniden okunur; yazımlar koşulludur (çift yayın yok).
import type { MetaConfig } from "@/lib/ads/meta/config";
import { igPublishEnabled } from "@/lib/ads/meta/config";
import { MetaApiError } from "@/lib/ads/meta/insights";
import { listMedia } from "@/lib/ads/meta/instagram";
import {
  createReelContainer,
  fetchPublishedMedia,
  getContainerStatus,
  getPublishingLimit,
  publishContainer,
} from "@/lib/ads/meta/publish";
import type { FetchFn } from "@/lib/ads/types";
import { DEFAULT_COVER_OFFSET_MS } from "./media-meta";
import {
  APPROVAL_REVOKED,
  containerOutcome,
  DAILY_LIMIT_TEXT,
  igErrorText,
  nextStep,
  stillPublishable,
  type IgPublishStatus,
  type QueueRow,
} from "./publish-queue";
import { VIDEO_URL_SECONDS_FOR_META, type PublishStore, type TransitionPatch } from "./publish-store";

export type PublishDeps = {
  store: PublishStore;
  cfg: MetaConfig | null;
  env: Record<string, string | undefined>;
  fetchFn?: FetchFn;
  now?: () => Date;
};

export type ProcessResult = { status: IgPublishStatus; error: string | null };

export const FLAG_OFF_TEXT = "İçerik yayını kapatıldı; açılınca yeniden yayınlayın";
export const NOT_CONNECTED_TEXT = "Instagram bağlantısı kurulmadı";
export const RECOVER_MISSING_TEXT = "Instagram'da yayınlandı ama bağlantı bulunamadı; bağlantıyı elle yapıştırın";

/** Meta zamanı "2026-10-24T09:12:00+0000" → ISO; okunamazsa null. */
function isoFromMeta(ts: string | null): string | null {
  if (!ts) return null;
  const ms = Date.parse(ts.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

function isDailyLimit(err: unknown): boolean {
  return err instanceof MetaApiError && (err.subcode === 2207042 || (err.subcode === null && err.code === 9));
}

function normCaption(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

export async function processItem(deps: PublishDeps, id: string): Promise<ProcessResult> {
  const { store, cfg, env } = deps;
  const fetchFn = deps.fetchFn ?? fetch;
  const now = deps.now?.() ?? new Date();

  const row = await store.load(id);
  if (!row) return { status: "hata", error: "İçerik bulunamadı" };
  if (row.igPublishStatus !== "kuyruk" && row.igPublishStatus !== "isleniyor") return { status: row.igPublishStatus, error: null };

  let current: IgPublishStatus = row.igPublishStatus;

  async function fail(error: string): Promise<ProcessResult> {
    const moved = await store.transition(row!.id, current, { ig_publish_status: "hata", ig_publish_error: error });
    if (!moved) {
      const fresh = await store.load(row!.id);
      return { status: fresh?.igPublishStatus ?? current, error: null };
    }
    current = "hata";
    await store.finishLog(row!.id, "hata", error);
    await store.notifyManagers("ig_yayin_hata", { contentId: row!.id, code: row!.code, error });
    return { status: "hata", error };
  }

  async function backToQueue(error: string): Promise<ProcessResult> {
    const patch: TransitionPatch =
      current === "kuyruk" ? { ig_publish_error: error } : { ig_publish_status: "kuyruk", ig_publish_error: error, ig_container_id: null };
    if (await store.transition(row!.id, current, patch)) current = "kuyruk";
    return { status: current, error };
  }

  async function succeed(media: { id: string; permalink: string | null; timestamp: string | null }): Promise<ProcessResult> {
    const patch: TransitionPatch = {
      ig_publish_status: "yayinda",
      ig_media_id: media.id,
      ig_published_at: isoFromMeta(media.timestamp) ?? now.toISOString(),
      ig_publish_error: null,
    };
    if (media.permalink) patch.ig_permalink = media.permalink;
    if (!(await store.transition(row!.id, current, patch))) {
      const fresh = await store.load(row!.id);
      return { status: fresh?.igPublishStatus ?? current, error: null };
    }
    current = "yayinda";
    await store.finishLog(row!.id, "uygulandi", null, { mediaId: media.id, permalink: media.permalink });
    await store.notifyOwner(row!, "ig_yayinlandi", { contentId: row!.id, code: row!.code });
    return { status: "yayinda", error: null };
  }

  // 1. Bayrak ve bağlantı (B5: kapalıyken Meta'ya hiçbir istek yok).
  if (!igPublishEnabled(env)) return fail(FLAG_OFF_TEXT);
  if (!cfg?.instagramUserId) return fail(NOT_CONNECTED_TEXT);
  // 2. B6: onay, MEB, aşama.
  if (!stillPublishable(row)) return fail(APPROVAL_REVOKED);

  const scheduled = row.igPublishScheduledAt !== null;
  try {
    const step = nextStep(row, now);
    if (step.kind === "wait") return { status: current, error: null };
    if (step.kind === "fail") return fail(step.error);

    let containerId = row.igContainerId;
    if (step.kind === "create") {
      let remaining: number | null = null;
      try {
        remaining = (await getPublishingLimit(cfg, fetchFn)).remaining;
      } catch {
        remaining = null; // okunamazsa engellenmez; Meta 2207042 ile reddeder
      }
      if (remaining !== null && remaining <= 0) {
        return scheduled ? backToQueue(DAILY_LIMIT_TEXT) : fail(DAILY_LIMIT_TEXT);
      }
      // Önce koşullu geçiş: kazanılmazsa (başka koşu aldı) Meta'ya gidilmez.
      if (!(await store.transition(row.id, "kuyruk", { ig_publish_status: "isleniyor", ig_publish_error: null, ig_container_id: null }))) {
        const fresh = await store.load(row.id);
        return { status: fresh?.igPublishStatus ?? current, error: null };
      }
      current = "isleniyor";
      if (!row.mediaPath) return fail("Video yok");
      const videoUrl = await store.signedVideoUrl(row.mediaPath, VIDEO_URL_SECONDS_FOR_META);
      containerId = await createReelContainer(
        cfg,
        { videoUrl, caption: row.caption ?? "", thumbOffsetMs: row.mediaMeta?.coverOffsetMs ?? DEFAULT_COVER_OFFSET_MS },
        fetchFn,
      );
      await store.transition(row.id, "isleniyor", { ig_container_id: containerId });
    }

    // 3. Yoklama.
    const status = await getContainerStatus(cfg, containerId!, fetchFn);
    const outcome = containerOutcome(status);
    if (outcome.kind === "wait") return { status: current, error: null };
    if (outcome.kind === "fail") return fail(outcome.error);

    // 4. Yayından hemen önce B6 yeniden.
    const fresh = await store.load(row.id);
    if (!fresh || !stillPublishable(fresh)) return fail(APPROVAL_REVOKED);

    if (outcome.kind === "recover") {
      const since = row.igPublishRequestedAt ? Date.parse(row.igPublishRequestedAt) : 0;
      const want = normCaption(row.caption);
      const list = await listMedia(cfg, fetchFn);
      const hit = list.find((m) => {
        const t = Date.parse((m.timestamp ?? "").replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
        return Number.isFinite(t) && t >= since && normCaption(m.caption) === want;
      });
      if (!hit) return fail(RECOVER_MISSING_TEXT);
      return succeed({ id: hit.id, permalink: hit.permalink, timestamp: hit.timestamp });
    }

    const mediaId = await publishContainer(cfg, containerId!, fetchFn);
    let media: { id: string; permalink: string | null; timestamp: string | null } = { id: mediaId, permalink: null, timestamp: null };
    try {
      media = await fetchPublishedMedia(cfg, mediaId, fetchFn);
    } catch {
      // Yayın oldu; bağlantı sabah senkronunda ya da elle tamamlanır.
    }
    return succeed(media);
  } catch (err) {
    const text = igErrorText(err);
    if (isDailyLimit(err) && scheduled) return backToQueue(text);
    return fail(text);
  }
}

export async function runPublishQueue(
  deps: PublishDeps,
  limit = 5,
): Promise<{ processed: number; published: number; failed: number }> {
  const rows = await deps.store.listActive(limit);
  let published = 0;
  let failed = 0;
  for (const r of rows) {
    try {
      const res = await processItem(deps, r.id);
      if (res.status === "yayinda") published += 1;
      if (res.status === "hata") failed += 1;
    } catch (err) {
      failed += 1;
      console.error("[cron/content]", r.code, err instanceof Error ? err.message : String(err));
    }
  }
  return { processed: rows.length, published, failed };
}

export type { QueueRow };
