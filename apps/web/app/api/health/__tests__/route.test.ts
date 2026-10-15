import { describe, expect, it, vi } from 'vitest';

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  connection: async () => {},
}));

import { GET } from '../route';

describe('GET /api/health', () => {
  it('veritabanına dokunmadan ok döner', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
