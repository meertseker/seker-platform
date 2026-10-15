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
const SAVE_ERROR = 'Kaydedilemedi, tekrar deneyin.';

/** Günlük için yalnızca hata kodu; mesaj ve içerik loglanmaz. */
function errorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) return String((err as { code: unknown }).code);
  return err instanceof Error ? err.name : 'bilinmeyen';
}

export async function saveContent(edits: ContentEdit[]): Promise<SaveResult> {
  try {
    if (!(await getEditor())) return { ok: false, error: SESSION_ERROR };
    const v = validateEdits(edits);
    if (!v.ok) return { ok: false, error: v.error };
    if (v.edits.length === 0) return { ok: false, error: 'Kaydedilecek değişiklik yok.' };
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc('save_site_content', { p_edits: v.edits as unknown as Json });
    if (error) {
      console.error('[content] kayıt hatası', error.code);
      return { ok: false, error: error.code === '42501' ? SESSION_ERROR : SAVE_ERROR };
    }
    const result = data as { conflicts?: unknown; saved_at?: unknown } | null;
    if (!result || !Array.isArray(result.conflicts)) {
      console.error('[content] RPC yanıtı beklenen biçimde değil');
      return { ok: false, error: SAVE_ERROR };
    }
    if (result.conflicts.length) {
      return { ok: false, error: CONFLICT_ERROR, conflicts: result.conflicts.map(String) };
    }
    if (typeof result.saved_at !== 'string') {
      console.error('[content] RPC yanıtında saved_at yok');
      return { ok: false, error: SAVE_ERROR };
    }
    updateTag('site-content');
    return { ok: true, savedAt: result.saved_at };
  } catch (err) {
    console.error('[content] kayıt beklenmeyen hata', errorCode(err));
    return { ok: false, error: SAVE_ERROR };
  }
}

export async function revertRevision(revisionId: string): Promise<SaveResult> {
  try {
    if (!(await getEditor())) return { ok: false, error: SESSION_ERROR };
    const supabase = await createServerSupabase();
    const { data: rev } = await supabase.from('content_revisions').select('key, old_value').eq('id', revisionId).single();
    if (!rev) return { ok: false, error: 'Bu değişiklik bulunamadı.' };
    const { data: cur } = await supabase.from('site_content').select('updated_at').eq('key', rev.key).maybeSingle();
    return saveContent([{ key: rev.key, value: rev.old_value, baseUpdatedAt: cur?.updated_at ?? null }]);
  } catch (err) {
    console.error('[content] geri alma beklenmeyen hata', errorCode(err));
    return { ok: false, error: SAVE_ERROR };
  }
}

function preview(v: unknown): string {
  if (v === null || v === undefined) return '(sitenin ilk hâli)';
  if (typeof v === 'string') return richToText(v).slice(0, 140);
  if (Array.isArray(v)) return `${v.length} madde`;
  if (typeof v === 'object' && 'alt' in (v as object)) return `Fotoğraf: ${(v as { alt: string }).alt}`;
  return '';
}

export async function listRevisions(limit = 50): Promise<RevisionRow[]> {
  try {
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
  } catch (err) {
    console.error('[content] revizyon listesi okunamadı', errorCode(err));
    return [];
  }
}
