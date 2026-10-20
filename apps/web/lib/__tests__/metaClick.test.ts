import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildFbc, readCookie, isMetaPaid } from '../metaClick';

describe('metaClick', () => {
  it('buildFbc biçimi fb.1.<ms>.<fbclid>; fbclid harfi değişmez', () => {
    expect(buildFbc('IwAR0AbC', 1700000000000)).toBe('fb.1.1700000000000.IwAR0AbC');
  });

  it('readCookie _fbc okur, olmayanı boş döner', () => {
    const c = '_ga=GA1.1; _fbc=fb.1.1700000000000.IwAR0; _fbp=fb.1.1700000000001.123';
    expect(readCookie(c, '_fbc')).toBe('fb.1.1700000000000.IwAR0');
    expect(readCookie(c, '_fbp')).toBe('fb.1.1700000000001.123');
    expect(readCookie(c, '_yok')).toBe('');
    expect(readCookie('', '_fbc')).toBe('');
  });

  it('isMetaPaid paid_social + instagram true, organik false', () => {
    expect(isMetaPaid({ utm_medium: 'paid_social', utm_source: 'instagram' })).toBe(true);
    expect(isMetaPaid({ utm_medium: 'Paid_Social', utm_source: 'IG' })).toBe(true);
    expect(isMetaPaid({ utm_medium: 'paid_social', utm_source: 'tiktok' })).toBe(false);
    expect(isMetaPaid({ utm_medium: 'social', utm_source: 'instagram' })).toBe(false);
    expect(isMetaPaid({})).toBe(false);
  });
});

describe('CONSENT_VERSION', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('varsayılan 1, env "2" iken 2', async () => {
    vi.stubEnv('NEXT_PUBLIC_CONSENT_VERSION', '');
    vi.resetModules();
    expect((await import('../metaClick')).CONSENT_VERSION).toBe(1);
    vi.stubEnv('NEXT_PUBLIC_CONSENT_VERSION', '2');
    vi.resetModules();
    expect((await import('../metaClick')).CONSENT_VERSION).toBe(2);
  });

  it('v1 onay metni Meta içermez; v2 içerir', async () => {
    vi.stubEnv('NEXT_PUBLIC_CONSENT_VERSION', '');
    vi.resetModules();
    const v1 = await import('@/content/kvkk');
    expect(v1.KVKK_CONSENT_LABEL).not.toContain('Meta');
    expect(JSON.stringify(v1.KVKK_TEXT)).not.toContain('Meta Platforms');
    vi.stubEnv('NEXT_PUBLIC_CONSENT_VERSION', '2');
    vi.resetModules();
    const v2 = await import('@/content/kvkk');
    expect(v2.KVKK_CONSENT_LABEL).toBe(
      "Aydınlatma Metni'ni okudum. Başvurum için aranmama ve başvuru bilgilerimin reklamlarımızın etkinliğini ölçmek amacıyla Google ve Meta (Instagram) ile paylaşılmasına onay veriyorum.",
    );
    expect(JSON.stringify(v2.KVKK_TEXT)).toContain('Meta Platforms Ireland');
  });
});
