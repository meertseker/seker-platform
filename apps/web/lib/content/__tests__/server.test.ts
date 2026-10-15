import { describe, it, expect, vi } from 'vitest';

vi.mock('next/headers', () => ({ draftMode: async () => ({ isEnabled: false }) }));
vi.mock('@/lib/supabase/public', () => ({ createPublicSupabase: () => ({}) }));
// Test-local liste slotu: kayıtta hiçbir liste zengin metin alanı taşımadığı için fixture gerekir.
vi.mock('../registry', async (importOriginal) => {
  const m = await importOriginal<typeof import('../registry')>();
  return {
    ...m,
    SLOTS: {
      ...m.SLOTS,
      'test.items': {
        kind: 'list',
        label: 'Test listesi',
        default: [],
        fields: {
          q: { kind: 'text', label: 'Soru' },
          a: { kind: 'rich', label: 'Cevap' },
        },
      },
    },
  };
});

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
  it('liste öğelerindeki zengin metin alanları temizlenir, izinli etiketler kalır', () => {
    const d = buildReaderData(
      {
        'test.items': {
          value: [
            {
              id: 'a',
              q: 'Soru',
              a: '<p>İyi<script>alert(1)</script><img src=x onerror=alert(2)> <b>kalın</b> <a href="javascript:x">l</a></p>',
            },
          ],
          updatedAt: 't1',
        },
      },
      false,
      2026,
    );
    const item = (d.values['test.items'] as { id: string; q: string; a: string }[])[0];
    expect(item.q).toBe('Soru');
    expect(item.a).not.toContain('<script');
    expect(item.a).not.toContain('alert');
    expect(item.a).not.toContain('<img');
    expect(item.a).not.toContain('onerror');
    expect(item.a).not.toContain('javascript:');
    expect(item.a).toContain('<b>kalın</b>');
    expect(item.a).toContain('<p>');
  });
});
