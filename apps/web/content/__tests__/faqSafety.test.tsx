import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { FAQ_ITEMS, PUBLISHED_FAQ, FEATURED_FAQ } from '../faq';
import { ROSTER_STATUS, ENGLISH_COVERAGE_READY, ENGLISH_HOURS_PER_DAY } from '../day';
import { buildFaqSchema } from '@/lib/schema';
import FAQSection from '@/app/components/FAQSection';

/**
 * Künye (sınıf mevcudu / öğretmen sayısı) ve İngilizce kapsamı 1 Ağustos 2026'da
 * okul yönetimi tarafından doğrulandı; kapılar açıldı. Bu dosya artık iki şeyi
 * korur:
 *   1. Yayınlanan metinlerdeki rakamlar TEK kaynaktan (content/day.ts) gelir —
 *      hiçbir yerde elle yazılmış, kaynakla çelişen bir sayı bulunmaz.
 *   2. Doğrulanmış olsa bile aşırı iddialar (akıcı/fluent, iki dilli, "en iyi",
 *      ücret rakamı) metinlere sızmaz.
 */

describe('FAQ — rakamlar tek kaynaktan gelir', () => {
  it('künye doğrulandı ve sayılar okulun verdiği değerlerdir', () => {
    expect(ROSTER_STATUS.ready).toBe(true);
    expect(ROSTER_STATUS.childCount).toBe(13);
    expect(ROSTER_STATUS.teacherCount).toBe(2);
  });

  it('İngilizce kapsamı doğrulandı: günde iki saat', () => {
    expect(ENGLISH_COVERAGE_READY).toBe(true);
    expect(ENGLISH_HOURS_PER_DAY).toBe(2);
  });

  it("'sinif-mevcudu' maddesinin ready durumu ROSTER_STATUS.ready ile eşleşir — ikinci bir kapı icat edilmedi", () => {
    const item = FAQ_ITEMS.find((i) => i.id === 'sinif-mevcudu');
    expect(item).toBeDefined();
    expect(item!.ready).toBe(ROSTER_STATUS.ready);
  });

  it('künye açıkken sınıf mevcudu maddesi yayında ve öne çıkanlarda yer alır', () => {
    expect(PUBLISHED_FAQ.find((i) => i.id === 'sinif-mevcudu')).toBeDefined();
    expect(FEATURED_FAQ.find((i) => i.id === 'sinif-mevcudu')).toBeDefined();
  });

  it('yayınlanan hiçbir FAQ maddesi kaynakla çelişen bir sınıf mevcudu yazmaz', () => {
    const stale = [/\b10\s+çocuk\b/i, /\böğretmen başına (beş|5)\b/i];
    for (const item of PUBLISHED_FAQ) {
      for (const pattern of stale) expect(item.answer).not.toMatch(pattern);
    }
  });
});

describe('FAQ — doğrulanmış olsa da aşırı iddia yok', () => {
  const FORBIDDEN = [
    'akıcı ingilizce',
    'iki dilli',
    'bilingual',
    'ana dili gibi',
    'en iyi anaokulu',
    'garanti',
  ];

  it('yayınlanan cevaplarda yasaklı iddia kalıpları geçmez', () => {
    for (const item of PUBLISHED_FAQ) {
      const lower = item.answer.toLocaleLowerCase('tr');
      for (const phrase of FORBIDDEN) expect(lower).not.toContain(phrase);
    }
  });

  it('hiçbir cevapta somut ücret rakamı yer almaz — ücret yalnızca görüşmede konuşulur', () => {
    for (const item of PUBLISHED_FAQ) {
      expect(item.answer).not.toMatch(/\d[\d.]*\s*(tl|₺|lira)/i);
    }
  });

  it('FAQPage JSON-LD şemasına eski/çelişkili rakam sızmaz', () => {
    const json = JSON.stringify(buildFaqSchema(PUBLISHED_FAQ)).toLocaleLowerCase('tr');
    expect(json).not.toMatch(/\b10\s+çocuk\b/);
    expect(json).not.toContain('akıcı ingilizce');
  });

  it('FAQSection render çıktısı doğru mevcudu gösterir ve eski rakamı içermez', () => {
    const { container } = render(<FAQSection />);
    const html = container.innerHTML.toLocaleLowerCase('tr');
    expect(html).toContain(`${ROSTER_STATUS.childCount} çocuk`);
    expect(html).not.toMatch(/\b10\s+çocuk\b/);
    expect(html).not.toContain('akıcı ingilizce');
  });
});
