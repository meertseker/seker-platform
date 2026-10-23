import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { connection } from 'next/server';
import { createAdminSupabase } from '@seker/auth/admin';
import {
  LP_SLUG_RE,
  PREVIEW_TOKEN_RE,
  pageFieldsToLandingFields,
  parseLandingFields,
  type LandingFields,
} from '@seker/shared/landing';

export type DbLandingPage = { slug: string; status: 'yayinda'; fields: LandingFields };

/**
 * Yayındaki veritabanı reklam sayfası. `landing_pages` anon'a kapalı (RLS), bu yüzden service_role ile okunur;
 * yalnız `status='yayinda'` süzülür. Panel yayınlayınca/arşivleyince `/api/revalidate` `lp:<slug>` etiketini düşürür.
 *
 * Next 16.2 belgeleri (node_modules/next/dist/docs/01-app/03-api-reference):
 * - 01-directives/use-cache.md, 04-functions/cacheTag.md
 * - 04-functions/cacheLife.md § "Conditional cache lifetimes": dallarda farklı cacheLife; çağrı başına tek çağrı.
 * - 04-functions/cacheLife.md § "Preset cache profiles": `hours` = stale 5 dk, revalidate 1 saat, expire 1 gün.
 *   https://nextjs.org/docs/app/api-reference/functions/cacheLife#conditional-cache-lifetimes
 */
export async function getPublishedLandingPage(slug: string): Promise<DbLandingPage | null> {
  'use cache';
  cacheTag(`lp:${slug}`);
  if (!LP_SLUG_RE.test(slug)) {
    cacheLife('minutes');
    return null;
  }
  try {
    const { data, error } = await createAdminSupabase()
      .from('landing_pages')
      .select('slug, status, fields')
      .eq('slug', slug)
      .eq('status', 'yayinda')
      .maybeSingle();
    if (error) {
      console.error('[lp] yayındaki sayfa okunamadı', error.code);
      cacheLife('minutes');
      return null;
    }
    if (!data) {
      cacheLife('minutes');
      return null;
    }
    // 'hours' (stale 5 dk, revalidate 1 saat, expire 1 gün; cacheLife.md "Preset cache profiles"):
    // panelin /api/revalidate çağrısı kaçarsa düzenleme en geç bir saat içinde görünür.
    cacheLife('hours');
    return { slug, status: 'yayinda', fields: parseLandingFields(data.fields) };
  } catch (err) {
    console.error('[lp] yayındaki sayfa okunamadı', (err as { code?: string })?.code ?? 'istisna');
    cacheLife('minutes');
    return null;
  }
}

/**
 * Gizli önizleme: önbelleksiz, her istekte okunur (taslak düzenlendikçe değişir).
 * `connection()`: 04-functions/connection.md — prerender burada durur, sorgu istek anında çalışır.
 * Taslakta alanlar henüz `landing_pages.fields`'e yazılmadığı için içerik kartının `page_fields`'inden üretilir.
 */
export async function getPreviewLandingPage(token: string): Promise<{ status: string; fields: LandingFields } | null> {
  await connection();
  if (!PREVIEW_TOKEN_RE.test(token)) return null;
  try {
    const { data, error } = await createAdminSupabase()
      .from('landing_pages')
      .select('status, fields, content_items(page_fields)')
      .eq('preview_token', token)
      .maybeSingle();
    if (error) {
      console.error('[lp] önizleme okunamadı', error.code);
      return null;
    }
    if (!data) return null;
    if (data.status === 'taslak') {
      const item = data.content_items as { page_fields: unknown } | null;
      const pf = item?.page_fields;
      const record = pf && typeof pf === 'object' && !Array.isArray(pf) ? (pf as Record<string, unknown>) : {};
      return { status: data.status, fields: pageFieldsToLandingFields(record) };
    }
    return { status: data.status, fields: parseLandingFields(data.fields) };
  } catch (err) {
    console.error('[lp] önizleme okunamadı', (err as { code?: string })?.code ?? 'istisna');
    return null;
  }
}
