import { describe, it, expect } from 'vitest';
import { LANDING_PAGES, LANDING_SLUGS, getLandingPage } from '../landingPages';
import { MEDIA } from '../media';
import { ROSTER_STATUS, ENGLISH_COVERAGE_READY } from '../day';

const FORBIDDEN = ['indirim', 'kampanya', 'uygun fiyat', 'bütçe dostu', 'fırsat'];

const REQUIRED_SLUGS = [
  'beykent-anaokulu',
  'beylikduzu-anaokulu',
  'az-mevcutlu-anaokulu',
  'kres-2-yas',
  'anaokulu-ucret',
];

describe('LANDING_PAGES', () => {
  it('beş landing page tanımlıdır', () => {
    expect(LANDING_PAGES).toHaveLength(5);
  });

  it('slug\'lar benzersizdir', () => {
    expect(new Set(LANDING_SLUGS).size).toBe(LANDING_SLUGS.length);
  });

  it('zorunlu beş slug tam olarak korunur (doğrulama görevi bunlara referans verir)', () => {
    expect([...LANDING_SLUGS].sort()).toEqual([...REQUIRED_SLUGS].sort());
  });

  it('getLandingPage bilineni bulur, bilinmeyene undefined döner', () => {
    expect(getLandingPage('az-mevcutlu-anaokulu')?.campaign).toBe('K4-A');
    expect(getLandingPage('yok-boyle-bir-sey')).toBeUndefined();
  });

  it.each(LANDING_PAGES)('$slug geçerli görsel anahtarı kullanır', (page) => {
    expect(MEDIA[page.mediaKey]).toBeDefined();
  });

  it.each(LANDING_PAGES)('$slug dört kanıt rakamı içerir', (page) => {
    expect(page.proofPoints).toHaveLength(4);
  });

  it.each(LANDING_PAGES)('$slug üç gövde bloğu içerir', (page) => {
    expect(page.bodyBlocks).toHaveLength(3);
  });

  it.each(LANDING_PAGES)('$slug en az üç SSS içerir', (page) => {
    expect(page.faq.length).toBeGreaterThanOrEqual(3);
  });

  it.each(LANDING_PAGES)('$slug yasak kelime içermez', (page) => {
    const text = JSON.stringify(page).toLowerCase();
    for (const word of FORBIDDEN) expect(text).not.toContain(word);
  });

  it.each(LANDING_PAGES)('$slug ücret rakamı içermez', (page) => {
    const text = JSON.stringify(page);
    expect(text).not.toMatch(/\d{3}\.\d{3}/);
    expect(text).not.toContain('₺');
  });
});

/**
 * Doğrulama kuyruğu (asset dosyası §0.2) — bu landing page'ler beş farklı
 * arama niyetine cevap verir ve her biri bir 🔴 iddiaya doğrudan
 * dokunur: sınıf/öğretmen sayısı (#1, #2), İngilizce öğretmeninin
 * kapsamı/"native" statüsü (#3), servis güzergâhları (#7), mutfak/diyetisyen
 * (#8), güvenlik ayrıntıları (#9), uyum süreci ayrıntıları (#10). Bu blok,
 * content/__tests__/day.test.tsx ve content/__tests__/faqSafety.test.tsx'in
 * kurduğu disiplinin aynısını landing page verisine uygular: kapı kapalıyken
 * hiçbir sayfa bu iddiaları rakam ya da kesinlik olarak taşımaz. Bu bayrakları
 * doğrulamadan biri unutup true yaparsa veya birisi metne doğrulanmamış bir
 * rakam yapıştırırsa bu blok kırmızı olur.
 */
