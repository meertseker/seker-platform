import { describe, it, expect, vi, beforeEach } from 'vitest';

const { updateTag, rpc, getEditor } = vi.hoisted(() => ({ updateTag: vi.fn(), rpc: vi.fn(), getEditor: vi.fn() }));
vi.mock('next/cache', () => ({ updateTag }));
vi.mock('@seker/auth/editor', () => ({ getEditor: () => getEditor() }));
vi.mock('@seker/auth/server', () => ({
  createServerSupabase: async () => ({ rpc }),
}));
vi.mock('@/lib/content/registry', () => ({
  SLOTS: { 't.title': { kind: 'text', max: 20, default: 'x', label: 'Başlık' } },
}));

import { saveContent } from '../content';

beforeEach(() => {
  updateTag.mockReset();
  rpc.mockReset();
  getEditor.mockReset();
});

describe('saveContent', () => {
  it('oturum yoksa yazmaz, anlaşılır mesaj döner', async () => {
    getEditor.mockResolvedValue(null);
    const r = await saveContent([{ key: 't.title', value: 'a', baseUpdatedAt: null }]);
    expect(r).toEqual({ ok: false, error: 'Oturumunuz sona erdi. Panelden tekrar giriş yapın; değişiklikleriniz bu tarayıcıda saklandı.' });
    expect(rpc).not.toHaveBeenCalled();
  });
  it('başarılı kayıtta updateTag çağırır', async () => {
    getEditor.mockResolvedValue({ id: 'u', fullName: 'A' });
    rpc.mockResolvedValue({ data: { conflicts: [], saved_at: '2026-10-14 10:00:00.1+00' }, error: null });
    const r = await saveContent([{ key: 't.title', value: 'Yeni', baseUpdatedAt: '2026-10-14 09:00:00.123456+00' }]);
    expect(rpc).toHaveBeenCalledWith('save_site_content', {
      p_edits: [{ key: 't.title', kind: 'text', value: 'Yeni', baseUpdatedAt: '2026-10-14 09:00:00.123456+00' }],
    });
    expect(updateTag).toHaveBeenCalledWith('site-content');
    expect(r).toEqual({ ok: true, savedAt: '2026-10-14 10:00:00.1+00' });
  });
  it('çakışmada updateTag çağırmaz, anahtarları döner', async () => {
    getEditor.mockResolvedValue({ id: 'u', fullName: 'A' });
    rpc.mockResolvedValue({ data: { conflicts: ['t.title'], saved_at: null }, error: null });
    const r = await saveContent([{ key: 't.title', value: 'Yeni', baseUpdatedAt: null }]);
    expect(r).toEqual({
      ok: false,
      error: 'Bu metin siz düzenlerken başka bir yerden değişti. Sayfayı yenileyip tekrar deneyin.',
      conflicts: ['t.title'],
    });
    expect(updateTag).not.toHaveBeenCalled();
  });
  it('doğrulama hatası RPC çağırmaz', async () => {
    getEditor.mockResolvedValue({ id: 'u', fullName: 'A' });
    const r = await saveContent([{ key: 't.title', value: '', baseUpdatedAt: null }]);
    expect(r.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});
