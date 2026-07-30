import sharp from 'sharp';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const PUBLIC_DIR = path.resolve('public');
const MAX_WIDTH = 1600;
const QUALITY = 82;

const files = await readdir(PUBLIC_DIR);
const images = files.filter((file) => /\.(jpe?g|png)$/i.test(file) && file !== 'logo.png');

for (const file of images) {
  const source = path.join(PUBLIC_DIR, file);
  const target = source.replace(/\.(jpe?g|png)$/i, '.webp');
  const before = (await stat(source)).size;

  await sharp(source)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(target);

  const after = (await stat(target)).size;
  const saved = Math.round((1 - after / before) * 100);
  console.log(`${file} → ${path.basename(target)}  ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB  (-${saved}%)`);
}
