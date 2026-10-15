import 'server-only';
import sharp from 'sharp';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Yönü uygular, 2400 px içine sığdırır, WebP yapar. sharp varsayılan olarak EXIF/GPS dahil tüm metadata'yı atar. */
export async function processImage(input: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  const format = (await sharp(input, { limitInputPixels: 40_000_000 }).metadata()).format;
  if (format !== 'jpeg' && format !== 'png' && format !== 'webp') throw new Error('unsupported-format');
  const { data, info } = await sharp(input, { failOn: 'error', limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
