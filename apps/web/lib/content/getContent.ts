import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { draftMode } from 'next/headers';
import { createPublicSupabase } from '@/lib/supabase/public';
import { SLOTS } from './registry';
import type { ContentMap } from './types';

export async function getContent(): Promise<ContentMap> {
  'use cache';
  cacheTag('site-content');
  try {
    const { data, error } = await createPublicSupabase().from('site_content').select('key, value, updated_at');
    if (error || !data) throw new Error(error?.message ?? 'veri yok');
    cacheLife('max');
    return Object.fromEntries(data.map((r) => [r.key, { value: r.value, updatedAt: r.updated_at }]));
  } catch (err) {
    console.error('[content] Supabase okunamadı, koddaki metinler gösteriliyor:', err);
    cacheLife('minutes');
    return {};
  }
}

export function read<T>(map: ContentMap, key: string): T {
  if (key in map) return map[key].value as T;
  const def = SLOTS[key];
  if (!def) throw new Error(`İçerik anahtarı tanımsız: ${key}`);
  return def.default as T;
}

/** Ziyaretçide false önbelleklenir; draft mode'da her istekte yeniden çalışır (Next 16 davranışı). */
export async function isEditing(): Promise<boolean> {
  'use cache';
  cacheLife('max');
  return (await draftMode()).isEnabled;
}

export type PublicAnnouncement = {
  id: string; title: string; body: string; imageSrc: string | null; imageAlt: string | null; startsOn: string; endsOn: string | null;
};

/**
 * Yayındaki ve tarihi geçerli duyurular (view süzer). Görsel embed ile gelir:
 * apps/panel/tests/rls/site-content.test.ts (F10) anon için gömmenin çalıştığını doğrular.
 */
export async function getAnnouncements(): Promise<PublicAnnouncement[]> {
  'use cache';
  cacheTag('site-content');
  try {
    const { data, error } = await createPublicSupabase()
      .from('active_announcements')
      .select('id, title, body, starts_on, ends_on, sort, media_assets(s3_key, alt)')
      .order('sort');
    if (error || !data) throw new Error(error?.message ?? 'veri yok');
    cacheLife('hours');
    return data.map((r) => {
      const m = r.media_assets as { s3_key: string; alt: string } | null;
      return {
        id: r.id!, title: r.title!, body: r.body!, startsOn: r.starts_on!, endsOn: r.ends_on,
        imageSrc: m ? `${process.env.NEXT_PUBLIC_MEDIA_BASE_URL}/${m.s3_key}` : null, imageAlt: m?.alt ?? null,
      };
    });
  } catch (err) {
    console.error('[content] duyurular okunamadı', err);
    cacheLife('minutes');
    return [];
  }
}
