import { afterEach, describe, expect, it, vi } from 'vitest';
import { requireEnv } from '../src/env';

describe('requireEnv', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('tanımlı değeri döner', () => {
    vi.stubEnv('SEKER_TEST_VAR', 'deger');
    expect(requireEnv('SEKER_TEST_VAR')).toBe('deger');
  });

  it('boş veya tanımsızsa adıyla hata fırlatır', () => {
    vi.stubEnv('SEKER_TEST_VAR', '');
    expect(() => requireEnv('SEKER_TEST_VAR')).toThrow('Eksik ortam değişkeni: SEKER_TEST_VAR');
  });
});
