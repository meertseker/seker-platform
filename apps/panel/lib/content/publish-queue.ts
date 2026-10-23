import type { ContainerStatusCode } from "@/lib/ads/meta/publish";
import { MetaApiError } from "@/lib/ads/meta/insights";
import { addDaysToDateString, istanbulAt, istanbulDateString, parseIstanbulDateTime } from "@/lib/lead-flow/business-hours";
import { reelUploadBlockers, type ReelMediaMeta } from "./media-meta";

/**
 * Instagram yayın kuyruğu kuralları (spec K15, K16, §15 B3/B5/B6). Saf: eylem, koşucu ve ekran aynı kararları okur.
 * Hata kodları: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/error-codes
 */

export const IG_PUBLISH_STATUSES = ["yok", "kuyruk", "isleniyor", "yayinda", "hata"] as const;
export type IgPublishStatus = (typeof IG_PUBLISH_STATUSES)[number];

export function toIgPublishStatus(raw: unknown): IgPublishStatus {
  return (IG_PUBLISH_STATUSES as readonly string[]).includes(raw as string) ? (raw as IgPublishStatus) : "yok";
}

export type QueueRow = {
  id: string;
  code: string;
  topic: string;
  ownerId: string;
  kind: "reels" | "sayfa";
  status: string;
  stage: string;
  approverFaceCheck: boolean | null;
  mediaPath: string | null;
  mediaMeta: ReelMediaMeta | null;
  caption: string | null;
  igPublishStatus: IgPublishStatus;
  igContainerId: string | null;
  igPublishScheduledAt: string | null;
  igPublishRequestedBy: string | null;
  igPublishRequestedAt: string | null;
  igMediaId: string | null;
  igPermalink: string | null;
  updatedAt: string;
};

export const APPROVAL_REVOKED = "Onay geri alındı";
export const LEGACY_META_TEXT =
  "Video biçim bilgisi yok. Öğretmenden videoyu yeniden seçmesini isteyin ya da Instagram'da elle paylaşıp bağlantıyı yapıştırın.";

/** İstek anı kapısı: null = yayınlanabilir. */
export function publishBlocker(row: QueueRow): string | null {
  if (row.kind !== "reels") return "Yalnız Reels Instagram'da yayınlanır";
  if (row.status !== "onaylandi") return "Önce içeriği onaylayın";
  if (row.approverFaceCheck !== true) return "MEB kutusu işaretlenmeden yayınlanamaz";
  if (row.stage !== "organik") return "Bu aşamada yayınlanamaz";
  if (row.igMediaId || row.igPermalink) return "Bu içerik zaten Instagram'a bağlı";
  if (row.igPublishStatus === "kuyruk" || row.igPublishStatus === "isleniyor") return "Yayın zaten sırada";
  if (row.igPublishStatus === "yayinda") return "Zaten yayında";
  if (!row.mediaPath) return "Video yok";
  if (row.mediaMeta === null) return LEGACY_META_TEXT;
  return reelUploadBlockers(row.mediaMeta)[0] ?? null;
}

/** B6: cron yayından hemen önce yeniden okur. */
export function stillPublishable(row: QueueRow): boolean {
  return (
    row.status === "onaylandi" &&
    row.approverFaceCheck === true &&
    row.stage === "organik" &&
    (row.igPublishStatus === "kuyruk" || row.igPublishStatus === "isleniyor")
  );
}

export type QueueStep = { kind: "wait" } | { kind: "create" } | { kind: "poll" } | { kind: "fail"; error: string };

/** Konteyner açıldıktan sonra en çok bu kadar beklenir (açılış güncellemesinden sayılır). */
export const CONTAINER_TIMEOUT_MS = 60 * 60_000;
/** Eylemin satır içi yoklamasıyla yarışmamak için son güncellemeden sonra beklenen süre. */
export const POLL_GRACE_MS = 60_000;

export function nextStep(row: QueueRow, now: Date): QueueStep {
  if (row.igPublishStatus === "kuyruk") {
    if (row.igPublishScheduledAt && Date.parse(row.igPublishScheduledAt) > now.getTime()) return { kind: "wait" };
    return { kind: "create" };
  }
  if (row.igPublishStatus === "isleniyor") {
    const updated = Date.parse(row.updatedAt);
    // Eylem konteyneri açarken (1–30 sn) cron araya girmesin: önce bekleme payı.
    if (now.getTime() - updated < POLL_GRACE_MS) return { kind: "wait" };
    if (!row.igContainerId) return { kind: "fail", error: "Konteyner kaydı yok; tekrar deneyin" };
    // Gece koşu yok (07–22): akşam açılan konteynerin süresi o günün 07:00'sinden sayılır.
    const windowStart = istanbulAt(istanbulDateString(now), "07:00").getTime();
    if (now.getTime() - Math.max(updated, windowStart) > CONTAINER_TIMEOUT_MS) {
      return { kind: "fail", error: "Instagram videoyu 1 saatte işleyemedi; tekrar deneyin" };
    }
    return { kind: "poll" };
  }
  return { kind: "wait" };
}

