'use server';

import { randomUUID } from 'node:crypto';
import { createServerSupabase } from '@seker/auth/server';
import { getEditor } from '@seker/auth/editor';
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES, processImage } from '@/lib/media/process';
import { deleteImage, mediaKey, putImage } from '@/lib/media/s3';
import { countChars } from '@/lib/content/chars';

export type MediaAsset = { id: string; src: string; alt: string; width: number; height: number };

type UploadResult = { ok: true; asset: MediaAsset } | { ok: false; error: string };

export async function uploadImage(form: FormData): Promise<UploadResult> {
  try {
    return await doUpload(form);
  } catch (err) {
    console.error('[media] beklenmeyen hata', (err as { code?: string } | null)?.code ?? 'unknown');
    return { ok: false, error: 'Fotoğraf yüklenemedi, tekrar deneyin.' };
  }
}

async function doUpload(form: FormData): Promise<UploadResult> {
  const editor = await getEditor();
  if (!editor) return { ok: false, error: 'Oturumunuz sona erdi. Panelden tekrar giriş yapın.' };

  const mediaBase = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
  if (!mediaBase || !process.env.S3_BUCKET)
    return { ok: false, error: 'Fotoğraf yükleme henüz yapılandırılmamış. Site yöneticisine haber verin.' };

  const file = form.get('file');
  const alt = String(form.get('alt') ?? '').trim();
  const faces = String(form.get('faces') ?? '');
  if (!(file instanceof File)) return { ok: false, error: 'Bir fotoğraf seçin.' };
  if (faces !== 'yok' && faces !== 'bulanik_veya_izinli') return { ok: false, error: 'Fotoğrafta çocuk yüzü olup olmadığını işaretleyin.' };
  if (!alt) return { ok: false, error: 'Fotoğraf için kısa bir açıklama yazın.' };
  if (countChars(alt) > 200) return { ok: false, error: 'Açıklama en fazla 200 karakter olabilir.' };
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type))
    return { ok: false, error: 'Bu dosya türü desteklenmiyor. JPEG, PNG veya WebP yükleyin (iPhone: Ayarlar › Kamera › Biçimler › En Uyumlu).' };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: 'Fotoğraf 10 MB’tan büyük. Daha küçük bir kopyasını yükleyin.' };

  let processed: Awaited<ReturnType<typeof processImage>>;
  try {
    processed = await processImage(Buffer.from(await file.arrayBuffer()));
  } catch (err) {
    if ((err as Error).message === 'unsupported-format') return { ok: false, error: 'Bu dosya türü desteklenmiyor. JPEG, PNG veya WebP yükleyin.' };
    return { ok: false, error: 'Fotoğraf açılamadı. Başka bir dosya deneyin.' };
  }

  const id = randomUUID();
  const key = mediaKey(new Date(), id);
  try {
    await putImage(key, processed.data);
  } catch (err) {
    console.error('[media] S3 yükleme hatası', err);
    return { ok: false, error: 'Fotoğraf yüklenemedi, tekrar deneyin.' };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('media_assets')
    .insert({ id, s3_key: key, width: processed.width, height: processed.height, alt, faces, uploaded_by: editor.id })
    .select('id, s3_key, width, height, alt')
    .single();
  if (error || !data) {
    console.error('[media] kayıt hatası', error?.code ?? 'unknown');
    try {
      await deleteImage(key);
    } catch {
      console.error('[media] S3 temizliği başarısız');
    }
    return { ok: false, error: 'Fotoğraf kaydedilemedi, tekrar deneyin.' };
  }

  return {
    ok: true,
    asset: {
      id: data.id,
      src: `${mediaBase}/${data.s3_key}`,
      alt: data.alt,
      width: data.width,
      height: data.height,
    },
  };
}
