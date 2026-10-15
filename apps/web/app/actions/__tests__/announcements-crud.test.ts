import { describe, it, expect, vi, beforeEach } from 'vitest';

const { updateTag, getEditor, db } = vi.hoisted(() => ({
  updateTag: vi.fn(), getEditor: vi.fn(),
  db: { rpc: vi.fn(), result: vi.fn(), calls: [] as string[] },
}));
vi.mock('next/cache', () => ({ updateTag }));
vi.mock('@seker/auth/editor', () => ({ getEditor: () => getEditor() }));
vi.mock('@seker/auth/server', () => ({
  createServerSupabase: async () => {
    db.calls.push('client');
    // Zincir sonunda db.result() döner; select/update/delete/eq/order/limit zincirlenebilir.
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'update', 'delete', 'eq', 'order', 'limit']) chain[m] = () => chain;
    chain.maybeSingle = () => db.result();
    chain.then = (res: (v: unknown) => unknown) => res(db.result());
    return {
      from: (t: string) => (db.calls.push('from:' + t), chain),
      rpc: (...a: unknown[]) => (db.calls.push('rpc'), db.rpc(...a)),
    };
  },
}));

import { updateAnnouncement, deleteAnnouncement, moveAnnouncement } from '../announcements';

const ID = '11111111-1111-4111-8111-111111111111';
const SESSION = 'Oturumunuz sona erdi. Panelden tekrar giriş yapın.';
const valid = { title: 'Kermes', body: '<p>Cumartesi</p>', imageId: null, startsOn: '2026-10-20', endsOn: null, published: true };

beforeEach(() => {
  updateTag.mockReset(); getEditor.mockReset(); db.rpc.mockReset(); db.result.mockReset(); db.calls.length = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('updateAnnouncement', () => {
  it('oturumsuz: oturum hatası, DB çağrısı yok', async () => {
    getEditor.mockResolvedValue(null);
    expect(await updateAnnouncement(ID, valid)).toEqual({ ok: false, error: SESSION });
    expect(db.calls).toEqual([]);
  });
  it('doğrulama hatası: DB çağrısı yok', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    expect(await updateAnnouncement(ID, { ...valid, endsOn: '2026-10-01' })).toEqual({ ok: false, error: 'Bitiş tarihi başlangıçtan önce olamaz.' });
    expect((await updateAnnouncement('x', valid)).ok).toBe(false);
    expect(db.calls).toEqual([]);
    expect(updateTag).not.toHaveBeenCalled();
  });
  it('bulunamadı: 0 satır', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    db.result.mockResolvedValue({ data: [], error: null });
    expect(await updateAnnouncement(ID, valid)).toEqual({ ok: false, error: 'Duyuru bulunamadı. Sayfayı yenileyin.' });
    expect(updateTag).not.toHaveBeenCalled();
  });
  it('DB hatası: Türkçe hata, etiket yok', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    db.result.mockResolvedValue({ data: null, error: { code: '42501' } });
    expect(await updateAnnouncement(ID, valid)).toEqual({ ok: false, error: 'Duyuru kaydedilemedi, tekrar deneyin.' });
    expect(updateTag).not.toHaveBeenCalled();
  });
  it('başarı: etiket tazelenir', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    db.result.mockResolvedValue({ data: [{ id: ID }], error: null });
    expect(await updateAnnouncement(ID, valid)).toEqual({ ok: true });
    expect(updateTag).toHaveBeenCalledWith('site-content');
  });
});

describe('deleteAnnouncement', () => {
  it('oturumsuz', async () => {
    getEditor.mockResolvedValue(null);
    expect(await deleteAnnouncement(ID)).toEqual({ ok: false, error: SESSION });
    expect(db.calls).toEqual([]);
  });
  it('geçersiz kimlik', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    expect((await deleteAnnouncement('x')).ok).toBe(false);
    expect(db.calls).toEqual([]);
  });
  it('DB hatası', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    db.result.mockResolvedValue({ data: null, error: { code: 'X' } });
    expect(await deleteAnnouncement(ID)).toEqual({ ok: false, error: 'Duyuru silinemedi.' });
    expect(updateTag).not.toHaveBeenCalled();
  });
  it('0 satır silindi: bulunamadı, etiket yok', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    db.result.mockResolvedValue({ data: [], error: null });
    expect(await deleteAnnouncement(ID)).toEqual({ ok: false, error: 'Duyuru bulunamadı. Sayfayı yenileyin.' });
    expect(updateTag).not.toHaveBeenCalled();
  });
  it('başarı', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    db.result.mockResolvedValue({ data: [{ id: ID }], error: null });
    expect(await deleteAnnouncement(ID)).toEqual({ ok: true });
    expect(updateTag).toHaveBeenCalledWith('site-content');
  });
});

describe('moveAnnouncement', () => {
  it('oturumsuz', async () => {
    getEditor.mockResolvedValue(null);
    expect(await moveAnnouncement(ID, 1)).toEqual({ ok: false, error: SESSION });
    expect(db.calls).toEqual([]);
  });
  it('geçersiz kimlik veya yön', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    expect((await moveAnnouncement('x', 1)).ok).toBe(false);
    expect((await moveAnnouncement(ID, 2 as 1)).ok).toBe(false);
    expect(db.calls).toEqual([]);
  });
  it('tek rpc çağrısı, başarıda etiket', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    db.rpc.mockResolvedValue({ data: true, error: null });
    expect(await moveAnnouncement(ID, -1)).toEqual({ ok: true });
    expect(db.rpc).toHaveBeenCalledWith('reorder_announcements', { p_id: ID, p_dir: -1 });
    expect(db.calls).toEqual(['client', 'rpc']);
    expect(updateTag).toHaveBeenCalledWith('site-content');
  });
  it('bulunamadı (rpc false)', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    db.rpc.mockResolvedValue({ data: false, error: null });
    expect(await moveAnnouncement(ID, 1)).toEqual({ ok: false, error: 'Duyuru bulunamadı. Sayfayı yenileyin.' });
    expect(updateTag).not.toHaveBeenCalled();
  });
  it('DB hatası: Türkçe hata, etiket yok', async () => {
    getEditor.mockResolvedValue({ id: 'u' });
    db.rpc.mockResolvedValue({ data: null, error: { code: '42501' } });
    expect(await moveAnnouncement(ID, 1)).toEqual({ ok: false, error: 'Duyuru taşınamadı.' });
    expect(updateTag).not.toHaveBeenCalled();
  });
});
