import { describe, it, expect, vi, beforeEach } from 'vitest';

const { updateTag, rpc, from, getEditor, supabaseFactory } = vi.hoisted(() => ({
  updateTag: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  getEditor: vi.fn(),
  supabaseFactory: vi.fn(),
}));
vi.mock('next/cache', () => ({ updateTag }));
vi.mock('@seker/auth/editor', () => ({ getEditor: () => getEditor() }));
vi.mock('@seker/auth/server', () => ({
  createServerSupabase: async () => supabaseFactory(),
}));
vi.mock('@/lib/content/registry', () => ({
  SLOTS: { 't.title': { kind: 'text', max: 20, default: 'x', label: 'Başlık' } },
}));

import { saveContent, revertRevision, listRevisions } from '../content';

const SESSION = 'Oturumunuz sona erdi. Panelden tekrar giriş yapın; değişiklikleriniz bu tarayıcıda saklandı.';
const SAVE_FAIL = 'Kaydedilemedi, tekrar deneyin.';

/** Zincirlenebilir ve await edilebilir sorgu: her yöntem kendisini döner, await sonucu verir. */
function query(result: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'single', 'maybeSingle']) q[m] = vi.fn(() => q);
  q.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return q;
}

beforeEach(() => {
  updateTag.mockReset();
  rpc.mockReset();
  from.mockReset();
  getEditor.mockReset();
  supabaseFactory.mockReset();
  supabaseFactory.mockReturnValue({ rpc, from });
});

describe('saveContent', () => {
  it('RPC boş yanıt dönerse kayıt hatası döner, updateTag çağrılmaz', async () => {
    getEditor.mockResolvedValue({ id: 'u', fullName: 'A' });
    rpc.mockResolvedValue({ data: null, error: null });
    const r = await saveContent([{ key: 't.title', value: 'Yeni', baseUpdatedAt: null }]);
    expect(r).toEqual({ ok: false, error: SAVE_FAIL });
    expect(updateTag).not.toHaveBeenCalled();
  });
  it('RPC biçimi bozuksa kayıt hatası döner', async () => {
    getEditor.mockResolvedValue({ id: 'u', fullName: 'A' });
    rpc.mockResolvedValue({ data: { conflicts: 'x' }, error: null });
    const r = await saveContent([{ key: 't.title', value: 'Yeni', baseUpdatedAt: null }]);
    expect(r).toEqual({ ok: false, error: SAVE_FAIL });
  });
  it('createServerSupabase fırlatırsa kayıt hatası döner', async () => {
    getEditor.mockResolvedValue({ id: 'u', fullName: 'A' });
    supabaseFactory.mockImplementation(() => {
      throw new Error('ağ');
    });
    const r = await saveContent([{ key: 't.title', value: 'Yeni', baseUpdatedAt: null }]);
    expect(r).toEqual({ ok: false, error: SAVE_FAIL });
    expect(updateTag).not.toHaveBeenCalled();
  });
  it('getEditor fırlatırsa kayıt hatası döner', async () => {
    getEditor.mockRejectedValue(new Error('jwt'));
    const r = await saveContent([{ key: 't.title', value: 'Yeni', baseUpdatedAt: null }]);
    expect(r).toEqual({ ok: false, error: SAVE_FAIL });
    expect(rpc).not.toHaveBeenCalled();
  });

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

describe('revertRevision', () => {
  it('oturum yoksa sorgu yapmaz, oturum mesajı döner', async () => {
    getEditor.mockResolvedValue(null);
    const r = await revertRevision('rev-1');
    expect(r).toEqual({ ok: false, error: SESSION });
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('eski değer null ise (ilk revizyon) değeri null yazar, güncel satırın updated_at değerini taşır', async () => {
    getEditor.mockResolvedValue({ id: 'u', fullName: 'A' });
    from.mockImplementation((table: string) =>
      table === 'content_revisions'
        ? query({ data: { key: 't.title', old_value: null }, error: null })
        : query({ data: { updated_at: '2026-10-14 09:00:00.123456+00' }, error: null }),
    );
    rpc.mockResolvedValue({ data: { conflicts: [], saved_at: '2026-10-14 10:00:00.1+00' }, error: null });
    const r = await revertRevision('rev-1');
    expect(rpc).toHaveBeenCalledWith('save_site_content', {
      p_edits: [{ key: 't.title', kind: 'text', value: null, baseUpdatedAt: '2026-10-14 09:00:00.123456+00' }],
    });
    expect(r).toEqual({ ok: true, savedAt: '2026-10-14 10:00:00.1+00' });
  });
  it('eski değer doluysa o değeri geri yükler', async () => {
    getEditor.mockResolvedValue({ id: 'u', fullName: 'A' });
    from.mockImplementation((table: string) =>
      table === 'content_revisions'
        ? query({ data: { key: 't.title', old_value: 'Eski metin' }, error: null })
        : query({ data: { updated_at: '2026-10-14 09:00:00.123456+00' }, error: null }),
    );
    rpc.mockResolvedValue({ data: { conflicts: [], saved_at: '2026-10-14 10:00:00.1+00' }, error: null });
    const r = await revertRevision('rev-2');
    expect(rpc).toHaveBeenCalledWith('save_site_content', {
      p_edits: [{ key: 't.title', kind: 'text', value: 'Eski metin', baseUpdatedAt: '2026-10-14 09:00:00.123456+00' }],
    });
    expect(r.ok).toBe(true);
  });
  it('revizyon bulunamazsa yazmaz', async () => {
    getEditor.mockResolvedValue({ id: 'u', fullName: 'A' });
    from.mockImplementation(() => query({ data: null, error: null }));
    const r = await revertRevision('yok');
    expect(r).toEqual({ ok: false, error: 'Bu değişiklik bulunamadı.' });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('listRevisions', () => {
  it('oturum yoksa hata döner, sorgu yapmaz', async () => {
    getEditor.mockResolvedValue(null);
    expect(await listRevisions()).toEqual({ ok: false, error: expect.stringContaining('Oturumunuz') });
    expect(from).not.toHaveBeenCalled();
  });
  it('editör için satırları eşler', async () => {
    getEditor.mockResolvedValue({ id: 'u', fullName: 'A' });
    from.mockImplementation(() =>
      query({
        data: [
          {
            id: 'r1',
            key: 't.title',
            old_value: 'Eski metin',
            new_value: 'Yeni',
            created_at: '2026-10-14T10:00:00Z',
            profiles: { full_name: 'Ayşe' },
          },
          { id: 'r2', key: 't.title', old_value: null, new_value: 'İlk', created_at: '2026-10-13T10:00:00Z', profiles: null },
        ],
        error: null,
      }),
    );
    expect(await listRevisions()).toEqual({ ok: true, rows: [
      { id: 'r1', key: 't.title', label: 'Başlık', createdAt: '2026-10-14T10:00:00Z', editorName: 'Ayşe', before: 'Eski metin', after: 'Yeni' },
      { id: 'r2', key: 't.title', label: 'Başlık', createdAt: '2026-10-13T10:00:00Z', editorName: '—', before: '(sitenin ilk hâli)', after: 'İlk' },
    ] });
  });
  it('sorgu hatasında hata döner', async () => {
    getEditor.mockResolvedValue({ id: 'u', fullName: 'A' });
    from.mockImplementation(() => query({ data: null, error: { code: 'X' } }));
    expect(await listRevisions()).toMatchObject({ ok: false });
  });
});
