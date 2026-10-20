import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
  fbclid: '',
  fbc: '',
  fbp: '',
  metaEventId: '',
  adCookieConsent: false,
  consentVersion: 1,
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
      p_meta: { consent_version: 1, ad_cookie_consent: false },
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

  it('qualify alanlarını p_meta olarak geçer', async () => {
    rpc.mockResolvedValue({ data: { lead_id: 'L1', duplicate: false }, error: null });
    await createWebLead({
      ...lead,
      qualify: true,
      childBirthMonth: 5,
      childBirthYear: 2023,
      district: 'Diğer',
      startWindow: 'hemen',
      wantsWhatsapp: false,
    });
    expect(rpc.mock.calls[0][1].p_meta).toEqual({
      consent_version: 1,
      ad_cookie_consent: false,
      child_birth_month: 5,
      child_birth_year: 2023,
      district: 'Diğer',
      start_window: 'hemen',
      wants_whatsapp: false,
    });
  });

  it("p_meta'ya consent_version ve dolu meta alanlarını koyar", async () => {
    rpc.mockResolvedValue({ data: { lead_id: 'L1', duplicate: false }, error: null });
    await createWebLead({
      ...lead,
      fbclid: 'IwAR0',
      fbc: 'fb.1.1.IwAR0',
      fbp: 'fb.1.2.3',
      metaEventId: 'ev-1',
      adCookieConsent: true,
    });
    expect(rpc.mock.calls[0][1].p_meta).toEqual({
      consent_version: 1,
      ad_cookie_consent: true,
      fbclid: 'IwAR0',
      fbc: 'fb.1.1.IwAR0',
      fbp: 'fb.1.2.3',
      meta_event_id: 'ev-1',
    });
  });

  it('tarayıcı bilgisi yalnız çerez onayı varsa client_user_agent olarak gider, 400 karakterde kesilir (I-2)', async () => {
    rpc.mockResolvedValue({ data: { lead_id: 'L1', duplicate: false }, error: null });
    const ua = 'Mozilla/5.0 ' + 'x'.repeat(500);
    await createWebLead({ ...lead, adCookieConsent: true }, undefined, { userAgent: ua });
    expect(rpc.mock.calls[0][1].p_meta.client_user_agent).toBe(ua.slice(0, 400));

    await createWebLead({ ...lead, adCookieConsent: false }, undefined, { userAgent: ua });
    expect(rpc.mock.calls[1][1].p_meta).not.toHaveProperty('client_user_agent');

    await createWebLead({ ...lead, adCookieConsent: true }, undefined, { userAgent: '   ' });
    expect(rpc.mock.calls[2][1].p_meta).not.toHaveProperty('client_user_agent');

    await createWebLead({ ...lead, adCookieConsent: true });
    expect(rpc.mock.calls[3][1].p_meta).not.toHaveProperty('client_user_agent');
  });
});

describe('createWebLead onay sürümü (T8b)', () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: { lead_id: 'L1', duplicate: false }, error: null });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function load(serverVersion: '' | '2') {
    vi.stubEnv('NEXT_PUBLIC_CONSENT_VERSION', serverVersion);
    vi.resetModules();
    return (await import('../websiteLeads')).createWebLead;
  }

  it('sunucu v2, form v1 metnini gösterdiyse 1 kaydedilir', async () => {
    const create = await load('2');
    await create({ ...lead, consentVersion: 1 });
    expect(rpc.mock.calls[0][1].p_meta.consent_version).toBe(1);
  });

  it('sunucu v1, form v2 gönderse de 1 kaydedilir', async () => {
    const create = await load('');
    await create({ ...lead, consentVersion: 2 });
    expect(rpc.mock.calls[0][1].p_meta.consent_version).toBe(1);
  });

  it('ikisi de v2 ise 2 kaydedilir', async () => {
    const create = await load('2');
    await create({ ...lead, consentVersion: 2 });
    expect(rpc.mock.calls[0][1].p_meta.consent_version).toBe(2);
  });
});
