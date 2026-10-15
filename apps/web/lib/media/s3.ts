import 'server-only';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

let client: S3Client | null = null;

export function mediaKey(now: Date, id: string): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `site-images/${y}/${m}/${id}.webp`;
}

export async function putImage(key: string, body: Buffer): Promise<void> {
  client ??= new S3Client({ region: process.env.S3_REGION });
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
}

export async function deleteImage(key: string): Promise<void> {
  client ??= new S3Client({ region: process.env.S3_REGION });
  await client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
}
