// Öğretmenin Görevim ekranı sorguları ve etiketleri. Öğretmen yalnız kendi satırlarını görür (RLS + owner_id süzgeci).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentKind, PagePlatform } from "@/lib/content/codes";
import { parseReelMediaMeta, type ReelMediaMeta } from "@/lib/content/media-meta";

export type MyTask = {
  id: string;
  code: string;
  kind: ContentKind;
  platform: PagePlatform;
  topic: string;
  audience: string | null;
  brief: string | null;
  dueAt: string | null;
  status: string;
  caption: string | null;
  pageFields: Record<string, string>;
  mediaPath: string | null;
  /** `reel`: K17 biçim bilgisi (eski yüklemede null). */
  mediaMeta: { name: string; size: number; durationSec?: number; reel: ReelMediaMeta | null } | null;
  faceAnswer: boolean | null;
  reviewNote: string | null;
  submittedAt: string | null;
};

const COLUMNS =
  "id, code, kind, platform, topic, audience, brief, due_at, status, caption, page_fields, media_path, media_meta, face_answer, review_note, submitted_at";
const RECENT_DAYS = 28;

type Row = {
  id: string; code: string; kind: string; platform: string; topic: string; audience: string | null;
  brief: string | null; due_at: string | null; status: string; caption: string | null;
  page_fields: Record<string, unknown> | null; media_path: string | null;
  media_meta: { name?: unknown; size?: unknown; durationSec?: unknown } | null;
  face_answer: boolean | null; review_note: string | null; submitted_at: string | null;
};

export function isOpenTask(t: Pick<MyTask, "status">): boolean {
  return t.status === "taslak" || t.status === "duzeltme";
}

function toTask(r: Row): MyTask {
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(r.page_fields ?? {})) if (typeof v === "string") fields[k] = v;
  const m = r.media_meta;
  return {
    id: r.id, code: r.code, kind: r.kind === "sayfa" ? "sayfa" : "reels",
    platform: r.platform === "google" ? "google" : "instagram",
    topic: r.topic, audience: r.audience, brief: r.brief, dueAt: r.due_at, status: r.status,
    caption: r.caption, pageFields: fields, mediaPath: r.media_path,
    mediaMeta:
      m && typeof m.name === "string" && typeof m.size === "number"
        ? {
            name: m.name,
            size: m.size,
            ...(typeof m.durationSec === "number" ? { durationSec: m.durationSec } : {}),
            reel: parseReelMediaMeta(m),
          }
        : null,
    faceAnswer: r.face_answer, reviewNote: r.review_note, submittedAt: r.submitted_at,
  };
}

/** Açık görevler önce (son tarihe göre, tarihsiz sonda), sonra teslim edilenler (yeniden eskiye). */
export function sortMyTasks(tasks: MyTask[]): MyTask[] {
  const time = (s: string | null, fallback: number) => (s ? new Date(s).getTime() : fallback);
  const open = tasks
    .filter(isOpenTask)
    .sort((a, b) => time(a.dueAt, Infinity) - time(b.dueAt, Infinity));
  const done = tasks
    .filter((t) => !isOpenTask(t))
    .sort((a, b) => time(b.submittedAt, 0) - time(a.submittedAt, 0));
  return [...open, ...done];
}

export async function loadMyTasks(supabase: SupabaseClient, me: string, now: Date = new Date()): Promise<MyTask[]> {
  const since = new Date(now.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("content_items")
    .select(COLUMNS)
    .eq("owner_id", me)
    .or(`status.in.(taslak,duzeltme),updated_at.gte.${since}`);
  return sortMyTasks(((data ?? []) as Row[]).map(toTask));
}

export function taskHeaderLabel(task: Pick<MyTask, "code" | "kind" | "platform">): string {
  if (task.kind === "reels") return `${task.code} · Reels`;
  return `${task.code} · ${task.platform === "google" ? "Google" : "Instagram"} sayfası`;
}

const dueFormatter = new Intl.DateTimeFormat("tr-TR", {
  weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Istanbul",
});

/** "Teslim: Perşembe 17:00" (İstanbul). `now` yalnız çağıranın saatini sabitlemek içindir. */
export function dueLabel(dueAt: string | null, now: Date): string {
  void now;
  if (!dueAt) return "";
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return "";
  const parts = dueFormatter.formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "";
  return `Teslim: ${get("weekday")} ${get("hour")}:${get("minute")}`;
}

/** Teslim zamanı geçmiş mi (açık görev için uyarı rengi). */
export function isOverdue(dueAt: string | null, now: Date): boolean {
  return !!dueAt && new Date(dueAt).getTime() < now.getTime();
}
