import { describe, it, expect } from 'vitest';
import { SLOTS } from '../registry';
import { labelFor } from '../labels';

/**
 * Panelde görünen etiketler "Sayfa › Bölüm › Alan" kalıbında: Geçmiş'te ve "biri aynı anda
 * değiştirdi" uyarısında hangi sayfanın hangi bölümü olduğu okunur. Reklam sayfaları (lp.*) ayrı iş.
 */
describe('içerik alanı etiketleri', () => {
  const keys = Object.keys(SLOTS).filter((k) => !k.startsWith('lp.'));

  it.each(keys)('%s etiketi sayfa adıyla başlar ve bağlam taşır', (key) => {
    const label = SLOTS[key].label;
    expect(label, key).toContain(' › ');
    expect(label, key).not.toMatch(/^(Bölüm|Form:|Form altı|Form hatası|Alt bilgi|Mobil çubuk|Çerez bandı:|İletişim kartı:|Kaynak etiketi:)/);
  });

  it('örnekler', () => {
    expect(SLOTS['home.day.title'].label).toBe('Ana sayfa › Bir günümüz › Başlık');
    expect(SLOTS['home.week.lead'].label).toBe('Günlük akış › Haftalık ritim › Açıklama');
    expect(SLOTS['gunlukakis.plan.full.hours'].label).toBe('Günlük akış › Tam gün › Saatler');
    expect(SLOTS['meta.home.title'].label).toBe('Ana sayfa › Google › Başlık');
    expect(SLOTS['faq.items'].label).toBe('SSS › Sorular ve cevaplar');
    expect(SLOTS['site.phone'].label).toBe('Okul bilgileri › Telefon');
    expect(SLOTS['chrome.cookie.accept'].label).toBe('Site geneli › Çerez bandı › Kabul düğmesi');
    expect(SLOTS['form.err.phone'].label).toBe('Randevu formu › Hata mesajları › Telefon numarası geçersiz');
    expect(SLOTS['legal.gizlilik.body'].label).toBe('Yasal metinler › KVKK sayfası › KVKK aydınlatma metni');
  });

  it('reklam sayfası ve fotoğraf etiketleri olduğu gibi kalır', () => {
    expect(labelFor('lp.common.ctaPrimary', 'Reklam sayfası ana düğme')).toBe('Reklam sayfası ana düğme');
    expect(labelFor('media.gardenWide', 'Bahçe')).toBe('Fotoğraf › Bahçe');
    expect(labelFor('bilinmeyen.alan', 'X')).toBe('X');
  });

  it('aynı sayfada aynı etiket iki alana verilmez (fotoğraflar hariç: etiket alt yazıdan türer)', () => {
    const seen = new Map<string, string>();
    for (const key of keys.filter((k) => !k.startsWith('media.'))) {
      const label = SLOTS[key].label;
      expect(seen.get(label), `${key} ve ${seen.get(label)} aynı etikete sahip: ${label}`).toBeUndefined();
      seen.set(label, key);
    }
  });
});
