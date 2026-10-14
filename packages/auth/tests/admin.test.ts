import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

describe('createAdminSupabase', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('gizli anahtar yoksa açık hata verir', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_SECRET_KEY', '');
    const { createAdminSupabase } = await import('../src/admin');
    expect(() => createAdminSupabase()).toThrow('Eksik ortam değişkeni: SUPABASE_SECRET_KEY');
  });

  it('URL ve gizli anahtarla istemci döner', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test');
    const { createAdminSupabase } = await import('../src/admin');
    expect(typeof createAdminSupabase().from).toBe('function');
  });
});
