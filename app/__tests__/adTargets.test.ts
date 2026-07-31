import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { LANDING_SLUGS } from '@/content/landingPages';
import { AGE_GROUPS_CONTENT } from '@/content/ageGroups';
import { DAY_CHAPTERS } from '@/content/day';
import { AGE_GROUPS } from '@/lib/leadSchema';

const APP_DIR = path.join(process.cwd(), 'app');

function siteRouteExists(routePath: string): boolean {
  const segments = routePath.split('/').filter(Boolean);
  return existsSync(path.join(APP_DIR, '(site)', ...segments, 'page.tsx'));
}

/** Reklam planındaki site hedefleri (K1-K10 arama kampanyaları, `/lib/leadSchema`
 * ve `content/nav.ts` ile aynı 9 hedef sayfa). */
const AD_SITE_TARGETS = [
  '/', '/kayit', '/ucretler', '/egitim-yaklasimimiz', '/veli-yorumlari',
  '/guvenlik', '/gunluk-akis', '/kadromuz', '/yas-gruplari',
];

const EXPECTED_LPS = [
  'beykent-anaokulu', 'beylikduzu-anaokulu', 'az-mevcutlu-anaokulu',
  'kres-2-yas', 'anaokulu-ucret',
];

describe('reklam hedef sayfaları', () => {
  it.each(AD_SITE_TARGETS)('%s mevcut', (routePath) => {
    expect(siteRouteExists(routePath)).toBe(true);
  });

  it('dört yaş grubu sayfasının tümü tanımlı', () => {
    const slugs = AGE_GROUPS_CONTENT.map((g) => g.slug);
    for (const age of AGE_GROUPS) expect(slugs).toContain(`${age}-yas`);
  });
});

describe('K10 çapa hedefi', () => {
  it('/gunluk-akis içinde karşılama/uyum bölümü çapası var', () => {
    const ids = DAY_CHAPTERS.map((c) => c.id);
    expect(ids).toContain('karsilama');
  });
});

describe('landing page hedefleri', () => {
  it.each(EXPECTED_LPS)('/lp/%s tanımlı', (slug) => {
    expect(LANDING_SLUGS).toContain(slug);
  });

  it('dinamik LP rotası mevcut', () => {
    expect(existsSync(path.join(APP_DIR, '(lp)', 'lp', '[slug]', 'page.tsx'))).toBe(true);
  });
});

describe('LP kabuğu sinematik CSS yüklemez', () => {
  it('cine.css yalnızca site kabuğunda import edilir', () => {
    const lpLayout = readFileSync(path.join(APP_DIR, '(lp)', 'layout.tsx'), 'utf8');
    const siteLayout = readFileSync(path.join(APP_DIR, '(site)', 'layout.tsx'), 'utf8');
    const globals = readFileSync(path.join(APP_DIR, 'globals.css'), 'utf8');

    expect(lpLayout).not.toContain('cine.css');
    expect(siteLayout).toContain('cine.css');
    expect(globals).not.toContain('cine.css');
  });
});
