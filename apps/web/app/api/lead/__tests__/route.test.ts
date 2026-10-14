import { describe, it, expect, afterEach, vi } from 'vitest';
import { createWebLead } from '@/lib/websiteLeads';
import { POST } from '../route';

vi.mock('@/lib/websiteLeads', () => ({
  createWebLead: vi.fn().mockResolvedValue({ status: 'saved', leadId: 'L1', duplicate: false }),
}));

const send = vi.fn().mockResolvedValue({ data: { id: 'test' }, error: null });
vi.mock('resend', () => ({ Resend: class { emails = { send }; } }));

const valid = { parentName: 'Ayşe Yılmaz', phone: '05301018875', kvkkConsent: true };

let ipSeq = 0;
function makeRequest(body: string, ip = `198.51.100.${++ipSeq}`) {
  return new Request('http://localhost/api/lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body,
  });
}

describe('POST /api/lead', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    send.mockClear();
    vi.mocked(createWebLead).mockReset();
    vi.mocked(createWebLead).mockResolvedValue({ status: 'saved', leadId: 'L1', duplicate: false });
  });

  it('bozuk JSON gövdesinde 400 döner ve hem errors hem message alanı bulunur', async () => {
    const res = await POST(makeRequest('{not valid json'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, errors: {}, message: 'Geçersiz istek' });
  });

  it('sabit hat numarasında 400 ve Türkçe telefon hatası döner', async () => {
    const res = await POST(makeRequest(JSON.stringify({ ...valid, phone: '0212 222 33 44' })));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.errors.phone[0]).toContain('cep telefonu');
    expect(createWebLead).not.toHaveBeenCalled();
  });

  it('kayıt başarılıysa RESEND olmadan da 200 döner', async () => {
    vi.stubEnv('RESEND_API_KEY', undefined);
    const res = await POST(makeRequest(JSON.stringify(valid)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(vi.mocked(createWebLead).mock.calls[0][0].phone).toBe('+905301018875');
  });

  it('kayıt başarısız ve e-posta yoksa 500 döner', async () => {
    vi.stubEnv('RESEND_API_KEY', undefined);
    vi.mocked(createWebLead).mockResolvedValue({ status: 'failed' });
    const res = await POST(makeRequest(JSON.stringify(valid)));
    expect(res.status).toBe(500);
    expect((await res.json()).message).toBe('Talebiniz alınamadı, lütfen telefonla ulaşın.');
  });

  it('kayıt başarısız ama e-posta gittiyse veli başarı görür, e-postada uyarı vardır', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.mocked(createWebLead).mockResolvedValue({ status: 'failed' });
    const res = await POST(makeRequest(JSON.stringify(valid)));
    expect(res.status).toBe(200);
    expect(send.mock.calls[0][0].text).toContain('Panele kaydedilemedi');
  });

  it('kayıt başarılı, e-posta hata verirse yine 200 döner', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    send.mockRejectedValueOnce(new Error('resend down'));
    const res = await POST(makeRequest(JSON.stringify(valid)));
    expect(res.status).toBe(200);
  });

  it('honeypot doluysa kaydetmeden 200 döner', async () => {
    const res = await POST(makeRequest(JSON.stringify({ ...valid, website: 'http://spam.example' })));
    expect(res.status).toBe(200);
    expect(createWebLead).not.toHaveBeenCalled();
  });

  it("aynı IP'den 10 dakikada 6. istek 429 döner", async () => {
    vi.stubEnv('RESEND_API_KEY', undefined);
    const ip = '192.0.2.77';
    for (let i = 0; i < 5; i++) {
      expect((await POST(makeRequest(JSON.stringify(valid), ip))).status).toBe(200);
    }
    const res = await POST(makeRequest(JSON.stringify(valid), ip));
    expect(res.status).toBe(429);
    expect((await res.json()).ok).toBe(false);
  });

  it('tekrar başvuruda e-posta konusu bunu belirtir', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.mocked(createWebLead).mockResolvedValue({ status: 'saved', leadId: 'L9', duplicate: true });
    await POST(makeRequest(JSON.stringify(valid)));
    expect(send.mock.calls[0][0].subject).toContain('Tekrar başvuru');
  });
});
