import { describe, it, expect, afterEach, vi } from 'vitest';
import { insertWebsiteLead } from '@/lib/websiteLeads';
import { POST } from '../route';

vi.mock('@/lib/websiteLeads', () => ({
  insertWebsiteLead: vi.fn().mockResolvedValue('skipped'),
}));

const valid = {
  parentName: 'Ayşe Yılmaz',
  phone: '05301018875',
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
    vi.mocked(insertWebsiteLead).mockResolvedValue('skipped');
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

  it('supabase kaydı başarısızsa 500 döner', async () => {
    vi.mocked(insertWebsiteLead).mockResolvedValue('failed');
    const res = await POST(makeRequest(JSON.stringify(valid)));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.ok).toBe(false);
  });

  it('supabase kaydı olunca RESEND olmadan da 200 döner', async () => {
    vi.stubEnv('RESEND_API_KEY', undefined);
    vi.mocked(insertWebsiteLead).mockResolvedValue('saved');
    const res = await POST(makeRequest(JSON.stringify(valid)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('şemaya uymayan payload 400 döner ve errors doludur', async () => {
    const res = await POST(makeRequest(JSON.stringify({ ...valid, phone: '123' })));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.errors).toBeTruthy();
    expect(Object.keys(json.errors).length).toBeGreaterThan(0);
  });
});
