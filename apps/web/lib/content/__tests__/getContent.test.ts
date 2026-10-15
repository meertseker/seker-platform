import { describe, it, expect, vi, beforeEach } from 'vitest';

const { cacheLife, select } = vi.hoisted(() => ({ cacheLife: vi.fn(), select: vi.fn() }));
vi.mock('next/cache', () => ({ cacheLife, cacheTag: vi.fn() }));
vi.mock('next/headers', () => ({ draftMode: async () => ({ isEnabled: false }) }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/public', () => ({
  createPublicSupabase: () => ({ from: () => ({ select }) }),
}));

import { getContent, read } from '../getContent';

beforeEach(() => {
  cacheLife.mockClear();
  select.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('getContent', () => {
  it('satırları haritaya çevirir ve max önbellekler', async () => {
    select.mockResolvedValue({
      data: [{ key: 'home.hero.title', value: 'Yeni', updated_at: '2026-10-14 10:00:00.123456+00' }],
      error: null,
    });
    const map = await getContent();
    expect(map).toEqual({ 'home.hero.title': { value: 'Yeni', updatedAt: '2026-10-14 10:00:00.123456+00' } });
    expect(cacheLife).toHaveBeenCalledWith('max');
  });

  it('Supabase hata verirse boş harita döner ve yalnızca dakikalar önbellekler', async () => {
    select.mockResolvedValue({ data: null, error: { message: 'down' } });
    const map = await getContent();
    expect(map).toEqual({});
    expect(cacheLife).toHaveBeenCalledWith('minutes');
  });

  it('istek fırlatırsa da boş harita', async () => {
    select.mockRejectedValue(new Error('timeout'));
    expect(await getContent()).toEqual({});
  });
});

describe('read', () => {
  it('satır yoksa registry varsayılanı', () => {
    expect(read<string>({}, 'site.phone')).toBe('0530 101 88 75');
  });
});
