import { describe, it, expect } from 'vitest';
import robots from '../robots';

describe('robots.txt', () => {
  const rules = robots().rules;
  const disallow = Array.isArray(rules) ? rules[0].disallow : rules.disallow;
  const list = Array.isArray(disallow) ? disallow : [disallow];

  it('landing page dizinini taramaya kapatır', () => {
    expect(list).toContain('/lp/');
  });

  it('api, admin ve teşekkür sayfasını kapalı tutar', () => {
    expect(list).toContain('/api/');
    expect(list).toContain('/admin');
    expect(list).toContain('/tesekkurler');
  });
});
