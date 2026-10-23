import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { revalidateTag } from 'next/cache';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

import { POST } from '../route';

const SECRET = 'a'.repeat(64);

function req(body: unknown, auth?: string) {
  return new Request('http://localhost/api/revalidate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(revalidateTag).mockClear();
  vi.stubEnv('WEB_REVALIDATE_SECRET', SECRET);
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/revalidate', () => {
  it('sır tanımsızsa 503', async () => {
    vi.stubEnv('WEB_REVALIDATE_SECRET', '');
    const res = await POST(req({ slug: 'ilk-hafta-uyum' }, `Bearer ${SECRET}`));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false });
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('yanlış sır 401, etiket düşürülmez', async () => {
    const res = await POST(req({ slug: 'ilk-hafta-uyum' }, `Bearer ${'b'.repeat(64)}`));
    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('uzunluğu farklı sır 401', async () => {
    const res = await POST(req({ slug: 'ilk-hafta-uyum' }, 'Bearer kisa'));
    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('başlık yoksa 401', async () => {
    const res = await POST(req({ slug: 'ilk-hafta-uyum' }));
    expect(res.status).toBe(401);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('adres kuralına uymayan slug 400', async () => {
    const res = await POST(req({ slug: 'Kotu Slug' }, `Bearer ${SECRET}`));
    expect(res.status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('bozuk gövde 400', async () => {
    const bad = new Request('http://localhost/api/revalidate', {
      method: 'POST',
      headers: { authorization: `Bearer ${SECRET}` },
      body: '{',
    });
    expect((await POST(bad)).status).toBe(400);
  });

  it('doğru sır ve slug: lp:<slug> etiketi anında düşer, 200', async () => {
    const res = await POST(req({ slug: 'ilk-hafta-uyum' }, `Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(revalidateTag).toHaveBeenCalledWith('lp:ilk-hafta-uyum', { expire: 0 });
  });
});
