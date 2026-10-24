import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import HomeView from '@/app/(site)/HomeView';
import { defaultData, sentinelData, uncoveredText } from '@/lib/content/testing';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const PREFIXES = ['home.', 'faq.', 'testimonials.', 'day.', 'program.', 'media.', 'meta.home.', 'chrome.contact.', 'gunlukakis.scene.'];

describe('ana sayfa ziyaretçi HTML', () => {
  // Hesaplanan yıllar (kuruluştan beri) 1 Ocak'ta anlık görüntüyü bozmasın.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00+03:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('düzenleme katmanından önceki hâliyle aynı', () => {
    const { container } = render(<HomeView data={defaultData(PREFIXES)} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('ziyaretçiye düzenleme öznitelikleri gitmez', () => {
    const { container } = render(<HomeView data={defaultData(PREFIXES)} />);
    expect(container.innerHTML).not.toContain('data-edit-');
  });

  it('düzenleme modunda metinler, listeler ve fotoğraflar işaretlenir', () => {
    const data = { ...defaultData(PREFIXES), editing: true };
    const { container } = render(<HomeView data={data} />);
    for (const key of [
      'home.hero.title', 'home.testimonials.title', 'home.testimonials.link', 'home.day.link', 'home.faq.title',
      'home.faqLink.label', 'home.contact.lead', 'media.gardenWide', 'media.candyCorner',
    ]) {
      expect(container.querySelector(`[data-edit-key="${key}"]`), key).not.toBeNull();
    }
    for (const list of ['testimonials.items', 'day.chapters', 'home.garden.shots', 'home.features.cards', 'program.branches', 'faq.items']) {
      expect(container.querySelector(`[data-edit-list="${list}"]`), list).not.toBeNull();
    }
    expect(container.querySelector('blockquote[data-edit-key="testimonials.items"][data-edit-path="muge-ilkokul-olsa.quote"]')).not.toBeNull();
    expect(container.querySelector('blockquote[data-edit-key="testimonials.items"][data-edit-path="emre-kolej-karsilastirma.quote"]')).not.toBeNull();
    // Yazar · açıklama tek satır: yanlış alana yazılmasın diye figcaption işaretsiz.
    expect(container.querySelector('figcaption[data-edit-key]')).toBeNull();
    // Haftalık ritim Günlük Akış sayfasına taşındı.
    expect(container.querySelector('[data-edit-list="program.weekDays"]')).toBeNull();
    // Merak edilenler: yalnız "Ana sayfada göster" işaretli sorular.
    expect(container.querySelector('details [data-edit-key="faq.items"][data-edit-path="ucret.question"]')).not.toBeNull();
    expect(container.querySelector('[data-edit-path="servis.question"]')).toBeNull();
  });

  it('ikna akışı: hero → yorumlar → gün → bahçe → neden biz → dersler → sorular → form (#randevu)', () => {
    const { container } = render(<HomeView data={{ ...defaultData(PREFIXES), editing: true }} />);
    const order = [
      'h1[data-edit-key="home.hero.title"]',
      '[data-edit-key="home.testimonials.title"]',
      '[data-edit-key="home.day.title"]',
      '[data-edit-key="home.garden.title"]',
      '[data-edit-key="home.features.title"]',
      '[data-edit-key="home.activities.title"]',
      '[data-edit-key="home.faq.title"]',
      'section#randevu form',
    ].map((sel) => container.querySelector(sel));
    order.forEach((el, i) => expect(el, String(i)).not.toBeNull());
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING, String(i)).toBeTruthy();
    }
    // "Neden biz" düğmesi sayfadaki forma kaydırır; hero düğmesi kayıt sayfasına gider.
    expect(container.querySelector('a[data-edit-key="home.features.cta"]')?.getAttribute('href')).toBe('#randevu');
    expect(container.querySelector('a[data-edit-key="home.hero.ctaPrimary"]')?.getAttribute('href')).toBe('/kayit');
  });

  it('görünür her metin bir içerik alanından geliyor', () => {
    const { container } = render(<HomeView data={sentinelData(PREFIXES)} />);
    // Başvuru formu (LeadForm) bu görevin kapsamı değil; iletişim kartları (ContactInfo) chrome.contact.* ve site.* alanlarından gelir.
    container.querySelectorAll('form').forEach((el) => el.remove());
    // "Sahne 0N": ön ek gunlukakis.scene.prefix alanından, sıra numarası chapterLabel()'den gelir.
    expect(uncoveredText(container)).toEqual([]);
  });
  it('merak edilenler kapalı akordeon: /sss bağlantısı var, FAQPage şeması basılmaz (şema /sss sayfasında)', () => {
    const { container } = render(<HomeView data={defaultData(PREFIXES)} />);
    expect(container.querySelector('a[href="/sss"]')?.textContent).toContain('Sık sorulan sorular');
    expect(container.innerHTML).not.toContain('FAQPage');
    const featured = (defaultData(PREFIXES).values['faq.items'] as { featured: boolean; ready: boolean }[]).filter((f) => f.featured && f.ready);
    expect(container.querySelectorAll('details')).toHaveLength(featured.length);
    expect(container.querySelector('details[open]')).toBeNull();
  });

  it('duyurular: yoksa bölüm basılmaz, varsa hero\'dan hemen sonra, yorumlardan önce görünür', () => {
    const empty = render(<HomeView data={defaultData(PREFIXES)} />).container;
    expect(empty.querySelector('#duyurular')).toBeNull();
    const item = { id: 'a1', title: 'Kermes', body: '<p>Cumartesi</p>', startsOn: '2026-10-01', endsOn: null, imageSrc: null, imageAlt: null };
    const { container } = render(<HomeView data={defaultData(PREFIXES)} announcements={[item]} />);
    const section = container.querySelector('#duyurular');
    expect(section?.textContent).toContain('Kermes');
    expect(section!.compareDocumentPosition(container.querySelector('form')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const quotes = container.querySelector('a[href="/veli-yorumlari"]')!;
    expect(section!.compareDocumentPosition(quotes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
