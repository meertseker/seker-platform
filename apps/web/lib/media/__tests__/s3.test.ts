import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = send;
  },
  PutObjectCommand: class {
    constructor(public input: unknown) {}
  },
  DeleteObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));

import { putImage, deleteImage, mediaKey } from '../s3';

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue({});
  process.env.S3_BUCKET = 'test-bucket';
  process.env.S3_REGION = 'eu-central-1';
});

describe('putImage', () => {
  it('PutObjectCommand girdisi doğru', async () => {
    const key = mediaKey(new Date('2026-10-14T10:00:00Z'), '11111111-1111-4111-8111-111111111111');
    const body = Buffer.from('x');
    await putImage(key, body);
    expect(send).toHaveBeenCalledOnce();
    const input = (send.mock.calls[0][0] as { input: Record<string, unknown> }).input;
    expect(input.Bucket).toBe('test-bucket');
    expect(input.Key).toMatch(/^site-images\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.webp$/);
    expect(input.Key).toBe(key);
    expect(input.Body).toBe(body);
    expect(input.ContentType).toBe('image/webp');
    expect(input.CacheControl).toBe('public, max-age=31536000, immutable');
  });
  it('S3 hatasını yukarı iletir', async () => {
    send.mockRejectedValue(new Error('boom'));
    await expect(putImage('site-images/2026/10/a.webp', Buffer.from('x'))).rejects.toThrow('boom');
  });
});

describe('deleteImage', () => {
  it('DeleteObjectCommand girdisi doğru', async () => {
    await deleteImage('site-images/2026/10/a.webp');
    const input = (send.mock.calls[0][0] as { input: Record<string, unknown> }).input;
    expect(input).toEqual({ Bucket: 'test-bucket', Key: 'site-images/2026/10/a.webp' });
  });
});
