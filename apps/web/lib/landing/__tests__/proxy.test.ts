import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { resetLpStatusCache } from '../status';
import { config, proxy } from '@/proxy';

const call = (path: string) => proxy(new NextRequest(`http://localhost${path}`));
const rewrittenTo404 = (res: Response) =>
  res.status === 404 && (res.headers.get('x-middleware-rewrite') ?? '').includes('/_not-found-slug');

describe('proxy — /lp yolları', () => {
  const fetchSpy = vi.fn();
  beforeEach(() => {
    resetLpStatusCache();
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://db.test');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'gizli');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('eşleştirici önizleme yolunu kapsar', () => {
    expect(config.matcher).toContain('/lp/onizleme/:token');
  });

  it('biçimi bozuk önizleme token’ı sorgusuz gerçek 404', async () => {
    expect(rewrittenTo404(await call('/lp/onizleme/kisa'))).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('biçimi doğru token sayfaya geçer (sorgusuz)', async () => {
    const res = await call(`/lp/onizleme/${'A'.repeat(43)}`);
    expect(res.headers.get('x-middleware-next')).toBe('1');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('çıplak /lp/onizleme sorgusuz 404', async () => {
    expect(rewrittenTo404(await call('/lp/onizleme'))).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('kod slug’ı sorgusuz geçer', async () => {
    const res = await call('/lp/beykent-anaokulu');
    expect(res.headers.get('x-middleware-next')).toBe('1');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('arşivlenmiş veritabanı sayfası 302', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify([{ status: 'arsiv' }]), { status: 200 }));
    const res = await call('/lp/ilk-hafta-uyum');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('http://localhost/lp/az-mevcutlu-anaokulu');
  });
});
