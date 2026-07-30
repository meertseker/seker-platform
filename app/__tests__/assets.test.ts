import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(full)) out.push(full);
  }
  return out;
}

/** Kaynak dosyalarda geçen tüm /xxx.(jpg|png|webp|svg|avif) yolları. */
function referencedAssets(): { file: string; asset: string }[] {
  const pattern = /["'`](\/[A-Za-z0-9_\-./]+\.(?:jpg|jpeg|png|webp|svg|avif))["'`]/g;
  const found: { file: string; asset: string }[] = [];
  for (const file of [
    ...walk(path.join(ROOT, 'app')),
    ...walk(path.join(ROOT, 'content')),
    ...walk(path.join(ROOT, 'lib')),
  ]) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(pattern)) {
      found.push({ file: path.relative(ROOT, file), asset: match[1] });
    }
  }
  return found;
}

describe('görsel referansları', () => {
  const refs = referencedAssets();

  it('en az bir görsel referansı bulunuyor (tarayıcı çalışıyor)', () => {
    expect(refs.length).toBeGreaterThan(0);
  });

  it.each(refs)('$file → $asset dosyası public/ içinde mevcut', ({ asset }) => {
    expect(existsSync(path.join(PUBLIC_DIR, asset))).toBe(true);
  });
});
