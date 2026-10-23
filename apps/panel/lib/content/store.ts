// İçerik eylemlerinin yardımcıları: teslim kontrolü, video dosya adı ve sınırı, gizli anahtarlı istemci sorguları.
import type { SupabaseClient } from "@supabase/supabase-js";
import { AD_HEADLINE_MAX, AD_PRIMARY_TEXT_MAX, isLpMediaKey } from "@seker/shared/landing";
import { checkText, submissionBlockers } from "./checks";
import type { ContentKind } from "./codes";
import type { ContentRules } from "./settings";

export const CONTENT_BUCKET = "icerik";
export const VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime"] as const;
export const DEFAULT_VIDEO_MAX_MB = 50;
const MB = 1024 * 1024;

/** Sayfa görevinin alanları (Görevim ekranı): başlık Google reklamında da 1. başlıktır. */
export const PAGE_FIELDS: { key: string; label: string }[] = [
  { key: "baslik", label: "Sayfa başlığı" },
  { key: "alt_baslik", label: "Alt başlık" },
  { key: "blok1_baslik", label: "1. blok başlığı" },
  { key: "blok1_metin", label: "1. blok metni" },
  { key: "blok2_baslik", label: "2. blok başlığı" },
  { key: "blok2_metin", label: "2. blok metni" },
  { key: "blok3_baslik", label: "3. blok başlığı" },
  { key: "blok3_metin", label: "3. blok metni" },
];
/** Sayfa görevinin reklam alanları (Instagram sayfasında formda görünür; teslimde zorunlu değil). */
export const PAGE_AD_FIELDS: { key: "adPrimaryText" | "adHeadline"; label: string; max: number }[] = [
  { key: "adPrimaryText", label: "Reklam cümlesi (Instagram'da görünür)", max: AD_PRIMARY_TEXT_MAX },
  { key: "adHeadline", label: "Reklam başlığı", max: AD_HEADLINE_MAX },
];
const PAGE_AD_LABELS: Record<string, string> = { adPrimaryText: "Reklam cümlesi", adHeadline: "Reklam başlığı" };
/** Taslakta kabul edilen anahtarlar: metin alanları, reklam alanları ve görsel anahtarı. */
const PAGE_FIELD_KEYS = new Set([...PAGE_FIELDS.map((f) => f.key), ...PAGE_AD_FIELDS.map((f) => f.key), "mediaKey"]);

export function isPageFieldKey(key: string): boolean {
  return PAGE_FIELD_KEYS.has(key);
}

export type SubmittableRow = {
  kind: ContentKind;
  caption: string | null;
  page_fields: Record<string, unknown> | null;
  media_path: string | null;
  face_answer: boolean | null;
};

/**
 * Sunucu tarafı teslim kontrolü (istemci kontrolü atlansa da çalışır).
 * Reels: video, yüz sorusu (MEB Ek Madde 4) ve açıklama. Sayfa: başlık tam kontrolden,
 * dolu diğer alanlar yasaklı ifade kontrolünden geçer; görsel listeden seçilmiş olmalı, dolu reklam
 * alanları sınır ve yasaklı ifade kontrolünden geçer.
 */
export function contentBlockers(row: SubmittableRow, rules: ContentRules): string[] {
  const { banned, limits } = rules;
  if (row.kind === "reels") {
    return submissionBlockers(
      { kind: "reels", text: row.caption ?? "", hasVideo: !!row.media_path, faceAnswer: row.face_answer },
      { max: limits.reelsCaption, min: limits.min, banned },
    );
  }
  const fields = row.page_fields ?? {};
  const text = (key: string) => (typeof fields[key] === "string" ? (fields[key] as string) : "");
  const out = submissionBlockers(
    { kind: "sayfa", text: text("baslik"), hasVideo: false, faceAnswer: null },
    { max: limits.pageTitle, min: limits.min, banned },
  );
  for (const { key, label } of PAGE_FIELDS) {
    if (key === "baslik" || text(key).trim() === "") continue;
    const check = checkText(text(key), { max: Number.POSITIVE_INFINITY, min: 0, banned });
    if (!check.ok) out.push(`${label}: ${check.message}`);
  }
  if (!isLpMediaKey(fields.mediaKey)) out.push("Görsel seç");
  for (const { key, max } of PAGE_AD_FIELDS) {
    if (text(key).trim() === "") continue;
    const check = checkText(text(key), { max, min: 0, banned });
    if (!check.ok) out.push(`${PAGE_AD_LABELS[key]}: ${check.message}`);
  }
  return out;
}

/** Uygulama video sınırı (MB): CONTENT_VIDEO_MAX_MB, yoksa ya da bozuksa 50. */
export function videoMaxMb(): number {
  const n = Number(process.env.CONTENT_VIDEO_MAX_MB);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_VIDEO_MAX_MB;
}

export function videoSizeError(size: number, maxMb: number): string | null {
  if (size <= maxMb * MB) return null;
  const n = Math.ceil(size / MB);
  return `Video ${n} MB, en fazla ${maxMb} MB olabilir. Telefon kamerasında 1080p 30 kare seçip yeniden çek ya da videoyu paylaşırken 'daha küçük boyut' seç.`;
}

function foldTr(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ö/g, "o").replace(/ü/g, "u")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Depo dosya adı: yalnız [a-z0-9._-], klasör ve ".." içermez; uzantı türden gelir, sonuna tekil ek konur. */
export function safeVideoFileName(fileName: string, mime: string, suffix: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = mime === "video/quicktime" ? "mov" : "mp4";
  const clean = foldTr(stem).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
  const tail = suffix.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${clean || "video"}${tail ? `-${tail}` : ""}.${ext}`;
}

/** Yol yalnız <owner_id>/<content_id>/<dosya-adı> (DB tetikleyicisiyle aynı kural). */
export function isOwnMediaPath(path: string, ownerId: string, contentId: string): boolean {
  const prefix = `${ownerId}/${contentId}/`;
  const name = path.slice(prefix.length);
  return path.startsWith(prefix) && name.length > 0 && !name.includes("/") && !path.includes("..");
}

/** Haftanın alınmış kodları (kod üretimi için). */
export async function takenCodes(admin: SupabaseClient, weekStart: string): Promise<string[]> {
  const { data, error } = await admin.from("content_items").select("code").eq("week_start", weekStart);
  if (error) throw new Error(`Haftanın kodları okunamadı: ${error.message}`);
  return ((data ?? []) as { code: string }[]).map((r) => r.code);
}

export async function activeManagerIds(admin: SupabaseClient): Promise<string[]> {
  const { data } = await admin.from("profiles").select("id").eq("role", "yonetici").eq("is_active", true);
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

/** Video depoda gerçekten var mı? (Yol yazılıp yükleme yapılmadan teslim edilemesin.) */
export async function videoExists(admin: SupabaseClient, path: string): Promise<boolean> {
  const slash = path.lastIndexOf("/");
  const folder = path.slice(0, slash);
  const name = path.slice(slash + 1);
  const { data, error } = await admin.storage.from(CONTENT_BUCKET).list(folder, { limit: 100, search: name });
  if (error) return false;
  return (data ?? []).some((o) => o.name === name);
}