describe('LANDING_PAGES — rakamlar tek kaynaktan, aşırı iddia yok', () => {
  it('okul sınıf mevcudunu doğruladı (1 Ağustos 2026)', () => {
    expect(ROSTER_STATUS.ready).toBe(true);
  });

  it('okul günlük İngilizce kapsamını doğruladı', () => {
    expect(ENGLISH_COVERAGE_READY).toBe(true);
  });

  it.each(LANDING_PAGES)('$slug kanıt rakamlarında doğrulanmış sınıf mevcudunu taşır', (page) => {
    expect(page.proofPoints.some((p) => p.label === 'Sınıf mevcudu')).toBe(true);
    expect(page.proofPoints.some((p) => p.label === 'Öğretmen başına çocuk')).toBe(true);
  });

  it.each(LANDING_PAGES)('$slug sınıf mevcudunu ROSTER_STATUS dışında bir rakamla yazmaz', (page) => {
    const text = JSON.stringify(page).toLowerCase();
    // Eski taslakların bıraktığı rakamlar. Tek kaynak content/day.ts'dir;
    // metne elle yazılmış bir mevcut sızarsa bu blok kırmızı olur.
    expect(text).not.toMatch(/\b10\s+çocuk\b/);
    expect(text).not.toMatch(/öğretmen başına (beş|5)\b/);
  });

  it.each(LANDING_PAGES)('$slug "native" veya desteklenemeyen mezuniyet iddiası içermez (asset dosyası §5.2, kuyruk #3)', (page) => {
    const text = JSON.stringify(page).toLowerCase();
    expect(text).not.toContain('native');
    expect(text).not.toContain('mezun olduğunda ingilizce konuşuyor');
    expect(text).not.toContain('mezun olan çocuklarımız ingilizce konuşuyor');
    expect(text).not.toContain('akıcı ingilizce');
    expect(text).not.toContain('iki dilli');
    expect(text).not.toContain('bilingual');
  });

  it.each(LANDING_PAGES)('$slug İngilizce kapsamını doğrulanmış süreden fazlasıyla anlatmaz', (page) => {
    const text = JSON.stringify(page).toLowerCase();
    // Okulun doğruladığı şey günde iki saat; "gün boyu" bunun ötesinde
    // bir iddiadır ve reklam sayfasında yazılmaz.
    expect(text).not.toMatch(/gün boyunca kullan/);
    expect(text).not.toContain('sadece ders saatinde değil');
  });

  it.each(LANDING_PAGES)('$slug uydurma servis güzergâhı adı içermez (doğrulama kuyruğu #7)', (page) => {
    const text = JSON.stringify(page);
    // Brief'in ilk taslağı bu güzergâh adlarını doğrulanmadan gerçek gibi
    // yazmıştı; asset dosyası bunu #7 olarak 🔴 işaretliyor. Okul isimleri
    // doğrulayana kadar hiçbiri metne girmez.
    for (const route of ['Adnan Kahveci', 'Kavaklı', 'Marmara', 'Gürpınar']) {
      expect(text).not.toContain(route);
    }
    expect(text.toLowerCase()).not.toMatch(/\bservis (mevcuttur|vardır)\b/);
  });

  it.each(LANDING_PAGES)('$slug mutfak/diyetisyen iddiası içermez (doğrulama kuyruğu #8)', (page) => {
    const text = JSON.stringify(page).toLowerCase();
    expect(text).not.toContain('diyetisyen');
    expect(text).not.toMatch(/menü döngüsü/);
  });

  it.each(LANDING_PAGES)('$slug spesifik güvenlik iddiası içermez (doğrulama kuyruğu #9)', (page) => {
    const text = JSON.stringify(page).toLowerCase();
    expect(text).not.toMatch(/\d+\s*kamera/);
    expect(text).not.toMatch(/ilk yardım sertifikalı \d+/);
  });

  it.each(LANDING_PAGES)('$slug icat edilmiş uyum-süreci ayrıntısı içermez (doğrulama kuyruğu #10)', (page) => {
    const text = JSON.stringify(page).toLowerCase();
    // Brief'in ilk taslağı doğrulanmamış bir randevu süresi ("kırk beş
    // dakika") ve kademelendirme ayrıntısı iddia ediyordu; hiçbiri kaynağı
    // olmayan bir icattı ve burada da yazılmaz.
    expect(text).not.toContain('kırk beş dakika');
    expect(text).not.toMatch(/ilk (üç|3|iki|2) gün/);
  });

  it('az-mevcutlu-anaokulu rakamı açıkça verir ve yönetmelik sınırıyla karşılaştırır', () => {
    const page = getLandingPage('az-mevcutlu-anaokulu')!;
    const text = JSON.stringify(page).toLowerCase();
    expect(text).toContain(String(ROSTER_STATUS.childCount));
    expect(text).toContain(String(ROSTER_STATUS.limit));
    // Sayfa hâlâ ziyarete davet eder; iddia yerine sayılabilir kanıt sunar.
    expect(text).toMatch(/kendiniz say/);
  });

  it('hiçbir sayfa rakamı yazmamayı gerekçelendiren meta-anlatı taşımaz', () => {
    // Sitenin kendi epistemolojisini anlatması velinin işine yaramıyor;
    // bu cümleler "yazan bir insan yok" hissinin ana kaynağıydı.
    for (const page of LANDING_PAGES) {
      const text = JSON.stringify(page).toLowerCase();
      expect(text, page.slug).not.toMatch(/doğrulanmamış/);
      expect(text, page.slug).not.toMatch(/neden (burada )?yazmıyoruz/);
      expect(text, page.slug).not.toMatch(/iddia olarak (sunmak|yazmak)/);
    }
  });
});
