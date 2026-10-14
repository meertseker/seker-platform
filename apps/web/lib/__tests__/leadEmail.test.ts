import { describe, it, expect, afterEach, vi } from 'vitest';
import { SITE } from '../site';

const send = vi.fn().mockResolvedValue({ data: { id: 'test' }, error: null });
vi.mock('resend', () => ({
  Resend: class {
    emails = { send };
  },
}));

const lead = {
  parentName: 'Ayşe Yılmaz',
  phone: '05301018875',
  kvkkConsent: true as const,
  gclid: '',
  landingPath: '',
  utm: {},
  website: '',
};

describe('sendLeadEmail ortam değişkeni geri dönüşleri', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    send.mockClear();
  });

  it('LEAD_NOTIFICATION_EMAIL boş string ise SITE.email kullanılır', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('LEAD_NOTIFICATION_EMAIL', '');
    const { sendLeadEmail } = await import('../leadEmail');
    await sendLeadEmail(lead as never, { status: 'saved', leadId: 'L1', duplicate: false });
    expect(send.mock.calls[0][0].to).toBe(SITE.email);
  });

  it('PANEL_URL boş string ise varsayılan panel adresi kullanılır', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('PANEL_URL', '');
    const { sendLeadEmail } = await import('../leadEmail');
    await sendLeadEmail(lead as never, { status: 'saved', leadId: 'L1', duplicate: false });
    expect(send.mock.calls[0][0].text).toContain('https://panel.sekeranaokulu.com/leads/L1');
  });
});
