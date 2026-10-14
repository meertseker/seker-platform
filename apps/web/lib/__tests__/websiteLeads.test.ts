import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('@seker/auth/admin', () => ({ createAdminSupabase: () => ({ rpc }) }));

import { createWebLead } from '../websiteLeads';
import type { Lead } from '../leadSchema';

const lead: Lead = {
  parentName: 'Ayşe Yılmaz',
  phone: '+905301018875',
  gclid: 'Cj0ABC',
  landingPath: '/lp/kres-2-yas',
  utm: { utm_campaign: 'kres' },
  website: '',
  kvkkConsent: true,
};

describe('createWebLead', () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it('create_web_lead fonksiyonunu doğru argümanlarla çağırır', async () => {
    rpc.mockResolvedValue({ data: { lead_id: 'L1', duplicate: false }, error: null });
    const consentAt = new Date('2026-10-20T09:00:00Z');
    const result = await createWebLead(lead, consentAt);
    expect(rpc).toHaveBeenCalledWith('create_web_lead', {
      p_parent_name: 'Ayşe Yılmaz',
      p_phone: '+905301018875',
      p_gclid: 'Cj0ABC',
      p_utm: { utm_campaign: 'kres' },
      p_landing_path: '/lp/kres-2-yas',
      p_consent_at: '2026-10-20T09:00:00.000Z',
    });
    expect(result).toEqual({ status: 'saved', leadId: 'L1', duplicate: false });
  });

  it('RPC hata dönerse failed döner ve telefonu loglamaz', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST301', message: 'x' } });
    expect(await createWebLead(lead)).toEqual({ status: 'failed' });
    expect(JSON.stringify(log.mock.calls)).not.toContain('5301018875');
    log.mockRestore();
  });

  it('istemci throw ederse (ağ hatası) failed döner', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockRejectedValue(new Error('fetch failed'));
    expect(await createWebLead(lead)).toEqual({ status: 'failed' });
  });
});
