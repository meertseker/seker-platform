import { describe, it, expect, vi, afterEach } from 'vitest';

describe('Çerez Politikası Meta pikseli', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('v1 metninde Meta çerezleri yok', async () => {
    vi.stubEnv('NEXT_PUBLIC_CONSENT_VERSION', '');
    vi.resetModules();
    const { CEREZ_HTML } = await import('../cerez');
    expect(CEREZ_HTML).not.toContain('_fbp');
    expect(CEREZ_HTML).not.toContain('_fbc');
    expect(CEREZ_HTML).not.toContain('Meta');
  });

  it('v2 metni Meta pikseli çerezlerini (_fbp, _fbc) ve Meta Platforms Ireland\'ı listeler', async () => {
    vi.stubEnv('NEXT_PUBLIC_CONSENT_VERSION', '2');
    vi.resetModules();
    const { CEREZ_HTML } = await import('../cerez');
    expect(CEREZ_HTML).toContain('_fbp');
    expect(CEREZ_HTML).toContain('_fbc');
    expect(CEREZ_HTML).toContain('Meta Platforms Ireland');
  });
});
