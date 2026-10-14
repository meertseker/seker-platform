import { describe, it, expect } from 'vitest';
import { clientIp, createRateLimiter } from '../rateLimit';

describe('createRateLimiter', () => {
  it('pencere içinde limit kadar izin verir, sonrakini reddeder', () => {
    const rl = createRateLimiter({ limit: 5, windowMs: 600_000 });
    const t = 1_000_000;
    for (let i = 0; i < 5; i++) expect(rl.allow('1.1.1.1', t + i)).toBe(true);
    expect(rl.allow('1.1.1.1', t + 10)).toBe(false);
  });

  it('farklı IP birbirini etkilemez', () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 600_000 });
    expect(rl.allow('a', 0)).toBe(true);
    expect(rl.allow('b', 0)).toBe(true);
    expect(rl.allow('a', 1)).toBe(false);
  });

  it('pencere geçince tekrar izin verir', () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(rl.allow('a', 0)).toBe(true);
    expect(rl.allow('a', 999)).toBe(false);
    expect(rl.allow('a', 1000)).toBe(true);
  });
});

describe('clientIp', () => {
  it('X-Forwarded-For listesinin ilk değerini alır (Caddy gerçek istemci IP\'sini yazar)', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.5, 10.0.0.2' }))).toBe('203.0.113.5');
  });

  it('başlık yoksa unknown döner', () => {
    expect(clientIp(new Headers())).toBe('unknown');
  });
});
