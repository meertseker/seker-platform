import { describe, it, expect, afterEach, vi } from 'vitest';
import { adminSessionToken, isValidAdminSession } from '../adminAuth';

describe('adminAuth', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('şifre yoksa oturum kabul etmez', () => {
    vi.stubEnv('ADMIN_PASSWORD', '');
    expect(adminSessionToken()).toBe('');
    expect(isValidAdminSession('anything')).toBe(false);
  });

  it('doğru çerezi kabul eder, sahteyi reddeder', () => {
    vi.stubEnv('ADMIN_PASSWORD', 'test-secret');
    const token = adminSessionToken();
    expect(isValidAdminSession(token)).toBe(true);
    expect(isValidAdminSession('0'.repeat(token.length))).toBe(false);
  });
});
