import { describe, it, expect, beforeAll, vi } from 'vitest';

vi.mock('next/cache', () => ({ cacheLife: vi.fn() }));

import sitemap from '../sitemap';

describe('sitemap', () => {
  let entries: Awaited<ReturnType<typeof sitemap>>;
  beforeAll(async () => {
    entries = await sitemap();
  });

  it('17 URL üretir (Güvenlik ve Bültenler kalktı)', () => {
    expect(entries).toHaveLength(17);
  });

  it('ana sayfayı içerir', () => {
    expect(entries.some((e) => e.url === 'https://sekeranaokulu.com')).toBe(true);
  });

  it('teşekkür sayfasını içermez', () => {
    expect(entries.some((e) => e.url.includes('/tesekkurler'))).toBe(false);
  });

  it('her girdinin geçerli bir önceliği vardır', () => {
    expect(entries.every((e) => typeof e.priority === 'number' && e.priority <= 1)).toBe(true);
  });

  it('ana sayfa en yüksek önceliğe sahiptir', () => {
    const home = entries.find((e) => e.url === 'https://sekeranaokulu.com');
    expect(home?.priority).toBe(1);
  });
});
