import { describe, it, expect } from 'vitest';
import {
  CODE_LP_SLUGS,
  RESERVED_LP_SLUGS,
  LP_SLUG_RE,
  ARCHIVE_REDIRECT_PATH,
  AD_PRIMARY_TEXT_MAX,
  AD_HEADLINE_MAX,
  LP_MEDIA_OPTIONS,
  isLpMediaKey,
  pageFieldsToLandingFields,
  parseLandingFields,
  slugify,
  suggestSlug,
  slugError,
} from '../src/landing';

const RULE = 'Adres 3–60 karakter olmalı; yalnız küçük harf, rakam ve tire';
const TAKEN = 'Bu adres sitede zaten var';

describe('sabitler', () => {
  it('kod slugları ve ayrılmışlar', () => {
    expect(CODE_LP_SLUGS).toEqual([
      'beykent-anaokulu',
      'beylikduzu-anaokulu',
      'az-mevcutlu-anaokulu',
      'kres-2-yas',
      'anaokulu-ucret',
    ]);
    expect([...RESERVED_LP_SLUGS].sort()).toEqual([...CODE_LP_SLUGS, 'onizleme'].sort());
    expect(LP_SLUG_RE.test('ilk-hafta')).toBe(true);
    expect(ARCHIVE_REDIRECT_PATH).toBe('/lp/az-mevcutlu-anaokulu');
    expect(AD_PRIMARY_TEXT_MAX).toBe(125);
    expect(AD_HEADLINE_MAX).toBe(40);
  });

  it('görsel listesi üç seçenek', () => {
    expect(LP_MEDIA_OPTIONS).toEqual([
      { key: 'gardenWide', label: 'Bahçe, geniş açı', src: '/bahce-genis.webp' },
      { key: 'gardenWorkshops', label: 'Bahçe atölyeleri', src: '/bahce-atolyeler.webp' },
      { key: 'mudKitchen', label: 'Mutfak atölyesi', src: '/mutfak-atolyesi.webp' },
    ]);
    expect(isLpMediaKey('mudKitchen')).toBe(true);
    expect(isLpMediaKey('giraffesGarden')).toBe(false);
    expect(isLpMediaKey(3)).toBe(false);
  });
});

describe('slugify', () => {
  it('Türkçe karakterleri çevirir, 5 kelimeyle sınırlar', () => {
    expect(slugify('İlk hafta ağlarsa ne olur? Uyum programımız')).toBe('ilk-hafta-aglarsa-ne-olur');
    expect(slugify('ÇOCUĞUNUZ İÇİN Güvenli Bahçe')).toBe('cocugunuz-icin-guvenli-bahce');
  });

  it('40 karakteri kelime sınırında keser', () => {
    const s = slugify('kelimekelime kelimekelime kelimekelime kelimekelime');
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s).toBe('kelimekelime-kelimekelime-kelimekelime');
  });
});

describe('suggestSlug', () => {
  it('ayrılmış slug için -2 ekler', () => {
    expect(suggestSlug('Az mevcutlu anaokulu', 'S-2644-I', new Set())).toBe('az-mevcutlu-anaokulu-2');
  });
  it('kısa başlıkta koddan üretir', () => {
    expect(suggestSlug('?!', 'S-2644-I', new Set())).toBe('sayfa-s-2644-i');
  });
  it('alınmışsa -2, -3 ekler', () => {
    expect(suggestSlug('İlk hafta uyum', 'S-2644-I', new Set(['ilk-hafta-uyum']))).toBe('ilk-hafta-uyum-2');
    expect(
      suggestSlug('İlk hafta uyum', 'S-2644-I', new Set(['ilk-hafta-uyum', 'ilk-hafta-uyum-2'])),
    ).toBe('ilk-hafta-uyum-3');
  });
});

describe('slugError', () => {
  it('kurala uymayanlar', () => {
    expect(slugError('ab')).toBe(RULE);
    expect(slugError('Ilk-Hafta')).toBe(RULE);
    expect(slugError('a'.repeat(61))).toBe(RULE);
  });
  it('ayrılmışlar', () => {
    expect(slugError('onizleme')).toBe(TAKEN);
    expect(slugError('kres-2-yas')).toBe(TAKEN);
  });
  it('geçerli', () => {
    expect(slugError('ilk-hafta-uyum')).toBeNull();
  });
});

