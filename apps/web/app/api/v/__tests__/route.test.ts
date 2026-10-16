// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const rpc = vi.fn().mockResolvedValue({ error: null });
vi.mock('@seker/auth/admin', () => ({ createAdminSupabase: () => ({ rpc }) }));

import { POST } from '../route';

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1';
const VALID = { p: '/lp/kres', s: 'google_ads', d: 'mobil', e: true };

function req(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('https://sekeranaokulu.com/api/v', {
    method: 'POST',
    headers: { 'user-agent': UA, origin: 'https://sekeranaokulu.com', host: 'sekeranaokulu.com', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/v', () => {
  beforeEach(() => rpc.mockClear());

  it('geçerli ziyareti kaydeder ve 204 döner', async () => {
    const res = await POST(req(VALID));
    expect(res.status).toBe(204);
    expect(rpc).toHaveBeenCalledWith('record_site_visit', {
      p_path: '/lp/kres', p_source: 'google_ads', p_device: 'mobil', p_entrance: true,
    });
  });

  it('başka siteden gelen istek sayılmaz', async () => {
    expect((await POST(req(VALID, { origin: 'https://evil.example' }))).status).toBe(204);
    expect((await POST(req(VALID, { origin: 'null' }))).status).toBe(204);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('botlar sayılmaz', async () => {
    await POST(req(VALID, { 'user-agent': 'Googlebot/2.1' }));
    expect(rpc).not.toHaveBeenCalled();
  });

  it('panele giriş yapmış personel sayılmaz', async () => {
    await POST(req(VALID, { cookie: 'sb-abc-auth-token=xyz' }));
    expect(rpc).not.toHaveBeenCalled();
  });

  it('bozuk veya geçersiz gövde sayılmaz', async () => {
    await POST(req('{bozuk'));
    await POST(req({ ...VALID, p: '/api/v' }));
    await POST(req({ ...VALID, s: 'site_ici' }));
    expect(rpc).not.toHaveBeenCalled();
  });

  it('veritabanı hatası ziyaretçiye yansımaz', async () => {
    rpc.mockResolvedValueOnce({ error: { code: '42501' } });
    expect((await POST(req(VALID))).status).toBe(204);
  });
});
