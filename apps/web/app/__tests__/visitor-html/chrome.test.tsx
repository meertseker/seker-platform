import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import MobileActionBar from '@/app/components/MobileActionBar';
import WhatsAppButton from '@/app/components/WhatsAppButton';
import LpHeader from '@/app/components/lp/LpHeader';
import LpFooter from '@/app/components/lp/LpFooter';
import ContactInfo from '@/app/components/ContactInfo';
import { defaultData, sentinelData, uncoveredText } from '@/lib/content/testing';

vi.mock('next/navigation', () => ({ usePathname: () => '/sss', useRouter: () => ({ push: vi.fn() }) }));

const P = ['chrome.'];

const views = {
  Header: (d: ReturnType<typeof defaultData>) => <Header data={d} />,
  Footer: (d: ReturnType<typeof defaultData>) => <Footer year={2026} data={d} />,
  MobileActionBar: (d: ReturnType<typeof defaultData>) => <MobileActionBar data={d} />,
  WhatsAppButton: (d: ReturnType<typeof defaultData>) => <WhatsAppButton data={d} />,
  LpHeader: (d: ReturnType<typeof defaultData>) => <LpHeader data={d} />,
  LpFooter: (d: ReturnType<typeof defaultData>) => <LpFooter data={d} />,
};

describe('site geneli kabuk ziyaretçi HTML', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00+03:00'));
  });
  afterEach(() => vi.useRealTimers());

  for (const [name, view] of Object.entries(views)) {
    it(name, () => {
      expect(render(view(defaultData(P))).container.innerHTML).toMatchSnapshot();
    });
    it(`${name}: ziyaretçiye düzenleme öznitelikleri gitmez`, () => {
      expect(render(view(defaultData(P))).container.innerHTML).not.toContain('data-edit-');
    });
    it(`${name}: görünür her metin bir içerik alanından geliyor`, () => {
      const { container } = render(view(sentinelData(P)));
      expect(uncoveredText(container)).toEqual([]);
    });
  }

  it('ContactInfo: görünür her metin bir içerik alanından geliyor', () => {
    const { container } = render(<ContactInfo data={sentinelData(P)} />);
    expect(uncoveredText(container)).toEqual([]);
  });

  it('düzenleme modunda menü ve alt bilgi listeleri işaretlenir, adres birleşik olduğu için işaretsiz kalır', () => {
    const data = { ...defaultData(P), editing: true };
    const header = render(<Header data={data} />).container;
    expect(header.querySelector('[data-edit-list="chrome.nav.items"]')).not.toBeNull();
    expect(header.querySelector('a[data-edit-key="chrome.nav.items"][data-edit-path="sss-yok.label"]')).toBeNull();
    expect(header.querySelector('a[data-edit-key="chrome.nav.items"][data-edit-path="yas-gruplari.label"]')).not.toBeNull();
    const footer = render(<Footer year={2026} data={data} />).container;
    expect(footer.querySelector('[data-edit-list="chrome.footer.links"]')).not.toBeNull();
    expect(footer.querySelector('a[data-edit-key="site.phone"]')).not.toBeNull();
    expect(footer.querySelector('span[data-edit-key]')).toBeNull();
  });

  it('telefon düzenlenince tel: ve wa.me bağlantıları geçerli kalır; geçersizse varsayılana düşer', () => {
    const data = defaultData(P);
    data.values['site.phone'] = '0532 111 22 33';
    const bar = render(<MobileActionBar data={data} />).container;
    expect(bar.querySelector('a[href^="tel:"]')?.getAttribute('href')).toBe('tel:+905321112233');
    expect(bar.querySelector('a[href^="https://wa.me/"]')?.getAttribute('href')).toContain('wa.me/905321112233?text=');
    data.values['site.phone'] = 'geçersiz';
    const bar2 = render(<MobileActionBar data={data} />).container;
    expect(bar2.querySelector('a[href^="tel:"]')?.getAttribute('href')).toBe('tel:+905301018875');
  });
});
