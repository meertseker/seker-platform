import { describe, it, expect, vi } from 'vitest';

vi.mock('next/headers', () => ({ draftMode: async () => ({ isEnabled: false }) }));
vi.mock('@/lib/supabase/public', () => ({ createPublicSupabase: () => ({}) }));

import { buildReaderData } from '../server';

describe('buildReaderData', () => {
  it('vars kuruluş yılından türetilir; DB satırı varsayılanı ezer', () => {
    const d = buildReaderData({ 'site.foundingYear': { value: '2010', updatedAt: 't1' } }, false, 2026);
    expect(d.vars).toEqual({ yilSayisi: '16', kurulusYili: '2010' });
    expect(d.updatedAt['site.foundingYear']).toBe('t1');
    expect(d.values['site.phone']).toBe('0530 101 88 75');
    expect(d.meta['site.phone'].pattern).toBeTypeOf('string');
  });
  it('meta serileştirilebilir alanları taşır (fixedItems/newItem/allowHeadings anahtarları dahil)', () => {
    const d = buildReaderData({}, true, 2026);
    expect(d.editing).toBe(true);
    for (const m of Object.values(d.meta)) {
      expect(Object.keys(m)).toEqual(
        expect.arrayContaining(['kind', 'label', 'fixedItems', 'newItem', 'allowHeadings']),
      );
    }
  });
});
