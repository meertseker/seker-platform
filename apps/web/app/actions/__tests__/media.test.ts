import { describe, it, expect, vi, beforeEach } from 'vitest';
import sharp from 'sharp';

const putImage = vi.fn();
vi.mock('@/lib/media/s3', async (orig) => ({ ...(await orig<object>()), putImage: (...a: unknown[]) => putImage(...a) }));
const getEditor = vi.fn();
const insert = vi.fn();
vi.mock('@seker/auth/editor', () => ({ getEditor: () => getEditor() }));
vi.mock('@seker/auth/server', () => ({
  createServerSupabase: async () => ({ from: () => ({ insert: (row: unknown) => ({ select: () => ({ single: () => insert(row) }) }) }) }),
}));

import { uploadImage } from '../media';

const png = async () =>
  new File([await sharp({ create: { width: 10, height: 10, channels: 3, background: '#000' } }).png().toBuffer()], 'a.png', { type: 'image/png' });

function form(file: File, alt = 'Bahçede oyun', faces = 'yok') {
  const f = new FormData();
  f.set('file', file);
  f.set('alt', alt);
  f.set('faces', faces);
  return f;
}

beforeEach(() => {
  putImage.mockReset();
  insert.mockReset();
  getEditor.mockReset();
  process.env.NEXT_PUBLIC_MEDIA_BASE_URL = 'https://b.s3.eu-central-1.amazonaws.com';
});

describe('uploadImage', () => {
  it('oturum yoksa yüklemez', async () => {
    getEditor.mockResolvedValue(null);
    expect((await uploadImage(form(await png()))).ok).toBe(false);
    expect(putImage).not.toHaveBeenCalled();
  });
  it('KVKK beyanı olmadan yüklemez', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    const r = await uploadImage(form(await png(), 'x', ''));
    expect(r).toEqual({ ok: false, error: 'Fotoğrafta çocuk yüzü olup olmadığını işaretleyin.' });
  });
  it('açıklama zorunlu', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    expect(await uploadImage(form(await png(), '  '))).toEqual({ ok: false, error: 'Fotoğraf için kısa bir açıklama yazın.' });
  });
  it("HEIC'i anlaşılır mesajla reddeder", async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    const heic = new File([new Uint8Array(10)], 'IMG_1.HEIC', { type: 'image/heic' });
    const r = await uploadImage(form(heic));
    expect(r.ok).toBe(false);
    expect((r as { error: string }).error).toMatch(/JPEG/);
  });
  it('10 MB üstünü reddeder', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'b.jpg', { type: 'image/jpeg' });
    expect((await uploadImage(form(big))).ok).toBe(false);
  });
  it("S3'e koyar ve media_assets yazar", async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    insert.mockImplementation(async (row: { s3_key: string }) => ({ data: { id: '11111111-1111-4111-8111-111111111111', ...row }, error: null }));
    const r = await uploadImage(form(await png()));
    expect(putImage).toHaveBeenCalledOnce();
    expect(putImage.mock.calls[0][0]).toMatch(/^site-images\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.webp$/);
    expect(r).toMatchObject({ ok: true, asset: { alt: 'Bahçede oyun', width: 10, height: 10 } });
    expect((r as { asset: { src: string } }).asset.src.startsWith('https://b.s3.eu-central-1.amazonaws.com/site-images/')).toBe(true);
  });
});
