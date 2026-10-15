import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import HomeView from '@/app/(site)/HomeView';
import { defaultData, sentinelData, uncoveredText } from '@/lib/content/testing';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const PREFIXES = ['home.', 'faq.', 'testimonials.', 'day.', 'program.', 'media.', 'meta.home.', 'chrome.contact.'];

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
    for (const key of ['home.hero.title', 'home.day.link', 'home.faq.cta', 'media.gardenWide', 'media.candyCorner']) {
      expect(container.querySelector(`[data-edit-key="${key}"]`), key).not.toBeNull();
    }
    for (const list of ['day.chapters', 'home.garden.shots', 'home.features.cards', 'program.branches', 'program.weekDays', 'faq.items']) {
      expect(container.querySelector(`[data-edit-list="${list}"]`), list).not.toBeNull();
    }
    expect(container.querySelector('blockquote[data-edit-key="testimonials.items"][data-edit-path="muge-ilkokul-olsa.quote"]')).not.toBeNull();
    // Yazar · açıklama tek satır: yanlış alana yazılmasın diye figcaption işaretsiz.
    expect(container.querySelector('figcaption[data-edit-key]')).toBeNull();
    expect(container.querySelector('[data-edit-list="program.weekDays"]')).not.toBeNull();
  });

  it('görünür her metin bir içerik alanından geliyor', () => {
    const { container } = render(<HomeView data={sentinelData(PREFIXES)} />);
    // Başvuru formu (LeadForm) bu görevin kapsamı değil; iletişim kartları (ContactInfo) chrome.contact.* ve site.* alanlarından gelir.
    container.querySelectorAll('form').forEach((el) => el.remove());
    // "Sahne 0N": SCHEDULE_READY false iken chapterLabel()'in sırasından türettiği etiket; gerçek saat `time` alanından gelir.
    expect(uncoveredText(container).filter((t) => !/^Sahne \d{2}$/.test(t))).toEqual([]);
  });
});
