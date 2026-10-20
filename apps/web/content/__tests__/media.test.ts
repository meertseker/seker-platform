import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { MEDIA, pendingShootAssets, assetsWithChildFaces } from '../media';
import { BRANCHES } from '../program';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const entries = Object.entries(MEDIA);

describe('MEDIA kataloğu', () => {
  it.each(entries)('%s dosyası public/ içinde mevcut', (_key, asset) => {
    expect(existsSync(path.join(PUBLIC_DIR, asset.src))).toBe(true);
  });

  it.each(entries)('%s anlamlı alt metne sahip', (_key, asset) => {
    expect(asset.alt.length).toBeGreaterThan(10);
  });

  it.each(entries)('%s boyutları pozitif', (_key, asset) => {
    expect(asset.width).toBeGreaterThan(0);
    expect(asset.height).toBeGreaterThan(0);
  });

  it('bahçe geniş açı görseli tanımlı — hero, OG ve LP zorunlu varlığı', () => {
    expect(MEDIA.gardenWide).toBeDefined();
  });

  it('çocuk yüzü olan kareler işaretli ve dosyası duruyor', () => {
    expect(assetsWithChildFaces()).toEqual([
      'outdoorClass',
      'candyCorner',
      'giraffes',
      'giraffesGarden',
    ]);
  });

  it('pendingShootAssets yalnızca stok işaretlileri döndürür', () => {
    for (const key of pendingShootAssets()) {
      expect(MEDIA[key].status).toBe('stok');
    }
  });
});

/**
 * Sitede bir dönem filigranı silinmiş 16 lisanssız Shutterstock önizlemesi
 * yayındaydı (IMAGE-LICENSES.md her birinin Image ID'sini listeler).
 * Hepsi kaldırıldı. Bu blok geri gelmelerini engeller.
 */
describe('lisanssız stok görsel yasağı', () => {
  const STOCK_FILES = [
    'cocukklar', 'montesori', 'art', 'seramik', 'robotic', 'satranc',
    'yuzme', 'muzik', 'drama', 'dans', 'binincilik', 'psikolog',
    'motorskills', 'sportiffaaliyetler', 'beden', 'yazaktiviteleri',
  ];

  it('MEDIA kataloğunda stok işaretli görsel kalmadı', () => {
    expect(pendingShootAssets()).toEqual([]);
  });

  it('her MEDIA kaydı okulun kendi çekimi', () => {
    for (const [key, asset] of entries) {
      expect(asset.status, key).toBe('okul');
    }
  });

  it.each(STOCK_FILES)('public/%s.webp silinmiş durumda', (name) => {
    expect(existsSync(path.join(PUBLIC_DIR, `${name}.webp`))).toBe(false);
  });

  it('her branşın mediaKey değeri katalogda ve okul çekimi', () => {
    for (const branch of BRANCHES) {
      const asset = MEDIA[branch.mediaKey];
      expect(asset, branch.slug).toBeDefined();
      expect(asset.status, branch.slug).toBe('okul');
    }
  });

  it('kaynak kodda hiçbir stok dosyaya referans kalmadı', () => {
    const roots = ['app', 'content', 'lib'];
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        const source = readFileSync(full, 'utf8');
        for (const name of STOCK_FILES) {
          if (source.includes(`/${name}.webp`)) {
            offenders.push(`${path.relative(process.cwd(), full)} → /${name}.webp`);
          }
        }
      }
    };

    for (const root of roots) walk(path.join(process.cwd(), root));
    expect(offenders).toEqual([]);
    // Kaynak ağacını gezer; turbo'nun tam paralel koşusunda 5 sn varsayılanı yetmiyor.
  }, 30_000);
});
