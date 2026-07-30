import { describe, it, expect } from 'vitest';
import sitemap from '../sitemap';

describe('sitemap', () => {
  const entries = sitemap();

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
