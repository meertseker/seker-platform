import { afterEach, describe, expect, it, vi } from 'vitest';
import { authCookieOptions } from '../src/cookie';

describe('authCookieOptions', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('üretimde ortak alan adına ve secure çereze yazar', () => {
    vi.stubEnv('AUTH_COOKIE_DOMAIN', '.sekeranaokulu.com');
    vi.stubEnv('NODE_ENV', 'production');
    expect(authCookieOptions()).toEqual({
      domain: '.sekeranaokulu.com',
      path: '/',
      sameSite: 'lax',
      secure: true,
    });
  });

  it('AUTH_COOKIE_DOMAIN boşsa host-only çerez kullanır (localhost)', () => {
    vi.stubEnv('AUTH_COOKIE_DOMAIN', '');
    vi.stubEnv('NODE_ENV', 'development');
    const options = authCookieOptions();
    expect(options.domain).toBeUndefined();
    expect(options.secure).toBe(false);
  });
});
