import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const SRC = path.resolve('public/new');
const OUT = path.resolve('public');

/**
 * Okul sahibinin gönderdiği dosyalar → sitede kullanılacak adlar.
 * Genişlik, fotoğrafın sayfadaki en büyük görünme boyutuna göre seçilir:
 * yatay bahçe karesi hero'da tam genişlik kaplar, dikeyler en fazla
 * yarım sütun. Reklam trafiği mobilden geldiği için ağırlık önemli.
 */
const FILES = [
  ['a18c647d-6dd7-49fa-b030-32e79a92081a.jpeg', 'bahce-genis', 1600],
  ['cd45a305-324d-496d-8579-a253ec5b9d94.jpeg', 'bahce-atolyeler', 1100],
  ['61314810-e3aa-4139-a69c-c4c82729828b.jpeg', 'mutfak-atolyesi', 1100],
  ['1aea0e73-c781-4683-88b1-26e9fb791680.jpeg', 'acik-hava-sinifi', 1100],
  ['042601d6-d809-450a-9089-2a577eb4f19f.jpeg', 'seker-kosesi', 1100],
  ['bbb206e6-cc90-4632-91ba-ebe7c933a0ab.jpeg', 'zurafalar', 1100],
  ['982223a5-76b6-4cc2-9f3e-94502494d48d.jpeg', 'zurafalar-bahce', 1100],
];

await mkdir(OUT, { recursive: true });

for (const [source, name, maxWidth] of FILES) {
  const input = path.join(SRC, source);
  const output = path.join(OUT, `${name}.webp`);

  const info = await sharp(input)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: 70, effort: 6 })
    .toFile(output);

  console.log(`${name}.webp  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} KB`);
}
