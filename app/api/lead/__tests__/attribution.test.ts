import { describe, it, expect, afterEach, vi } from 'vitest';

/**
 * GCLID'in e-postaya ulaşması olmadan offline conversion import imkânsız
 * (Task 9). Bu testler route.test.ts'teki mevcut testleri değiştirmez,
 * yalnızca gclid/landingPath'in gerçekten Resend'e giden e-posta gövdesine
 * ulaştığını ve attribution'sız (organik) bir başvurunun da kabul edilip
 * e-posta gönderdiğini doğrular.
 */
const send = vi.fn().mockResolvedValue({ data: { id: 'test' }, error: null });

vi.mock('resend', () => ({
  Resend: class {
    emails = { send };
  },
}));

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

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/lead — attribution', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    send.mockClear();
  });

  it('gclid ve landingPath e-posta gövdesine ulaşır', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    const { POST } = await import('../route');

    const res = await POST(
      makeRequest({ ...valid, gclid: 'Cj0ABC123', landingPath: '/lp/az-mevcutlu-anaokulu' }),
    );

    expect(res.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    const text = send.mock.calls[0][0].text as string;
    expect(text).toContain('GCLID: Cj0ABC123');
    expect(text).toContain('Kaynak sayfa: /lp/az-mevcutlu-anaokulu');
  });

  it('attribution olmadan gönderilen organik başvuru da kabul edilir ve e-posta gider', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    const { POST } = await import('../route');

    const res = await POST(makeRequest(valid));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    const text = send.mock.calls[0][0].text as string;
    expect(text).toContain('GCLID: —');
    expect(text).toContain('Kaynak sayfa: —');
  });
});
