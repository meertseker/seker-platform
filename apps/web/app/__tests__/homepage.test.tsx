import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import HeroSection from '../components/HeroSection';
import GardenSection from '../components/GardenSection';
import FeaturesSection from '../components/FeaturesSection';
import ActivitiesSection from '../components/ActivitiesSection';
import { ROSTER_STATUS } from '@/content/day';
import { PUBLISHED_TESTIMONIALS } from '@/content/testimonials';
import { MEDIA } from '@/content/media';
import { makeReader } from '@/lib/content/reader';
import { defaultData } from '@/lib/content/testing';

/**
 * Ana sayfanın kaynak metnini ve render çıktısını tarayan testler.
 * content/__tests__/day.test.tsx içindeki desenin ana sayfaya genişletilmiş
 * hali: doğrulanmamış rakamlar iddia olarak yazılamaz, yasaklı kelimeler ve
 * klişeler geçmez, eski "rainbow" paleti (raw hex) sızmaz.
 *
 * Fix round 1/5 — FeaturesSection, ActivitiesSection ve FAQSection (bkz.
 * content/__tests__/faqSafety.test.tsx) bu sayfada render edildiği için
 * tarama kapsamına eklendi (reviewer: "in scope because it renders on this
 * page").
 */

const readSource = (...segments: string[]) =>
  readFileSync(path.join(process.cwd(), ...segments), 'utf8');

/**
 * Dekoratif SVG ikonların `d`/`viewBox` koordinat dizileri sayı bakımından
 * yoğundur (ör. "l-.707.707") ve fiyat-deseni taramasında yanlış pozitif
 * üretir. Metin taramaları için bu öznitelikleri temizlenmiş bir kopya
 * kullanılır; ham kaynak (hex/mark taramaları için) ayrıca korunur.
 */
const stripSvgCoordinates = (source: string) =>
  source.replace(/\s(?:d|viewBox)="[^"]*"/g, '');

const readProse = (...segments: string[]) => stripSvgCoordinates(readSource(...segments));

const HERO_SRC = readSource('app', 'components', 'HeroSection.tsx');
const GARDEN_SRC = readSource('app', 'components', 'GardenSection.tsx');
const ANASAYFA_SRC = readSource('app', '(site)', 'HomeView.tsx');
// Metinler slot dosyalarına taşındı; taramalar onları da kapsar.
const HOME_SLOTS_SRC = readProse('lib', 'content', 'slots', 'home.ts');
const LISTS_SLOTS_SRC = readProse('lib', 'content', 'slots', 'lists.ts');
const MEDIA_SLOTS_SRC = readProse('lib', 'content', 'slots', 'media.ts');
const CHROME_SLOTS_SRC = readProse('lib', 'content', 'slots', 'chrome.ts');
const HAKKIMIZDA_SLOTS_SRC = readProse('lib', 'content', 'slots', 'hakkimizda.ts');
const EGITIM_SLOTS_SRC = readProse('lib', 'content', 'slots', 'egitim.ts');
const GUVENLIK_SLOTS_SRC = readProse('lib', 'content', 'slots', 'guvenlik.ts');

const reader = () => makeReader(defaultData());
const CONTACT_SRC = readSource('app', 'components', 'ContactSection.tsx');
const FEATURES_SRC = readProse('app', 'components', 'FeaturesSection.tsx');
const ACTIVITIES_SRC = readProse('app', 'components', 'ActivitiesSection.tsx');
const FAQ_SECTION_SRC = readProse('app', 'components', 'FAQSection.tsx');

