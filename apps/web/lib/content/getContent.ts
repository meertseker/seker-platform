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
