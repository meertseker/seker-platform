import { describe, it, expect, vi } from 'vitest';

vi.mock('next/cache', () => ({ cacheLife: vi.fn() }));

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import sitemap from '../sitemap';
import robots from '../robots';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('düzenleme katmanı SEO ve paket sınırları', () => {
  it('sitemap düzenleme uçlarını içermez ve 17 URL üretir', async () => {
    const urls = (await sitemap()).map((u) => u.url);
    expect(urls.some((u) => u.includes('/api/'))).toBe(false);
    expect(urls).toHaveLength(17); // Güvenlik ve Bültenler sayfaları kalktı
  });
  it('robots /api/ taramasını kapatır', () => {
    expect((robots().rules as { disallow: string[] }).disallow).toContain('/api/');
  });
  it('ziyaretçi bileşenleri Tiptap veya EditBar import etmez', () => {
    const files = walk(path.join(process.cwd(), 'app')).filter(
      (f) => /\.(tsx?|mts)$/.test(f) && !f.includes(`${path.sep}edit${path.sep}`) && !f.includes('__tests__'),
    );
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/@tiptap|components\/edit\/EditBar/);
    }
  });
  it('istemci bileşenleri registry import etmez (paket şişmesin)', () => {
    const files = walk(path.join(process.cwd(), 'app')).filter((f) => /\.tsx$/.test(f) && !f.includes('__tests__'));
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      if (/^['"]use client['"]/.test(src.trimStart())) expect(src, f).not.toMatch(/lib\/content\/(registry|server|getContent)/);
    }
  });
});