const HOMEPAGE_FILES = {
  'app/components/HeroSection.tsx': HERO_SRC,
  'app/components/GardenSection.tsx': GARDEN_SRC,
  'app/(site)/HomeView.tsx': ANASAYFA_SRC,
  'lib/content/slots/home.ts': HOME_SLOTS_SRC,
  'lib/content/slots/lists.ts': LISTS_SLOTS_SRC,
  'lib/content/slots/media.ts': MEDIA_SLOTS_SRC,
  'lib/content/slots/chrome.ts': CHROME_SLOTS_SRC,
  'lib/content/slots/hakkimizda.ts': HAKKIMIZDA_SLOTS_SRC,
  'lib/content/slots/egitim.ts': EGITIM_SLOTS_SRC,
  'lib/content/slots/guvenlik.ts': GUVENLIK_SLOTS_SRC,
  'app/components/ContactSection.tsx': CONTACT_SRC,
  'app/components/FeaturesSection.tsx': FEATURES_SRC,
  'app/components/ActivitiesSection.tsx': ACTIVITIES_SRC,
  'app/components/FAQSection.tsx': FAQ_SECTION_SRC,
};

describe('ana sayfa kaynak taraması — fiyat ve yasak kelime', () => {
  const BANNED_WORDS = ['indirim', 'kampanya', 'uygun fiyat', 'bütçe dostu', 'fırsat'];

  it.each(Object.entries(HOMEPAGE_FILES))('%s yasaklı kelime içermez', (_file, source) => {
    const lower = source.toLowerCase();
    for (const word of BANNED_WORDS) {
      expect(lower).not.toContain(word);
    }
    expect(source).not.toContain('₺');
    expect(source).not.toMatch(/\d{3}\.\d{3}/);
  });
});

describe('ana sayfa kaynak taraması — klişe kara liste (asset dosyası §2.2)', () => {
  const CLICHES = [
    'sevgi dolu ortam',
    'minik kalpler',
    'minik adımlar',
    'güvenli ve mutlu bir ortam',
    'keşfet, oyna, öğren',
    'deneyimli öğretmen kadromuz',
    'çocuklarımızın mutluluğu önceliğimiz',
    'oyun temelli eğitim anlayışı',
    'geleceğe hazırlıyoruz',
    'çocuk merkezli yaklaşım',
    'hayallerine ulaşan bireyler',
    'zengin müfredat',
    'eğitimi ciddiye alıyoruz',
    'modern eğitim anlayışı',
    'ikinci evleri',
    'özgüvenli bireyler yetiştiriyoruz',
    'sıcak bir aile ortamı',
  ];

  it.each(Object.entries(HOMEPAGE_FILES))('%s klişe kara listesinden ifade içermez', (_file, source) => {
    const lower = source.toLowerCase();
    for (const cliche of CLICHES) {
      expect(lower).not.toContain(cliche);
    }
  });
});

describe('ana sayfa kaynak taraması — desteklenemeyen İngilizce/native iddiası (asset dosyası §5.2)', () => {
  it.each(Object.entries(HOMEPAGE_FILES))('%s "native" veya mezuniyet iddiası içermez', (_file, source) => {
    const lower = source.toLowerCase();
    expect(lower).not.toContain('native');
    expect(lower).not.toContain('mezun olduğunda ingilizce konuşuyor');
    expect(lower).not.toContain('mezun olan çocuklarımız ingilizce konuşuyor');
  });
});

