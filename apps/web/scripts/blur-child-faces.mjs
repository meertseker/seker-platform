import sharp from 'sharp';
import { unlink } from 'node:fs/promises';
import path from 'node:path';

const PUBLIC = path.resolve('public');
const ORIGINALS = path.resolve('photos/originals');
const DEBUG = process.argv.includes('--debug');
const PREVIEW = process.argv.includes('--preview');
const WIDTH = 1100;

/**
 * Compact eye ovals. cx/cy/rx/ry are fractions of the published image.
 * Keep them small so the rest of the face and the scene stay readable.
 */
const JOBS = [
  {
    file: 'acik-hava-sinifi.webp',
    original: '1aea0e73-c781-4683-88b1-26e9fb791680.jpeg',
    faces: [
      // oltadaki çocuk — bakış sağ-aşağı; önceki oval sol yanağa kaymıştı
      { cx: 0.372, cy: 0.333, rx: 0.048, ry: 0.024 },
    ],
  },
  {
    file: 'seker-kosesi.webp',
    original: '042601d6-d809-450a-9089-2a577eb4f19f.jpeg',
    faces: [
      { cx: 0.336, cy: 0.682, rx: 0.028, ry: 0.018 }, // oturan kız
      { cx: 0.471, cy: 0.564, rx: 0.028, ry: 0.018 }, // ayaktaki kız
      { cx: 0.642, cy: 0.656, rx: 0.036, ry: 0.020 }, // oturan erkek
      { cx: 0.756, cy: 0.521, rx: 0.030, ry: 0.018 }, // ayaktaki erkek
    ],
  },
  {
    file: 'zurafalar.webp',
    original: 'bbb206e6-cc90-4632-91ba-ebe7c933a0ab.jpeg',
    faces: [
      { cx: 0.234, cy: 0.604, rx: 0.026, ry: 0.016 }, // soldaki erkek
      { cx: 0.367, cy: 0.654, rx: 0.040, ry: 0.022 }, // öndeki kız
      { cx: 0.572, cy: 0.568, rx: 0.026, ry: 0.016 }, // arkadaki kız
      { cx: 0.784, cy: 0.607, rx: 0.030, ry: 0.018 }, // sağdaki erkek
    ],
  },
  {
    file: 'zurafalar-bahce.webp',
    original: '982223a5-76b6-4cc2-9f3e-94502494d48d.jpeg',
    faces: [
      { cx: 0.323, cy: 0.626, rx: 0.028, ry: 0.018 }, // soldaki erkek
      { cx: 0.517, cy: 0.684, rx: 0.028, ry: 0.018 }, // öndeki kız
      { cx: 0.491, cy: 0.674, rx: 0.022, ry: 0.016 }, // arkadaki kız (topuz altı)
      { cx: 0.780, cy: 0.601, rx: 0.026, ry: 0.016 }, // sağdaki erkek
    ],
  },
];

function pixels(face, width, height) {
  return {
    cx: Math.round(face.cx * width),
    cy: Math.round(face.cy * height),
    rx: Math.max(8, Math.round(face.rx * width)),
    ry: Math.max(6, Math.round(face.ry * height)),
  };
}

function ellipseBuffer({ width, height, cx, cy, rx, ry, mode }) {
  const data = Buffer.alloc(width * height * 4);
  const inner = 0.62;
  const outer = 1.12;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const d = Math.sqrt(nx * nx + ny * ny);
      const i = (y * width + x) * 4;
      let alpha = 0;

      if (mode === 'ring') {
        if (d > 0.82 && d < 1.08) alpha = 230;
      } else if (d <= inner) {
        alpha = 255;
      } else if (d < outer) {
        alpha = Math.round(255 * (1 - (d - inner) / (outer - inner)));
      }

      if (mode === 'ring') {
        data[i] = 255;
        data[i + 1] = 45;
        data[i + 2] = 85;
      } else {
        data[i] = data[i + 1] = data[i + 2] = 255;
      }
      data[i + 3] = alpha;
    }
  }

  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function blurFace(source, width, height, face) {
  const { cx, cy, rx, ry } = pixels(face, width, height);
  const pad = 2.6;
  const left = Math.max(0, Math.round(cx - rx * pad));
  const top = Math.max(0, Math.round(cy - ry * pad));
  const extractW = Math.min(width - left, Math.round(rx * pad * 2));
  const extractH = Math.min(height - top, Math.round(ry * pad * 2));
  const sigma = Math.max(16, Math.round(Math.min(rx, ry) * 1.15));

  const blurred = await sharp(source)
    .extract({ left, top, width: extractW, height: extractH })
    .blur(sigma)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = blurred;
  const localCx = cx - left;
  const localCy = cy - top;
  const inner = 0.72;
  const outer = 1.22;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const nx = (x - localCx) / rx;
      const ny = (y - localCy) / ry;
      const d = Math.sqrt(nx * nx + ny * ny);
      const i = (y * info.width + x) * info.channels;
      let alpha = 0;
      if (d <= inner) alpha = 255;
      else if (d < outer) alpha = Math.round(255 * (1 - (d - inner) / (outer - inner)));
      data[i + 3] = alpha;
    }
  }

  const masked = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();

  return { input: masked, left, top, extractW, extractH, sigma };
}

for (const job of JOBS) {
  const resized = await sharp(path.join(ORIGINALS, job.original))
    .rotate()
    .resize({ width: WIDTH, withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();

  const meta = await sharp(resized).metadata();
  const width = meta.width;
  const height = meta.height;
  const workPath = path.join(PUBLIC, `_work-${job.file}`);
  await sharp(resized).toFile(workPath);

  try {
    if (DEBUG) {
      const marks = [];
      for (const face of job.faces) {
        const { cx, cy, rx, ry } = pixels(face, width, height);
        marks.push({
          input: await ellipseBuffer({
            width,
            height,
            cx,
            cy,
            rx,
            ry,
            mode: 'ring',
          }),
          left: 0,
          top: 0,
        });
      }

      const preview = path.join(PUBLIC, `_debug-${job.file.replace('.webp', '.jpg')}`);
      await sharp(workPath).composite(marks).jpeg({ quality: 82 }).toFile(preview);
      console.log(`debug ${path.basename(preview)}`);
      continue;
    }

    let current = await sharp(workPath).png().toBuffer();
    for (const [index, face] of job.faces.entries()) {
      const layer = await blurFace(current, width, height, face);
      current = await sharp(current).composite([layer]).png().toBuffer();
      console.log(
        `  ${job.file} #${index + 1}  ${layer.extractW}x${layer.extractH} σ${layer.sigma}`,
      );
    }

    const output = path.join(PUBLIC, job.file);
    const info = await sharp(current).webp({ quality: 70, effort: 6 }).toFile(output);

    if (PREVIEW) {
      await sharp(output)
        .resize({ width: 800 })
        .jpeg({ quality: 80 })
        .toFile(path.join(PUBLIC, `_blurred-${job.file.replace('.webp', '.jpg')}`));
    }

    console.log(
      `${job.file}  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} KB  ${job.faces.length} yüz`,
    );
  } finally {
    await unlink(workPath).catch(() => {});
  }
}
