import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { MEDIA, pendingShootAssets } from '../media';

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

  it('sınıf geniş açı görseli tanımlı — hero ve LP zorunlu varlığı', () => {
    expect(MEDIA.classroomWide).toBeDefined();
  });

  it('pendingShootAssets yalnızca stok işaretlileri döndürür', () => {
    for (const key of pendingShootAssets()) {
      expect(MEDIA[key].status).toBe('stok');
    }
  });
});
