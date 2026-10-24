import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import IletisimView from '@/app/(site)/iletisim/IletisimView';
import HomeView from '@/app/(site)/HomeView';
import { defaultData, sentinelData, uncoveredText } from '@/lib/content/testing';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const PREFIXES = ['iletisim.', 'meta.iletisim.', 'chrome.contact.', 'form.'];
const HOME_PREFIXES = ['home.', 'faq.', 'testimonials.', 'day.', 'program.', 'media.', 'chrome.contact.', 'form.', 'gunlukakis.scene.'];

describe('iletisim ziyaretçi HTML', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00+03:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('düzenleme katmanından önceki hâliyle aynı', () => {
    const { container } = render(<IletisimView data={defaultData(PREFIXES)} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('ziyaretçiye düzenleme öznitelikleri gitmez', () => {
    expect(render(<IletisimView data={defaultData(PREFIXES)} />).container.innerHTML).not.toContain('data-edit-');
  });

  it('düzenleme modunda metinler, iletişim kartları ve form işaretlenir', () => {
    const { container } = render(<IletisimView data={{ ...defaultData(PREFIXES), editing: true }} />);
    for (const key of ['iletisim.hero.title', 'iletisim.contact.eyebrow', 'iletisim.contact.title', 'iletisim.contact.lead', 'site.phone', 'site.email', 'form.submit']) {
      expect(container.querySelector(`[data-edit-key="${key}"]`), key).not.toBeNull();
    }
    expect(container.querySelector('[data-edit-key^="home.contact."]')).toBeNull();
  });

  it('ana sayfayla ortak düzenlenebilir metin yok: biri değişince diğeri değişmez', () => {
    const iletisimData = defaultData(PREFIXES);
    iletisimData.values['iletisim.contact.title'] = 'İletişim sayfası formu';
    const homeData = defaultData(HOME_PREFIXES);
    const homeTitle = String(homeData.values['home.contact.title']);

    const iletisim = render(<IletisimView data={iletisimData} />).container;
    expect(iletisim.textContent).toContain('İletişim sayfası formu');
    expect(iletisim.textContent).not.toContain(homeTitle);

    const home = render(<HomeView data={homeData} />).container;
    expect(home.textContent).toContain(homeTitle);
    expect(home.textContent).not.toContain('İletişim sayfası formu');
  });

  it('görünür her metin bir içerik alanından geliyor (KVKK onay cümlesi data-edit-ignore ile hariç)', () => {
    const { container } = render(<IletisimView data={{ ...sentinelData(PREFIXES), editing: true }} />);
    expect(uncoveredText(container)).toEqual([]);
  });
});
