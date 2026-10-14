import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { NAV_ITEMS, FOOTER_LINKS } from '@/content/nav';
import sitemap from '../sitemap';
import { SITE } from '@/lib/site';
import nextConfig from '../../next.config';

const APP_DIR = path.join(process.cwd(), 'app');
const ROUTE_GROUPS = ['', '(site)', '(lp)'];

/** Bir segment dizisi altında page.tsx var mı — Next.js dinamik segment
 * klasörlerini (`[slug]`) de eşleşen literal klasör gibi tanır. */
function findPage(dir: string, segments: string[]): boolean {
  if (segments.length === 0) return existsSync(path.join(dir, 'page.tsx'));
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return false;
  const [head, ...rest] = segments;
  return readdirSync(dir).some((entry) => {
    if (entry !== head && !/^\[.+\]$/.test(entry)) return false;
    return findPage(path.join(dir, entry), rest);
  });
}

/** Bir href'in karşılığı page.tsx var mı — route group'ları ve dinamik
 * segmentleri (`[slug]`) tanır. */
export function pageExists(href: string): boolean {
  const segments = href.split('/').filter(Boolean);
  return ROUTE_GROUPS.some((group) => {
    const base = group ? path.join(APP_DIR, group) : APP_DIR;
    return findPage(base, segments);
  });
}

const menuHrefs = [...new Set([...NAV_ITEMS, ...FOOTER_LINKS].map((i) => i.href))];

describe('menü rotaları', () => {
  it.each(menuHrefs)('%s sayfası mevcut', (href) => {
    expect(pageExists(href)).toBe(true);
  });
});

describe('sitemap rotaları', () => {
  const paths = sitemap().map((e) => e.url.replace(SITE.url, '') || '/');

  it.each(paths)('%s sayfası mevcut', (routePath) => {
    expect(pageExists(routePath)).toBe(true);
  });

  it('landing page rotalarını listelemez', () => {
    expect(paths.some((p) => p.startsWith('/lp/'))).toBe(false);
  });
});

describe('eski admin', () => {
  it('/admin panele yönlendirilir', async () => {
    const redirects = await nextConfig.redirects!();
    const admin = redirects.find((r) => r.source === '/admin/:path*');
    expect(admin?.destination).toMatch(/^https:\/\/panel\./);
    expect(admin?.permanent).toBe(false);
  });
});
