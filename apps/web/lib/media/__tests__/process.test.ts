import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { processImage } from '../process';
import { mediaKey } from '../s3';

async function jpegWithExif(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: '#a0f' } })
    .jpeg()
    .withExif({ IFD0: { Copyright: 'test' }, GPS: { GPSLatitudeRef: 'N' } } as never)
    .withMetadata({ orientation: 6 })
    .toBuffer();
}

describe('processImage', () => {
  it('fixture gerçekten EXIF ve GPS taşıyor', async () => {
    const src = await jpegWithExif(400, 300);
    const meta = await sharp(src).metadata();
    expect(meta.exif).toBeDefined();
  });
  it('2400 px içine küçültür, WebP yapar, EXIF/GPS siler, yönü uygular', async () => {
    const out = await processImage(await jpegWithExif(4000, 3000));
    const meta = await sharp(out.data).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.exif).toBeUndefined();
    // orientation 6 → 90° döner: 3000x4000 → 1800x2400
    expect([out.width, out.height]).toEqual([1800, 2400]);
  });
  it('küçük görseli büyütmez', async () => {
    const out = await processImage(await sharp({ create: { width: 800, height: 600, channels: 3, background: '#fff' } }).png().toBuffer());
    expect([out.width, out.height]).toEqual([800, 600]);
  });
  it('görsel olmayan veriyi reddeder', async () => {
    await expect(processImage(Buffer.from('merhaba'))).rejects.toThrow();
  });
});

describe('mediaKey', () => {
  it('site-images/YYYY/MM/<id>.webp', () => {
    expect(mediaKey(new Date('2026-10-14T10:00:00Z'), 'abc')).toBe('site-images/2026/10/abc.webp');
  });
});
