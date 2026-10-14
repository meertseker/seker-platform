import { describe, it, expect } from 'vitest';
import { FAQ_ITEMS, PUBLISHED_FAQ, FEATURED_FAQ } from '../faq';
import { buildFaqSchema } from '@/lib/schema';

describe('FAQ yayın güvenliği', () => {
  it('yayınlanan hiçbir soru veya cevap TODO metni içermez', () => {
    for (const item of PUBLISHED_FAQ) {
      expect(item.answer).not.toMatch(/TODO/i);
      expect(item.question).not.toMatch(/TODO/i);
    }
  });

  it('öne çıkan sorular yayınlananların alt kümesidir', () => {
    for (const item of FEATURED_FAQ) expect(PUBLISHED_FAQ).toContain(item);
  });

  it('schema çıktısına TODO metni sızmaz', () => {
    expect(JSON.stringify(buildFaqSchema(PUBLISHED_FAQ))).not.toMatch(/TODO/i);
  });

  it('hazır olmayan maddeler FAQ_ITEMS içinde korunur', () => {
    expect(FAQ_ITEMS.length).toBeGreaterThan(PUBLISHED_FAQ.length);
  });
});
