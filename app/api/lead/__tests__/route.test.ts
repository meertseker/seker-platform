import { describe, it, expect, afterEach, vi } from 'vitest';
import { POST } from '../route';

const valid = {
  parentName: 'Ayşe Yılmaz',
  phone: '05301018875',
  email: 'ayse@example.com',
  childAge: '3-4',
  program: 'tam-gun',
  startTerm: '2026-2027',
  message: 'Bilgi almak istiyorum',
  kvkkConsent: true,
};

function makeRequest(body: string) {
  return new Request('http://localhost/api/lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

describe('POST /api/lead', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('bozuk JSON gövdesinde 400 döner ve hem errors hem message alanı bulunur', async () => {
    const res = await POST(makeRequest('{not valid json'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.errors).toEqual({});
    expect(json.message).toBe('Geçersiz istek');
  });

  it('RESEND_API_KEY tanımsızken geçerli lead 200 {ok:true} döner', async () => {
    vi.stubEnv('RESEND_API_KEY', undefined);
    const res = await POST(makeRequest(JSON.stringify(valid)));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
  });

  it('şemaya uymayan payload 400 döner ve errors doludur', async () => {
    const res = await POST(makeRequest(JSON.stringify({ ...valid, childAge: '15-16' })));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.errors).toBeTruthy();
    expect(Object.keys(json.errors).length).toBeGreaterThan(0);
  });
});