export type ContainerOutcome = { kind: "publish" } | { kind: "wait" } | { kind: "recover" } | { kind: "fail"; error: string };

export function containerOutcome(s: { statusCode: ContainerStatusCode; errorSubcode: number | null }): ContainerOutcome {
  switch (s.statusCode) {
    case "FINISHED":
      return { kind: "publish" };
    case "PUBLISHED":
      return { kind: "recover" };
    case "EXPIRED":
      return { kind: "fail", error: "Instagram konteynerinin süresi doldu; tekrar deneyin" };
    case "ERROR":
      return { kind: "fail", error: igSubcodeText(s.errorSubcode) };
    default:
      return { kind: "wait" };
  }
}

export const DAILY_LIMIT_TEXT = "Günlük Instagram yayın hakkı doldu; yarın tekrar deneyin";
const TEMP_TEXT = "Instagram geçici hata verdi; tekrar deneyin";

const SUBCODE_TEXT: Record<number, string> = {
  2207042: DAILY_LIMIT_TEXT,
  2207052: "Instagram videoyu indiremedi; tekrar deneyin",
  2207026: "Video biçimi Instagram'a uymuyor (MP4/MOV, H.264). Öğretmenden yeniden çekim isteyin",
  2207057: "Kapak karesi videonun dışında; öğretmen kapağı yeniden seçmeli",
  2207050: "Instagram hesabı kısıtlı; Instagram uygulamasından bakın",
  2207051: "Instagram bu işlemi engelledi (spam sandı); bir süre sonra tekrar deneyin",
  2207020: "Yükleme süresi doldu; tekrar deneyin",
  2207001: TEMP_TEXT,
  2207003: TEMP_TEXT,
  2207032: TEMP_TEXT,
  2207053: TEMP_TEXT,
  2207027: TEMP_TEXT,
};

const CODE_TEXT: Record<number, string> = {
  9: DAILY_LIMIT_TEXT,
  9004: SUBCODE_TEXT[2207052],
  352: SUBCODE_TEXT[2207026],
  25: SUBCODE_TEXT[2207050],
  190: "Meta anahtarı geçersiz ya da süresi dolmuş (Mert)",
  10: "Instagram yayın izni yok (instagram_content_publish) · Mert",
  200: "Instagram yayın izni yok (instagram_content_publish) · Mert",
};

export function igSubcodeText(subcode: number | null): string {
  return (subcode !== null && SUBCODE_TEXT[subcode]) || "Instagram videoyu işleyemedi; tekrar deneyin";
}

const MAX_TEXT = 200;

export function igErrorText(err: unknown): string {
  if (err instanceof MetaApiError) {
    if (err.subcode !== null && SUBCODE_TEXT[err.subcode]) return SUBCODE_TEXT[err.subcode];
    if (err.code !== null && CODE_TEXT[err.code]) return CODE_TEXT[err.code];
    const text = `Instagram hatası: ${err.message}`;
    return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text;
  }
  return "Instagram'a ulaşılamadı; tekrar deneyin";
}

// === Zaman penceresi (İstanbul 07:00–22:59; crontab */5 7-22) ===

export const PUBLISH_WINDOW = { startHour: 7, endHour: 22 } as const;
const ISTANBUL_OFFSET_MS = 3 * 3_600_000;

function istanbulHour(at: Date): number {
  return new Date(at.getTime() + ISTANBUL_OFFSET_MS).getUTCHours();
}

export function inPublishWindow(at: Date): boolean {
  const h = istanbulHour(at);
  return h >= PUBLISH_WINDOW.startHour && h <= PUBLISH_WINDOW.endHour;
}

export function scheduleWarning(at: Date): string | null {
  return inPublishWindow(at)
    ? null
    : "Bu saat 07:00–23:00 dışında. Yayın ertesi sabah 07:00'den sonraki ilk koşuda yapılır.";
}

export function nextPublishWindowStart(at: Date): Date {
  if (inPublishWindow(at)) return at;
  const day = istanbulDateString(at);
  const start = istanbulAt(day, "07:00");
  return istanbulHour(at) < PUBLISH_WINDOW.startHour ? start : istanbulAt(addDaysToDateString(day, 1), "07:00");
}

export const SCHEDULE_MIN_MS = 10 * 60_000;
export const SCHEDULE_MAX_MS = 14 * 86_400_000;

/** "YYYY-MM-DDTHH:MM" İstanbul saati ya da ISO. */
export function validateSchedule(iso: string, now: Date): { at: Date } | { error: string } {
  const at = parseIstanbulDateTime(iso);
  if (!at || Number.isNaN(at.getTime())) return { error: "Saat geçersiz" };
  if (at.getTime() < now.getTime() + SCHEDULE_MIN_MS) return { error: "En erken 10 dakika sonrası seçilebilir" };
  if (at.getTime() > now.getTime() + SCHEDULE_MAX_MS) return { error: "En geç 14 gün sonrası seçilebilir" };
  return { at };
}
