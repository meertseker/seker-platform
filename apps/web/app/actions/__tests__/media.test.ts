import { describe, it, expect, vi, beforeEach } from 'vitest';
import sharp from 'sharp';

const putImage = vi.fn();
const deleteImage = vi.fn();
vi.mock('@/lib/media/s3', async (orig) => ({
  ...(await orig<object>()),
  putImage: (...a: unknown[]) => putImage(...a),
  deleteImage: (...a: unknown[]) => deleteImage(...a),
}));
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
  deleteImage.mockReset();
  deleteImage.mockResolvedValue(undefined);
  process.env.S3_BUCKET = 'test-bucket';
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
    expect(await uploadImage(form(big))).toEqual({ ok: false, error: 'Fotoğraf 10 MB’tan büyük. Daha küçük bir kopyasını yükleyin.' });
  });
  it("S3'e koyar ve media_assets yazar", async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    insert.mockImplementation(async (row: { s3_key: string }) => ({ data: { id: '11111111-1111-4111-8111-111111111111', ...row }, error: null }));
    const r = await uploadImage(form(await png()));
    expect(putImage).toHaveBeenCalledOnce();
    expect(putImage.mock.calls[0][0]).toMatch(/^site-images\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.webp$/);
    expect(r).toMatchObject({ ok: true, asset: { alt: 'Bahçede oyun', width: 10, height: 10 } });
    const key = putImage.mock.calls[0][0] as string;
    expect((r as { asset: { src: string; id: string } }).asset.src).toBe(`https://b.s3.eu-central-1.amazonaws.com/${key}`);
    expect((r as { asset: { id: string } }).asset.id).toBe(key.split('/').pop()!.replace('.webp', ''));
  });
  it('201 karakterlik açıklamayı reddeder, 200 grafemi kabul eder', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    expect(await uploadImage(form(await png(), 'a'.repeat(201)))).toEqual({ ok: false, error: 'Açıklama en fazla 200 karakter olabilir.' });
    insert.mockImplementation(async (row: object) => ({ data: { id: 'i', width: 10, height: 10, alt: 'x', ...row }, error: null }));
    expect((await uploadImage(form(await png(), '👨‍👩‍👧'.repeat(200)))).ok).toBe(true);
  });
  it('geçersiz faces değerini reddeder', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    const r = await uploadImage(form(await png(), 'x', 'belki'));
    expect(r).toEqual({ ok: false, error: 'Fotoğrafta çocuk yüzü olup olmadığını işaretleyin.' });
    expect(putImage).not.toHaveBeenCalled();
  });
  it('GIF içeriği image/png olarak gelirse reddeder', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    const gif = new File([await sharp({ create: { width: 5, height: 5, channels: 3, background: '#000' } }).gif().toBuffer()], 'a.png', { type: 'image/png' });
    const r = await uploadImage(form(gif));
    expect(r.ok).toBe(false);
    expect((r as { error: string }).error).toMatch(/JPEG/);
    expect(putImage).not.toHaveBeenCalled();
  });
  it('TIFF içeriği image/png olarak gelirse reddeder', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    const tiff = new File([await sharp({ create: { width: 5, height: 5, channels: 3, background: '#000' } }).tiff().toBuffer()], 'a.png', { type: 'image/png' });
    expect((await uploadImage(form(tiff))).ok).toBe(false);
    expect(putImage).not.toHaveBeenCalled();
  });
  it('metin dosyası image/jpeg olarak gelirse reddeder', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    const txt = new File(['merhaba dünya'], 'a.jpg', { type: 'image/jpeg' });
    expect((await uploadImage(form(txt))).ok).toBe(false);
    expect(putImage).not.toHaveBeenCalled();
  });
  it('veritabanı hatasında S3 nesnesini siler', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    insert.mockResolvedValue({ data: null, error: { code: '42501', message: 'secret' } });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await uploadImage(form(await png()));
    expect(r).toEqual({ ok: false, error: 'Fotoğraf kaydedilemedi, tekrar deneyin.' });
    expect(deleteImage).toHaveBeenCalledWith(putImage.mock.calls[0][0]);
    expect(JSON.stringify(spy.mock.calls)).not.toContain('secret');
    spy.mockRestore();
  });
  it('S3 silme de başarısız olsa hata fırlatmaz', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    insert.mockResolvedValue({ data: null, error: { code: 'x' } });
    deleteImage.mockRejectedValue(new Error('no'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await uploadImage(form(await png()))).ok).toBe(false);
    spy.mockRestore();
  });
  it('getEditor fırlatırsa ok:false döner', async () => {
    getEditor.mockRejectedValue(new Error('db down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await uploadImage(form(await png()));
    expect(r).toEqual({ ok: false, error: 'Fotoğraf yüklenemedi, tekrar deneyin.' });
    spy.mockRestore();
  });
  it('medya adresi tanımsızsa hiçbir şey yapmadan yapılandırma hatası verir', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    delete process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
    const r = await uploadImage(form(await png()));
    expect(r).toEqual({ ok: false, error: 'Fotoğraf yükleme henüz yapılandırılmamış. Site yöneticisine haber verin.' });
    expect(putImage).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });
  it('S3_BUCKET tanımsızsa yapılandırma hatası verir', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    delete process.env.S3_BUCKET;
    expect((await uploadImage(form(await png()))).ok).toBe(false);
    expect(putImage).not.toHaveBeenCalled();
  });
});