describe('pageFieldsToLandingFields', () => {
  it('alanları eşler', () => {
    const f = pageFieldsToLandingFields({
      baslik: ' Başlık ',
      alt_baslik: 'Alt',
      blok1_baslik: 'B1',
      blok1_metin: 'M1',
      blok2_baslik: '',
      blok2_metin: '',
      blok3_metin: 'M3',
      mediaKey: 'mudKitchen',
      adPrimaryText: 'Cümle',
      adHeadline: 'Baş',
    });
    expect(f).toEqual({
      h1: 'Başlık',
      subhead: 'Alt',
      bodyBlocks: [
        { heading: 'B1', text: 'M1' },
        { heading: '', text: 'M3' },
      ],
      mediaKey: 'mudKitchen',
      adPrimaryText: 'Cümle',
      adHeadline: 'Baş',
      metaTitle: 'Başlık',
      metaDescription: 'Alt',
    });
  });

  it('çocuk yüzlü görsel null olur, metin olmayan değer boş sayılır', () => {
    const f = pageFieldsToLandingFields({ baslik: 5, mediaKey: 'giraffesGarden' });
    expect(f.mediaKey).toBeNull();
    expect(f.h1).toBe('');
    expect(f.bodyBlocks).toEqual([]);
  });

  it('metaDescription 160 karakteri kelime sınırında keser', () => {
    const words = Array.from({ length: 40 }, (_, i) => `kelime${i}`);
    const alt = words.join(' ').slice(0, 200);
    expect(alt.length).toBe(200);
    const f = pageFieldsToLandingFields({ alt_baslik: alt });
    expect(f.metaDescription.length).toBeLessThanOrEqual(160);
    expect(f.metaDescription.length).toBeGreaterThan(100);
    expect(f.metaDescription.endsWith(' ')).toBe(false);
    expect(words).toContain(f.metaDescription.split(' ').at(-1));
    expect(alt.startsWith(f.metaDescription)).toBe(true);
  });
  it("kesme 's' ile biten kelimeden sonra düşerse kelime bozulmaz", () => {
    // 'ders ' x 40: 160. karakter bir boşluktan hemen önce, son kelime 'ders'.
    const alt = Array.from({ length: 40 }, () => 'ders').join(' ');
    const f = pageFieldsToLandingFields({ alt_baslik: alt });
    expect(f.metaDescription.length).toBeLessThanOrEqual(160);
    expect(f.metaDescription.endsWith('ders')).toBe(true);
    expect(f.metaDescription).toBe(f.metaDescription.trimEnd());
    expect(f.metaDescription.split(' ').every((w) => w === 'ders')).toBe(true);
  });
});

describe('parseLandingFields', () => {
  it('null için boş alanlar', () => {
    expect(parseLandingFields(null)).toEqual({
      h1: '',
      subhead: '',
      bodyBlocks: [],
      mediaKey: null,
      adPrimaryText: '',
      adHeadline: '',
      metaTitle: '',
      metaDescription: '',
    });
  });
  it('bozuk liste boş dizi', () => {
    expect(parseLandingFields({ bodyBlocks: 'x' }).bodyBlocks).toEqual([]);
  });
  it('geçerli değerleri okur, bozuk öğeleri atlar', () => {
    const f = parseLandingFields({
      h1: 'H',
      bodyBlocks: [{ heading: 'a', text: 'b' }, 'x', null, { heading: 3 }],
      mediaKey: 'gardenWide',
      metaTitle: 'T',
    });
    expect(f.h1).toBe('H');
    expect(f.bodyBlocks).toEqual([{ heading: 'a', text: 'b' }]);
    expect(f.mediaKey).toBe('gardenWide');
    expect(parseLandingFields({ mediaKey: 'yok' }).mediaKey).toBeNull();
  });
});
