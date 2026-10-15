import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { cacheLife, orderCalls, result } = vi.hoisted(() => ({ cacheLife: vi.fn(), orderCalls: [] as string[], result: vi.fn() }));
vi.mock('next/cache', () => ({ cacheLife, cacheTag: vi.fn() }));
vi.mock('next/headers', () => ({ draftMode: async () => ({ isEnabled: false }) }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/public', () => ({
  createPublicSupabase: () => ({
    from: () => ({
      select: () => {
        const q = { order: (col: string) => (orderCalls.push(col), q), then: (res: (v: unknown) => unknown) => res(result()) };
        return q;
      },
    }),
  }),
}));

import { getAnnouncements } from '../getContent';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'a1', title: 'Kermes', body: '<p>Merhaba</p>', starts_on: '2026-10-20', ends_on: null, sort: 0,
  media_assets: { s3_key: 'site-images/2026/a.webp', alt: 'Kermes afişi' }, ...over,
});

beforeEach(() => {
  orderCalls.length = 0;
  cacheLife.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubEnv('NEXT_PUBLIC_MEDIA_BASE_URL', 'https://cdn.example.com');
});
afterEach(() => vi.unstubAllEnvs());

describe('getAnnouncements', () => {
  it('görseli taban adresle birleştirir, sort sonra id sırasıyla okur', async () => {
    result.mockReturnValue({ data: [row()], error: null });
    const [a] = await getAnnouncements();
    expect(a.imageSrc).toBe('https://cdn.example.com/site-images/2026/a.webp');
    expect(a.imageAlt).toBe('Kermes afişi');
    expect(orderCalls).toEqual(['sort', 'id']);
    expect(cacheLife).toHaveBeenCalledWith('hours');
  });
  it('taban adres boşsa görsel null', async () => {
    result.mockReturnValue({ data: [row()], error: null });
    vi.stubEnv('NEXT_PUBLIC_MEDIA_BASE_URL', '');
    expect((await getAnnouncements())[0].imageSrc).toBeNull();
  });
  it('taban adres tanımsızsa görsel null', async () => {
    result.mockReturnValue({ data: [row()], error: null });
    delete process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
    expect((await getAnnouncements())[0].imageSrc).toBeNull();
  });
  it('s3_key boşsa görsel null', async () => {
    result.mockReturnValue({ data: [row({ media_assets: { s3_key: '', alt: 'x' } })], error: null });
    expect((await getAnnouncements())[0].imageSrc).toBeNull();
  });
  it('gövdeyi okurken yeniden temizler', async () => {
    result.mockReturnValue({ data: [row({ body: '<p>ok</p><script>x</script>' })], error: null });
    expect((await getAnnouncements())[0].body).toBe('<p>ok</p>');
  });
  it('hata olursa boş liste ve dakikalar önbelleği', async () => {
    result.mockReturnValue({ data: null, error: { message: 'down' } });
    expect(await getAnnouncements()).toEqual([]);
    expect(cacheLife).toHaveBeenCalledWith('minutes');
  });
});
