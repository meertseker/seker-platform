"use server";

// Reklam sayfası eylemleri: önizleme, yayın, yayındaki alanları düzenleme, arşiv.
// Hepsi önce requireRole ile rolü doğrular, sonra gizli anahtarlı istemciyle çalışır (landing_pages
// RLS'te yalnız okunur). İçerik satırına, aşamaya ve ad_change_log'a yazılmaz (B3).
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminSupabase } from "@seker/auth/admin";
import {
  followSubheadInMeta,
  pageFieldsToLandingFields,
  parseLandingFields,
  slugError,
  suggestSlug,
  type LandingFields,
} from "@seker/shared/landing";
import { requireRole } from "@/lib/auth";
import { getContentRules } from "@/lib/content/settings";
import {
  ensureLandingDraft,
  getLandingPageByContent,
  isSlugTaken,
  liveUrl,
  previewUrl,
  siteBaseUrl,
  type LandingPageStatus,
} from "@/lib/pages/store";
import { pageFieldChecks, pagePublishBlockers, type FieldCheck } from "@/lib/pages/preflight";
import { revalidateWebPage } from "@/lib/pages/revalidate";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = "İçerik bulunamadı";
const NOT_PAGE = "Bu içerik sayfa değil";
const BOARD = "/reklam/icerik";
const SLUG_TAKEN = "Bu adres başka bir sayfada kullanılıyor";
const SLUG_LOCKED = "Yayından sonra adres değişmez";
const REVALIDATE_LATE = "Sayfa kaydedildi; site yenilemesi gecikti, birkaç dakika içinde açılır.";
// Düzenleme: web yayındaki sayfayı en çok bir saat önbellekte tutar (apps/web/lib/landing/db.ts, cacheLife('hours')).
const REVALIDATE_LATE_EDIT = "Değişiklik kaydedildi; site yenilemesi gecikti, en geç bir saat içinde görünür.";

const ITEM_COLUMNS = "id, code, kind, platform, status, stage, owner_id, page_fields, topic";

type ItemRow = {
  id: string;
  code: string;
  kind: string;
  platform: string;
  status: string;
  stage: string;
  owner_id: string;
  page_fields: unknown;
  topic: string;
};

export type PagePanelData = {
  code: string;
  topic: string;
  platform: "google" | "instagram";
  status: string;
  previewUrl: string;
  siteBase: string;
  slugSuggestion: string;
  page: { slug: string | null; status: LandingPageStatus; publishedAt: string | null } | null;
  fields: LandingFields;
  checks: FieldCheck[];
  canPublish: boolean;
};

