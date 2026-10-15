'use server';

import { updateTag } from 'next/cache';
import { createServerSupabase } from '@seker/auth/server';
import { getEditor } from '@seker/auth/editor';
import type { Json } from '@seker/db';
import { validateEdits } from '@/lib/content/validate';
import { SLOTS } from '@/lib/content/registry';
import { richToText } from '@/lib/content/sanitize';

export type ContentEdit = { key: string; value: unknown; baseUpdatedAt: string | null };
export type SaveResult = { ok: true; savedAt: string } | { ok: false; error: string; conflicts?: string[] };
export type RevisionRow = {
  id: string; key: string; label: string; createdAt: string; editorName: string; before: string; after: string;
};

const SESSION_ERROR = 'Oturumunuz sona erdi. Panelden tekrar giriş yapın; değişiklikleriniz bu tarayıcıda saklandı.';
const CONFLICT_ERROR = 'Bu metin siz düzenlerken başka bir yerden değişti. Sayfayı yenileyip tekrar deneyin.';

export async function saveContent(edits: ContentEdit[]): Promise<SaveResult> {
  if (!(await getEditor())) return { ok: false, error: SESSION_ERROR };
  const v = validateEdits(edits);
  if (!v.ok) return { ok: false, error: v.error };
  if (v.edits.length === 0) return { ok: false, error: 'Kaydedilecek değişiklik yok.' };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('save_site_content', { p_edits: v.edits as unknown as Json });
  if (error) {
    console.error('[content] kayıt hatası', error);
    return { ok: false, error: error.code === '42501' ? SESSION_ERROR : 'Kaydedilemedi, tekrar deneyin.' };
  }
  const result = data as { conflicts: string[]; saved_at: string | null };
  if (result.conflicts.length) return { ok: false, error: CONFLICT_ERROR, conflicts: result.conflicts };
  updateTag('site-content');
  return { ok: true, savedAt: result.saved_at! };
}

export async function revertRevision(revisionId: string): Promise<SaveResult> {
  if (!(await getEditor())) return { ok: false, error: SESSION_ERROR };
  const supabase = await createServerSupabase();
  const { data: rev } = await supabase.from('content_revisions').select('key, old_value').eq('id', revisionId).single();
  if (!rev) return { ok: false, error: 'Bu değişiklik bulunamadı.' };
  const { data: cur } = await supabase.from('site_content').select('updated_at').eq('key', rev.key).maybeSingle();
  return saveContent([{ key: rev.key, value: rev.old_value, baseUpdatedAt: cur?.updated_at ?? null }]);
}

function preview(v: unknown): string {
  if (v === null || v === undefined) return '(sitenin ilk hâli)';
  if (typeof v === 'string') return richToText(v).slice(0, 140);
  if (Array.isArray(v)) return `${v.length} madde`;
  if (typeof v === 'object' && 'alt' in (v as object)) return `Fotoğraf: ${(v as { alt: string }).alt}`;
  return '';
}

export async function listRevisions(limit = 50): Promise<RevisionRow[]> {
  if (!(await getEditor())) return [];
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('content_revisions')
    .select('id, key, old_value, new_value, created_at, profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 200));
  return (data ?? []).map((r) => ({
    id: r.id,
    key: r.key,
    label: SLOTS[r.key]?.label ?? r.key,
    createdAt: r.created_at,
    editorName: (r.profiles as { full_name: string } | null)?.full_name ?? '—',
    before: preview(r.old_value),
    after: preview(r.new_value),
  }));
}
