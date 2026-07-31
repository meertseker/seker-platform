import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { FAQ_ITEMS, PUBLISHED_FAQ, FEATURED_FAQ } from '../faq';
import { ROSTER_STATUS, ENGLISH_COVERAGE_READY } from '../day';
import { buildFaqSchema } from '@/lib/schema';
import FAQSection from '@/app/components/FAQSection';

/**
 * Fix round 1/5, Critical 1 — 'sinif-mevcudu' ve 'ingilizce' FAQ maddeleri
 * `ready: true` ile doğrulanmamış rakam/iddia (doğrulama kuyruğu #1, #2, #3;
 * asset dosyası §5.2'nin yasakladığı "native"/mezuniyet iddiası) taşıyordu ve
 * bu, FAQPage JSON-LD şemasına (Google'ın taradığı yapılandırılmış veri)
 * sızıyordu. Bu dosya hem kaynak veriyi hem render/şema çıktısını tarar.
 */

describe('FAQ — künye ve İngilizce iddiaları kapı disiplinine uyar', () => {
  it('ROSTER_STATUS henüz hazır değil (doğrulama kuyruğu #1, #2)', () => {
    expect(ROSTER_STATUS.ready).toBe(false);
  });

  it("'sinif-mevcudu' maddesinin ready durumu ROSTER_STATUS.ready ile eşleşir — ikinci bir kapı icat edilmedi", () => {
    const item = FAQ_ITEMS.find((i) => i.id === 'sinif-mevcudu');
    expect(item).toBeDefined();
    expect(item!.ready).toBe(ROSTER_STATUS.ready);
  });

  it("ROSTER_STATUS kapalıyken 'sinif-mevcudu' PUBLISHED_FAQ/FEATURED_FAQ içinde yer almaz", () => {
    expect(PUBLISHED_FAQ.find((i) => i.id === 'sinif-mevcudu')).toBeUndefined();
    expect(FEATURED_FAQ.find((i) => i.id === 'sinif-mevcudu')).toBeUndefined();
  });

  it('yayınlanan hiçbir FAQ maddesi doğrulanmamış sınıf/öğretmen rakamını iddia olarak içermez', () => {
    for (const item of PUBLISHED_FAQ) {
      expect(item.answer).not.toMatch(/\b10\s+çocuk\b/i);
      expect(item.answer).not.toMatch(/\böğretmen başına (beş|5)\b/i);
    }
  });

  it('yayınlanan hiçbir FAQ maddesi "native" veya desteklenemeyen mezuniyet iddiası içermez (asset dosyası §5.2)', () => {
    for (const item of PUBLISHED_FAQ) {
      const lower = item.answer.toLowerCase();
      expect(lower).not.toContain('native');
      expect(lower).not.toContain('mezun olduğunda ingilizce konuşuyor');
      expect(lower).not.toContain('mezun olan çocuklarımız ingilizce konuşuyor');
    }
  });

  it('ENGLISH_COVERAGE_READY kapalıyken İngilizce maddesi öğretmenin günlük kapsamını iddia etmez', () => {
    expect(ENGLISH_COVERAGE_READY).toBe(false);
    const item = PUBLISHED_FAQ.find((i) => i.id === 'ingilizce');
    expect(item).toBeDefined();
    expect(item!.answer.toLowerCase()).not.toMatch(/gün boyunca kullan/);
  });

  it('FAQPage JSON-LD şemasına doğrulanmamış rakam/native iddiası sızmaz', () => {
    const json = JSON.stringify(buildFaqSchema(PUBLISHED_FAQ)).toLowerCase();
    expect(json).not.toMatch(/\b10\s+çocuk\b/);
    expect(json).not.toContain('native');
    expect(json).not.toContain('mezun olduğunda ingilizce konuşuyor');
  });

  it('FAQSection render çıktısı (görünür metin + gömülü JSON-LD script) aynı iddiaları içermez', () => {
    const { container } = render(<FAQSection />);
    const html = container.innerHTML.toLowerCase();
    expect(html).not.toMatch(/\b10\s+çocuk\b/);
    expect(html).not.toContain('native');
    expect(html).not.toContain('mezun olduğunda ingilizce konuşuyor');
  });
});