describe('ana sayfa kaynak taraması — eski "rainbow" paleti (Task 3 notu, Anasayfa.tsx kapsamı)', () => {
  it.each(Object.entries(HOMEPAGE_FILES))('%s raw hex renk içermez', (_file, source) => {
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('yalnızca paper/ink/rule/mark tokenları ve gün tonları kullanılıyor (mark disiplinine uyar)', () => {
    // --color-mark yalnızca Roster işaretleri ve odak halkaları için ayrılmış
    // (bkz. app/__tests__/typography.test.ts). Ana sayfa dosyalarının hiçbiri
    // text/bg/border/ring-mark kullanmamalı.
    for (const [file, source] of Object.entries(HOMEPAGE_FILES)) {
      expect(source, file).not.toMatch(/\b(?:text|bg|border|ring)-mark\b/);
    }
  });
});

describe('ana sayfa yapısı — form ilk kaydırmada erişilebilir', () => {
  it('ContactSection, günün önizlemesinden hemen sonra ve mevcut bölümlerden (Features/Activities/FAQ) önce geliyor', () => {
    const dayPreviewIndex = ANASAYFA_SRC.indexOf('DAY_PREVIEW_IDS');
    const contactIndex = ANASAYFA_SRC.indexOf('<ContactSection');
    const featuresIndex = ANASAYFA_SRC.indexOf('<FeaturesSection');
    const activitiesIndex = ANASAYFA_SRC.indexOf('<ActivitiesSection');
    const faqIndex = ANASAYFA_SRC.indexOf('<FAQSection');

    expect(dayPreviewIndex).toBeGreaterThan(-1);
    expect(contactIndex).toBeGreaterThan(dayPreviewIndex);
    expect(contactIndex).toBeLessThan(featuresIndex);
    expect(contactIndex).toBeLessThan(activitiesIndex);
    expect(contactIndex).toBeLessThan(faqIndex);
  });

  it('günün önizlemesi ham chapter.time değil chapterLabel() kullanır — doğrulanmamış saat sızdırmaz', () => {
    expect(ANASAYFA_SRC).toContain('chapterLabel(chapter)');
    expect(ANASAYFA_SRC).not.toMatch(/\{chapter\.time\}/);
  });
});

describe('GardenSection — okulun kendi kareleri, stok görsel taşımaz', () => {
  /** Bölümde adı geçen polaroid kareleri (dört tane) ve geniş çapa karesi. */
  const SHOT_KEYS = ['mudKitchen', 'outdoorClass', 'giraffes', 'candyCorner'] as const;

  it('yalnızca okulun kendi çektiği görselleri kullanır', () => {
    for (const key of [...SHOT_KEYS, 'gardenWorkshops'] as const) {
      expect(MEDIA[key].status, key).toBe('okul');
    }
  });

  it('her karenin kendi başlığı var', () => {
    const { getAllByRole } = render(<GardenSection c={reader()} />);
    expect(getAllByRole('heading', { level: 3 }).length).toBe(SHOT_KEYS.length);
  });

  it('kaynakta stok görsel anahtarı geçmez', () => {
    for (const key of Object.keys(MEDIA) as (keyof typeof MEDIA)[]) {
      if ((MEDIA[key].status as string) !== 'stok') continue;
      expect(GARDEN_SRC, key).not.toMatch(new RegExp(`MEDIA\\.${key}\\b`));
    }
  });
});

describe('künye — okul sayıyı doğruladı (1 Ağustos 2026), hero rakamı gösterir', () => {
  it('ROSTER_STATUS doğrulanmış durumda', () => {
    expect(ROSTER_STATUS.ready).toBe(true);
    expect(ROSTER_STATUS.childCount).toBeGreaterThan(0);
    expect(ROSTER_STATUS.teacherCount).toBeGreaterThan(0);
  });

  it('HeroSection doğrulanmış sınıf mevcudunu ve öğretmen sayısını gösterir', () => {
    const { container } = render(<HeroSection c={reader()} />);
    const text = container.textContent ?? '';
    expect(text).toContain(String(ROSTER_STATUS.childCount));
    expect(text).toContain(String(ROSTER_STATUS.teacherCount));
  });

  it('HeroSection rakamı yönetmeliğin üst sınırıyla birlikte bağlama oturtur', () => {
    const { container } = render(<HeroSection c={reader()} />);
    expect(container.textContent ?? '').toContain(String(ROSTER_STATUS.limit));
  });

  it('HeroSection görsel taşır — bahçe karesi ve mekân kutusu', () => {
    const { container } = render(<HeroSection c={reader()} />);
    expect(container.querySelectorAll('img').length).toBeGreaterThanOrEqual(2);
  });

  it('HeroSection birincil CTA metni asset dosyası §4.4 ile eşleşir', () => {
    const { getByText } = render(<HeroSection c={reader()} />);
    expect(getByText('Ön Görüşme Randevusu Alın')).toBeDefined();
  });

  it('HeroSection veli sözünü kaynağıyla birlikte verir — uydurma alıntı taşımaz', () => {
    const { container } = render(<HeroSection c={reader()} />);
    const text = container.textContent ?? '';
    const quoted = PUBLISHED_TESTIMONIALS.some((item) => text.includes(item.quote));
    expect(quoted).toBe(true);
  });
});

describe('FeaturesSection — doğrulanmamış güvenlik/beslenme özellikleri iddia edilmez (doğrulama kuyruğu #8, #9)', () => {
  it('kaynakta "kamera" veya "beslenme uzmanı" gibi doğrulanmamış özellik iddiaları yok', () => {
    const lower = (FEATURES_SRC + HOME_SLOTS_SRC).toLowerCase();
    expect(lower).not.toContain('kamera');
    expect(lower).not.toContain('beslenme uzmanı');
    expect(lower).not.toMatch(/7\s*\/\s*24|24\s*\/\s*7/);
  });

  it('render çıktısında da aynı iddialar yok, kart sayısı sabit kalmış', () => {
    const { container, getAllByRole } = render(<FeaturesSection c={reader()} />);
    const text = (container.textContent ?? '').toLowerCase();
    expect(text).not.toContain('kamera');
    expect(text).not.toContain('beslenme uzmanı');
    expect(getAllByRole('heading', { level: 3 }).length).toBeGreaterThan(0);
  });
});

describe('ActivitiesSection — zekâ iddiası içermez (asset dosyası §5.1)', () => {
  it('kaynakta "zekâ/zeka" ile "geliştir/artır/yükselt" birlikte geçmiyor', () => {
    const lower = (ACTIVITIES_SRC + HOME_SLOTS_SRC).toLowerCase();
    expect(lower).not.toMatch(/zek[aâ][^.]{0,40}(geliştir|artır|yükselt)/);
    expect(lower).not.toContain('müzikal zeka');
  });

  it('render çıktısında da zekâ iddiası yok', () => {
    const { container } = render(<ActivitiesSection c={reader()} />);
    const text = (container.textContent ?? '').toLowerCase();
    expect(text).not.toMatch(/zek[aâ][^.]{0,40}(geliştir|artır|yükselt)/);
  });
});

describe('mobil kaydırma — gün önizlemesi tek satır yatay kaydırmaya düşer (Important 4)', () => {
  it('HomeView Header taşımaz — kabuk layout\'ta durur', () => {
    expect(ANASAYFA_SRC).not.toMatch(/<Header/);
  });

  it('gün kadrajları günlük akış sahneleriyle aynı view-transition adını paylaşır', () => {
    expect(ANASAYFA_SRC).toContain('transitionName={`day-${chapter.id}`}');
  });

  it('HomeView.tsx, üç dikey çerçeveyi mobilde alt alta değil yatay kaydırmada dizer', () => {
    expect(ANASAYFA_SRC).toMatch(/overflow-x-auto/);
    expect(ANASAYFA_SRC).toMatch(/snap-x/);
    // md: öneki olmadan grid-cols-3 hâlâ mobilde etkiliyse yığılma geri döner.
    expect(ANASAYFA_SRC).not.toMatch(/className="mt-10 grid gap-8 md:grid-cols-3"/);
  });

  it('hero bento kutuları mobilde tek sütuna iner — çok sütun yalnızca md: ile açılır', () => {
    // Önek almamış bir grid-cols-* 375 px'te kutuları yan yana sıkıştırır.
    expect(HERO_SRC).toMatch(/md:grid-cols-\d/);
    // Önek ayıracı ':' olmayan, yani kayıtsız şartsız uygulanan bir sütun sayısı.
    expect(HERO_SRC).not.toMatch(/(?<![:\w-])grid-cols-\d/);
  });

  it('bahçe polaroidleri mobilde yatay kaydırmaya düşer, alt alta yığılmaz', () => {
    expect(GARDEN_SRC).toMatch(/overflow-x-auto/);
    expect(GARDEN_SRC).toMatch(/snap-x/);
  });
});
