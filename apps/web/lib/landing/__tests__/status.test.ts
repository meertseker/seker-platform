import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CODE_LP_SLUGS } from '@seker/shared/landing';
import { lookupLpStatus, lpProxyDecision } from '../status';

const CODE: ReadonlySet<string> = new Set(CODE_LP_SLUGS);

describe('lpProxyDecision', () => {
  it('kod slug’ı her zaman geçer', () => {
    expect(lpProxyDecision('beykent-anaokulu', CODE, null)).toEqual({ kind: 'next' });
  });

  it('adres kuralına uymayan slug 404', () => {
    expect(lpProxyDecision('Kotu_Slug', CODE, null)).toEqual({ kind: 'notFound' });
  });

  it('yayında sayfa geçer', () => {
    expect(lpProxyDecision('ilk-hafta-uyum', CODE, 'yayinda')).toEqual({ kind: 'next' });
  });

  it('arşivlenmiş sayfa 302 ile az mevcutlu sayfasına gider', () => {
    expect(lpProxyDecision('ilk-hafta-uyum', CODE, 'arsiv')).toEqual({ kind: 'redirect', to: '/lp/az-mevcutlu-anaokulu' });
  });

  it('olmayan (taslak dahil) sayfa 404', () => {
    expect(lpProxyDecision('ilk-hafta-uyum', CODE, 'yok')).toEqual({ kind: 'notFound' });
  });

  it('sorgu hatasında sayfa karar verir (geçer)', () => {
    expect(lpProxyDecision('ilk-hafta-uyum', CODE, 'hata')).toEqual({ kind: 'next' });
  });
});

describe('lookupLpStatus', () => {
  const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  let n = 0;
  const slug = () => `sayfa-${++n}`;

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://db.test');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'gizli');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('yayındaki satır → yayinda; REST adresi ve anahtarlarla sorgular', async () => {
    const fetchFn = vi.fn(() => json([{ status: 'yayinda' }]));
    const s = slug();
    expect(await lookupLpStatus(s, { fetchFn: fetchFn as unknown as typeof fetch })).toBe('yayinda');
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`http://db.test/rest/v1/landing_pages?slug=eq.${s}&select=status`);
    expect(init.headers).toMatchObject({ apikey: 'gizli', Authorization: 'Bearer gizli' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('satır yok → yok', async () => {
    expect(await lookupLpStatus(slug(), { fetchFn: (() => json([])) as unknown as typeof fetch })).toBe('yok');
  });

  it('taslak → yok', async () => {
    expect(await lookupLpStatus(slug(), { fetchFn: (() => json([{ status: 'taslak' }])) as unknown as typeof fetch })).toBe('yok');
  });

  it('arşiv → arsiv', async () => {
    expect(await lookupLpStatus(slug(), { fetchFn: (() => json([{ status: 'arsiv' }])) as unknown as typeof fetch })).toBe('arsiv');
  });

  it('fetch reddederse hata', async () => {
    const fetchFn = (() => Promise.reject(new Error('ağ'))) as unknown as typeof fetch;
    expect(await lookupLpStatus(slug(), { fetchFn })).toBe('hata');
  });

  it('HTTP hatası → hata', async () => {
    const fetchFn = (() => Promise.resolve(new Response('x', { status: 500 }))) as unknown as typeof fetch;
    expect(await lookupLpStatus(slug(), { fetchFn })).toBe('hata');
  });

  it('env yoksa sorgusuz hata', async () => {
    vi.stubEnv('SUPABASE_SECRET_KEY', '');
    const fetchFn = vi.fn(() => json([]));
    expect(await lookupLpStatus(slug(), { fetchFn: fetchFn as unknown as typeof fetch })).toBe('hata');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('30 sn içinde ikinci çağrı önbellekten; 31. saniyede yeniden sorgular', async () => {
    const fetchFn = vi.fn(() => json([{ status: 'yayinda' }]));
    const s = slug();
    let t = 1_000_000;
    const deps = { fetchFn: fetchFn as unknown as typeof fetch, now: () => t };
    await lookupLpStatus(s, deps);
    t += 30_000;
    await lookupLpStatus(s, deps);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    t += 1_000;
    await lookupLpStatus(s, deps);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('hata önbelleğe alınmaz', async () => {
    const s = slug();
    await lookupLpStatus(s, { fetchFn: (() => Promise.reject(new Error('ağ'))) as unknown as typeof fetch });
    expect(await lookupLpStatus(s, { fetchFn: (() => json([{ status: 'yayinda' }])) as unknown as typeof fetch })).toBe('yayinda');
  });
});