function nowIso(): string {
  return new Date().toISOString();
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function errorCode(e: unknown): string | undefined {
  return (e as { code?: string } | null)?.code;
}

async function loadItem(contentId: string): Promise<{ admin: SupabaseClient; item: ItemRow | null }> {
  const admin = createAdminSupabase() as unknown as SupabaseClient;
  if (!UUID_RE.test(contentId ?? "")) return { admin, item: null };
  const { data, error } = await admin.from("content_items").select(ITEM_COLUMNS).eq("id", contentId).maybeSingle();
  if (error) throw new Error(`İçerik okunamadı: ${error.message}`);
  return { admin, item: (data as ItemRow | null) ?? null };
}

async function fieldRules(admin: SupabaseClient) {
  const rules = await getContentRules(admin);
  return { banned: rules.banned, pageTitleMax: rules.limits.pageTitle };
}

async function refreshSite(slug: string | null, late = REVALIDATE_LATE): Promise<string | null> {
  if (!slug) return null;
  const r = await revalidateWebPage(slug);
  return r.ok ? null : late;
}

/** Öğretmen kendi, yönetici her sayfa içeriğinin önizlemesini açar (gerekirse taslak satırı açılır). */
export async function openPagePreview(contentId: string): Promise<{ url: string } | { error: string }> {
  const profile = await requireRole("ogretmen", "yonetici");
  const { admin, item } = await loadItem(contentId);
  if (!item || (profile.role === "ogretmen" && item.owner_id !== profile.id)) return { error: NOT_FOUND };
  if (item.kind !== "sayfa") return { error: NOT_PAGE };
  const row = await ensureLandingDraft(admin, item.id);
  return { url: previewUrl(row.previewToken) };
}

/** Z3 yayın paneli verisi. */
export async function loadPagePanel(contentId: string): Promise<PagePanelData | { error: string }> {
  await requireRole("yonetici");
  const { admin, item } = await loadItem(contentId);
  if (!item) return { error: NOT_FOUND };
  if (item.kind !== "sayfa") return { error: NOT_PAGE };

  const row = await ensureLandingDraft(admin, item.id);
  const fields = row.publishedAt ? row.fields : pageFieldsToLandingFields(asObject(item.page_fields));

  let slugSuggestion = row.slug ?? "";
  if (!slugSuggestion) {
    const { data, error } = await admin
      .from("landing_pages")
      .select("slug")
      .not("slug", "is", null)
      .neq("content_id", item.id);
    if (error) throw new Error(`Sayfa okunamadı: ${error.message}`);
    const taken = new Set(((data ?? []) as { slug: string | null }[]).map((r) => r.slug).filter((s): s is string => !!s));
    slugSuggestion = suggestSlug(fields.h1, item.code, taken);
  }

  return {
    code: item.code,
    topic: item.topic,
    platform: item.platform === "instagram" ? "instagram" : "google",
    status: item.status,
    previewUrl: previewUrl(row.previewToken),
    siteBase: siteBaseUrl(),
    slugSuggestion,
    page: { slug: row.slug, status: row.status, publishedAt: row.publishedAt },
    fields,
    checks: pageFieldChecks(fields, await fieldRules(admin)),
    canPublish: item.status === "onaylandi",
  };
}

/** Onaylı sayfa içeriğini /lp/<slug> adresinde yayınlar; arşivdeki sayfayı aynı adresle yeniden yayınlar. */
export async function publishLandingPage(
  contentId: string,
  slug: string,
): Promise<{ ok: true; url: string; warning: string | null } | { error: string; blockers?: string[] }> {
  const profile = await requireRole("yonetici");
  const cleanSlug = typeof slug === "string" ? slug.trim() : "";
  const { admin, item } = await loadItem(contentId);
  if (!item) return { error: NOT_FOUND };

  const current = await getLandingPageByContent(item.id, admin);
  // İlk yayında öğretmenin alanları kopyalanır; sonraki yayınlarda düzenlenmiş alanlar korunur.
  const fields = current?.publishedAt ? current.fields : pageFieldsToLandingFields(asObject(item.page_fields));
  const slugTaken = slugError(cleanSlug) ? false : await isSlugTaken(admin, cleanSlug, item.id);
  const blockers = pagePublishBlockers({
    kind: item.kind,
    status: item.status,
    slug: cleanSlug,
    current,
    slugTaken,
    fieldChecks: pageFieldChecks(fields, await fieldRules(admin)),
  });
  if (blockers.length > 0) return { error: "Yayın için eksikleri tamamla", blockers };

  const row = current ?? (await ensureLandingDraft(admin, item.id));
  const { error } = await admin
    .from("landing_pages")
    .update({
      slug: cleanSlug,
      status: "yayinda",
      fields,
      published_at: nowIso(),
      published_by: profile.id,
      archived_at: null,
    })
    .eq("content_id", row.contentId);
  if (error) {
    if (errorCode(error) === "23505") return { error: SLUG_TAKEN };
    if (errorCode(error) === "23514") return { error: SLUG_LOCKED };
    return { error: "Sayfa yayınlanamadı" };
  }

  const warning = await refreshSite(cleanSlug);
  revalidatePath(BOARD);
  return { ok: true, url: liveUrl(cleanSlug), warning };
}

/** Yayınlanmış sayfanın alanlarını kaydeder (Z3 "Kaydet ve yeniden yayınla"). */
export async function updateLandingPageFields(
  contentId: string,
  fields: LandingFields,
): Promise<{ ok: true; warning: string | null } | { error: string; blockers?: string[] }> {
  await requireRole("yonetici");
  const { admin, item } = await loadItem(contentId);
  if (!item) return { error: NOT_FOUND };
  const current = await getLandingPageByContent(item.id, admin);
  // Taslak satırın alanları ilk yayında page_fields'ten yeniden kurulur; düzenleme yalnız yayından sonra.
  if (!current?.publishedAt) return { error: "Önce sayfayı yayınlayın" };

  // Arama açıklaması alt başlıktan türemişse yeni alt başlığı izler; elle yazılmışsa korunur.
  const clean = followSubheadInMeta(current.fields, parseLandingFields(fields));
  const bad = pageFieldChecks(clean, await fieldRules(admin)).filter((c) => !c.ok);
  if (bad.length > 0) return { error: "Kaydetmek için eksikleri tamamla", blockers: bad.map((c) => `${c.label}: ${c.message}`) };

  const { error } = await admin.from("landing_pages").update({ fields: clean }).eq("content_id", item.id);
  if (error) return { error: "Sayfa kaydedilemedi" };

  const warning = current.status === "yayinda" ? await refreshSite(current.slug, REVALIDATE_LATE_EDIT) : null;
  revalidatePath(BOARD);
  return { ok: true, warning };
}

/** Yayındaki sayfayı arşivler; adres reklam sayfalarına yönlenir. */
export async function archiveLandingPage(contentId: string): Promise<{ ok: true; warning: string | null } | { error: string }> {
  await requireRole("yonetici");
  const { admin, item } = await loadItem(contentId);
  if (!item) return { error: NOT_FOUND };
  const current = await getLandingPageByContent(item.id, admin);
  if (current?.status !== "yayinda") return { error: "Yalnız yayındaki sayfa arşivlenir" };

  const { error } = await admin
    .from("landing_pages")
    .update({ status: "arsiv", archived_at: nowIso() })
    .eq("content_id", item.id);
  if (error) return { error: "Sayfa arşivlenemedi" };

  const warning = await refreshSite(current.slug);
  revalidatePath(BOARD);
  return { ok: true, warning };
}
