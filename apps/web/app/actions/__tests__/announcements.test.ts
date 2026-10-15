import { describe, it, expect, vi, beforeEach } from 'vitest';

const { updateTag, getEditor, insert, minSort, imageLookup } = vi.hoisted(() => ({
  updateTag: vi.fn(), getEditor: vi.fn(), insert: vi.fn(), minSort: vi.fn(), imageLookup: vi.fn(),
}));
vi.mock('next/cache', () => ({ updateTag }));
vi.mock('@seker/auth/editor', () => ({ getEditor: () => getEditor() }));
vi.mock('@seker/auth/server', () => ({
  createServerSupabase: async () => ({
    from: (table: string) => ({
      select: () =>
        table === 'media_assets'
          ? { eq: () => ({ maybeSingle: imageLookup }) }
          : { order: () => ({ limit: () => ({ maybeSingle: minSort }) }) },
      insert: (row: unknown) => ({ select: () => ({ single: () => insert(row) }) }),
    }),
  }),
}));

import { createAnnouncement } from '../announcements';

const valid = { title: 'Kermes', body: '<p>Cumartesi <b>10:00</b></p><script>x</script>', imageId: null, startsOn: '2026-10-20', endsOn: '2026-10-25', published: true };

beforeEach(() => {
  updateTag.mockReset();
  insert.mockReset();
  getEditor.mockReset();
  imageLookup.mockReset();
  minSort.mockResolvedValue({ data: { sort: 0 }, error: null });
});

describe('createAnnouncement', () => {
  it('oturumsuz reddeder', async () => {
    getEditor.mockResolvedValue(null);
    expect((await createAnnouncement(valid)).ok).toBe(false);
  });
  it('bitiş başlangıçtan önceyse reddeder', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    expect(await createAnnouncement({ ...valid, endsOn: '2026-10-19' })).toEqual({ ok: false, error: 'Bitiş tarihi başlangıçtan önce olamaz.' });
  });
  it('gövdeyi temizler, en üste ekler, yayınlar', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    insert.mockResolvedValue({ data: { id: 'a1' }, error: null });
    const r = await createAnnouncement(valid);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ body: '<p>Cumartesi <b>10:00</b></p>', sort: -1, updated_by: 'u' }));
    expect(updateTag).toHaveBeenCalledWith('site-content');
    expect(r).toEqual({ ok: true, id: 'a1' });
  });
  it('olmayan fotoğraf kimliğini reddeder, yazmaz', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    imageLookup.mockResolvedValue({ data: null, error: null });
    const r = await createAnnouncement({ ...valid, imageId: '11111111-1111-4111-8111-111111111111' });
    expect(r.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });
  it('veritabanı hatasında fırlatmaz, etiketi tazelemez', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    insert.mockResolvedValue({ data: null, error: { code: '42501' } });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await createAnnouncement(valid);
    expect(r).toEqual({ ok: false, error: 'Duyuru kaydedilemedi, tekrar deneyin.' });
    expect(spy).toHaveBeenCalledWith('[announcements] ekleme hatası', '42501');
    expect(updateTag).not.toHaveBeenCalled();
    spy.mockRestore();
  });
  it('beklenmeyen istisnada fırlatmaz', async () => {
    getEditor.mockRejectedValue(new Error('boom'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await createAnnouncement(valid)).ok).toBe(false);
    spy.mockRestore();
  });
  it('boş gövdeyi ve 120 grafemden uzun başlığı reddeder', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    expect((await createAnnouncement({ ...valid, body: '<p> </p><script>x</script>' })).ok).toBe(false);
    expect((await createAnnouncement({ ...valid, title: 'a'.repeat(121) })).ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });
});
