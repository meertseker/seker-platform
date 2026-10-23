// Reklam sayfası (landing_pages) okuma/taslak yardımcıları ve site adresleri.
// Yazma yalnız gizli anahtarlı istemciyle (sunucu eylemleri); tablo RLS'te yalnız okunur.
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminSupabase } from "@seker/auth/admin";
import { parseLandingFields, type LandingFields } from "@seker/shared/landing";
import { siteBaseUrl } from "./site";

export { siteBaseUrl };

export type LandingPageStatus = "taslak" | "yayinda" | "arsiv";

export type LandingPageRow = {
  id: string;
  slug: string | null;
  contentId: string;
  status: LandingPageStatus;
  fields: LandingFields;
  previewToken: string;
  publishedAt: string | null;
  publishedBy: string | null;
  archivedAt: string | null;
  updatedAt: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const LANDING_COLUMNS =
  "id, slug, content_id, status, fields, preview_token, published_at, published_by, archived_at, updated_at";

type DbRow = {
  id: string;
  slug: string | null;
  content_id: string;
  status: string;
  fields: unknown;
  preview_token: string;
  published_at: string | null;
  published_by: string | null;
  archived_at: string | null;
  updated_at: string;
};

function toStatus(s: string): LandingPageStatus {
  return s === "yayinda" || s === "arsiv" ? s : "taslak";
}

export function toLandingPageRow(r: DbRow): LandingPageRow {
  return {
    id: r.id,
    slug: r.slug,
    contentId: r.content_id,
    status: toStatus(r.status),
    fields: parseLandingFields(r.fields),
    previewToken: r.preview_token,
    publishedAt: r.published_at,
    publishedBy: r.published_by,
    archivedAt: r.archived_at,
    updatedAt: r.updated_at,
  };
}

/** İçeriğin sayfa satırı; yoksa null. Varsayılan istemci gizli anahtarlıdır. */
export async function getLandingPageByContent(
  contentId: string,
  client?: SupabaseClient,
): Promise<LandingPageRow | null> {
  if (!UUID_RE.test(contentId ?? "")) return null;
  const db = client ?? (createAdminSupabase() as unknown as SupabaseClient);
  const { data, error } = await db.from("landing_pages").select(LANDING_COLUMNS).eq("content_id", contentId).maybeSingle();
  if (error) throw new Error(`Sayfa okunamadı: ${error.message}`);
  return data ? toLandingPageRow(data as DbRow) : null;
}

/** Satır varsa onu döner; yoksa önizleme anahtarıyla taslak açar. */
export async function ensureLandingDraft(admin: SupabaseClient, contentId: string): Promise<LandingPageRow> {
  const existing = await getLandingPageByContent(contentId, admin);
  if (existing) return existing;
  const { data, error } = await admin
    .from("landing_pages")
    .insert({ content_id: contentId, status: "taslak", preview_token: randomBytes(32).toString("base64url") })
    .select(LANDING_COLUMNS)
    .single();
  if (error) {
    // Aynı anda iki istek: diğerinin açtığı satırı kullan.
    if ((error as { code?: string }).code === "23505") {
      const again = await getLandingPageByContent(contentId, admin);
      if (again) return again;
    }
    throw new Error(`Sayfa açılamadı: ${error.message}`);
  }
  return toLandingPageRow(data as DbRow);
}

/** Adres başka bir içeriğin sayfasında kullanılıyor mu? */
export async function isSlugTaken(admin: SupabaseClient, slug: string, exceptContentId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("landing_pages")
    .select("content_id")
    .eq("slug", slug)
    .neq("content_id", exceptContentId)
    .limit(1);
  if (error) throw new Error(`Sayfa okunamadı: ${error.message}`);
  return Array.isArray(data) && data.length > 0;
}

export function previewUrl(token: string): string {
  return `${siteBaseUrl()}/lp/onizleme/${token}`;
}

export function liveUrl(slug: string): string {
  return `${siteBaseUrl()}/lp/${slug}`;
}
