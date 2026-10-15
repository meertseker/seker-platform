'use server';

import { updateTag } from 'next/cache';
import { z } from 'zod';
import { createServerSupabase } from '@seker/auth/server';
import { getEditor } from '@seker/auth/editor';
import { sanitizeRich, richToText } from '@/lib/content/sanitize';
import { countChars } from '@/lib/content/chars';

export type AnnouncementInput = {
  title: string; body: string; imageId: string | null; startsOn: string; endsOn: string | null; published: boolean;
};
type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const SESSION = 'Oturumunuz sona erdi. Panelden tekrar giriş yapın.';
const SAVE_ERROR = 'Duyuru kaydedilemedi, tekrar deneyin.';
const BAD_DATE = 'Tarih geçerli değil.';
const NOT_FOUND = 'Duyuru bulunamadı. Sayfayı yenileyin.';
const NO_IMAGE = 'Seçilen fotoğraf bulunamadı. Yeniden yükleyin.';

const isRealDate = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, BAD_DATE).refine(isRealDate, BAD_DATE);
const schema = z.object({
  title: z.string().trim().min(1, 'Başlık boş olamaz.').refine((s) => countChars(s) <= 120, 'Başlık en fazla 120 karakter olabilir.'),
  body: z.string(),
  imageId: z.string().uuid('Fotoğraf geçerli değil.').nullable(),
  startsOn: date,
  endsOn: date.nullable(),
  published: z.boolean(),
});
const idSchema = z.string().uuid();

/** Günlük için yalnızca hata kodu; mesaj ve içerik loglanmaz. */
function errorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) return String((err as { code: unknown }).code);
  return err instanceof Error ? err.name : 'bilinmeyen';
}

type Row = {
  title: string; body: string; image_id: string | null; starts_on: string; ends_on: string | null; published: boolean;
};

function clean(input: AnnouncementInput): R<{ row: Row }> {
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'Bilgiler eksik.' };
  if (p.data.endsOn && p.data.endsOn < p.data.startsOn) return { ok: false, error: 'Bitiş tarihi başlangıçtan önce olamaz.' };
  const body = sanitizeRich(p.data.body);
  const n = countChars(richToText(body));
  if (!n) return { ok: false, error: 'Duyuru metni boş olamaz.' };
  if (n > 5000) return { ok: false, error: 'Duyuru metni en fazla 5000 karakter olabilir.' };
  return {
    ok: true,
    row: { title: p.data.title, body, image_id: p.data.imageId, starts_on: p.data.startsOn, ends_on: p.data.endsOn, published: p.data.published },
  };
}

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

async function imageExists(supabase: Supabase, imageId: string | null): Promise<boolean> {
  if (!imageId) return true;
  const { data, error } = await supabase.from('media_assets').select('id').eq('id', imageId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function guarded<T extends object>(fn: () => Promise<R<T>>): Promise<R<T>> {
  try {
    return await fn();
  } catch (err) {
    console.error('[announcements] beklenmeyen hata', errorCode(err));
    return { ok: false, error: SAVE_ERROR };
  }
}

export async function createAnnouncement(input: AnnouncementInput): Promise<R<{ id: string }>> {
  return guarded(async () => {
    const editor = await getEditor();
    if (!editor) return { ok: false, error: SESSION };
    const c = clean(input);
    if (!c.ok) return c;
    const supabase = await createServerSupabase();
    if (!(await imageExists(supabase, c.row.image_id))) return { ok: false, error: NO_IMAGE };
    const { data: top, error: topErr } = await supabase.from('announcements').select('sort').order('sort').limit(1).maybeSingle();
    if (topErr) throw topErr;
    const { data, error } = await supabase
      .from('announcements')
      .insert({ ...c.row, sort: (top?.sort ?? 0) - 1, updated_by: editor.id })
      .select('id')
      .single();
    if (error || !data) {
      console.error('[announcements] ekleme hatası', error?.code ?? 'unknown');
      return { ok: false, error: SAVE_ERROR };
    }
    updateTag('site-content');
    return { ok: true, id: data.id };
  });
}

export async function updateAnnouncement(id: string, input: AnnouncementInput): Promise<R> {
  return guarded(async () => {
    const editor = await getEditor();
    if (!editor) return { ok: false, error: SESSION };
    if (!idSchema.safeParse(id).success) return { ok: false, error: SAVE_ERROR };
    const c = clean(input);
    if (!c.ok) return c;
    const supabase = await createServerSupabase();
    if (!(await imageExists(supabase, c.row.image_id))) return { ok: false, error: NO_IMAGE };
    const { data, error } = await supabase
      .from('announcements')
      .update({ ...c.row, updated_by: editor.id, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id');
    if (error) {
      console.error('[announcements] güncelleme hatası', error.code);
      return { ok: false, error: SAVE_ERROR };
    }
    if (!data?.length) return { ok: false, error: NOT_FOUND };
    updateTag('site-content');
    return { ok: true };
  });
}

export async function deleteAnnouncement(id: string): Promise<R> {
  return guarded(async () => {
    if (!(await getEditor())) return { ok: false, error: SESSION };
    if (!idSchema.safeParse(id).success) return { ok: false, error: 'Duyuru silinemedi.' };
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.from('announcements').delete().eq('id', id).select('id');
    if (error) {
      console.error('[announcements] silme hatası', error.code);
      return { ok: false, error: 'Duyuru silinemedi.' };
    }
    if (!data?.length) return { ok: false, error: NOT_FOUND };
    updateTag('site-content');
    return { ok: true };
  });
}

export async function moveAnnouncement(id: string, direction: -1 | 1): Promise<R> {
  return guarded(async () => {
    if (!(await getEditor())) return { ok: false, error: SESSION };
    if (!idSchema.safeParse(id).success || (direction !== -1 && direction !== 1)) return { ok: false, error: 'Duyuru taşınamadı.' };
    const supabase = await createServerSupabase();
    // Sıralama veritabanında tek işlemde yapılır (eşit sort değerleri (sort, id) ile belirlenir).
    const { data, error } = await supabase.rpc('reorder_announcements', { p_id: id, p_dir: direction });
    if (error) {
      console.error('[announcements] sıralama hatası', error.code);
      return { ok: false, error: 'Duyuru taşınamadı.' };
    }
    if (!data) return { ok: false, error: NOT_FOUND };
    updateTag('site-content');
    return { ok: true };
  });
}
