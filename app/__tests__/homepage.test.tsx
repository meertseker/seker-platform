import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import HeroSection from '../components/HeroSection';
import TrustBar from '../components/TrustBar';
import { ROSTER_STATUS } from '@/content/day';

/**
 * Ana sayfanın kaynak metnini ve render çıktısını tarayan testler.
 * content/__tests__/day.test.tsx içindeki desenin ana sayfaya genişletilmiş
 * hali: doğrulanmamış rakamlar iddia olarak yazılamaz, yasaklı kelimeler ve
 * klişeler geçmez, eski "rainbow" paleti (raw hex) sızmaz.
 */

const readSource = (...segments: string[]) =>
  readFileSync(path.join(process.cwd(), ...segments), 'utf8');

const HERO_SRC = readSource('app', 'components', 'HeroSection.tsx');
const TRUSTBAR_SRC = readSource('app', 'components', 'TrustBar.tsx');
const ANASAYFA_SRC = readSource('app', 'Anasayfa.tsx');
const CONTACT_SRC = readSource('app', 'components', 'ContactSection.tsx');

const HOMEPAGE_FILES = {
  'app/components/HeroSection.tsx': HERO_SRC,
  'app/components/TrustBar.tsx': TRUSTBAR_SRC,
  'app/Anasayfa.tsx': ANASAYFA_SRC,
  'app/components/ContactSection.tsx': CONTACT_SRC,
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

describe('künye doğrulama kapısı — hero, ROSTER_STATUS kapalıyken rakamı iddia olarak yazmaz', () => {
  it('ROSTER_STATUS henüz hazır değil (doğrulama kuyruğu #1, #2)', () => {
    expect(ROSTER_STATUS.ready).toBe(false);
  });

  it('HeroSection render çıktısı, kapı kapalıyken çocuk/öğretmen sayısını iddia olarak içermez', () => {
    const { container } = render(<HeroSection />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/sınıflarımızda\s+\d+\s+çocuk var/i);
    expect(container.querySelectorAll('[data-mark="child"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-mark="teacher"]')).toHaveLength(0);
  });

  it('HeroSection, künye kapalıyken de görsel bir sağ sütuna sahiptir (Frame düşer) — hero boş kalmaz', () => {
    const { container } = render(<HeroSection />);
    expect(container.querySelector('img')).not.toBeNull();
  });

  it('HeroSection birincil CTA metni asset dosyası §4.4 ile eşleşir', () => {
    const { getByText } = render(<HeroSection />);
    expect(getByText('Ön Görüşme Randevusu Alın')).toBeDefined();
  });

  it('TrustBar render çıktısı, kapı kapalıyken sınıf mevcudu / öğretmen oranı rakamlarını göstermez', () => {
    const { container } = render(<TrustBar />);
    const text = container.textContent ?? '';
    expect(text).not.toContain('Sınıf mevcudu');
    expect(text).not.toContain('Öğretmen başına çocuk');
    expect(text).not.toMatch(/1\s*:\s*\d/);
  });

  it('TrustBar, doğrulama gerektirmeyen kalemleri (yıl, yaş grubu) yine de gösterir', () => {
    const { container } = render(<TrustBar />);
    const text = container.textContent ?? '';
    expect(text).toContain('Yaş grubu');
    expect(text).toMatch(/\d+ yıl/);
  });
});
