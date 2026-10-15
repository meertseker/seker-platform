import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import BultenlerView from '@/app/(site)/bultenler/BultenlerView';
import { SLOTS } from '@/lib/content/registry';
import { defaultData, sentinelData, uncoveredText } from '@/lib/content/testing';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const PREFIXES = ['bultenler.', 'meta.bultenler.', 'media.'];

describe('bultenler ziyaretçi HTML', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00+03:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('düzenleme katmanından önceki hâliyle aynı', () => {
    const { container } = render(<BultenlerView data={defaultData(PREFIXES)} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('duyuru yokken HTML değişmez; varsa bölüm basılır', () => {
    const base = render(<BultenlerView data={defaultData(PREFIXES)} />).container.innerHTML;
    const same = render(<BultenlerView data={defaultData(PREFIXES)} announcements={[]} />).container.innerHTML;
    expect(same).toBe(base);
    const item = { id: 'a1', title: 'Kermes', body: '<p>Cumartesi</p>', imageSrc: null, imageAlt: null, startsOn: '2026-10-20', endsOn: null };
    const withAnn = render(<BultenlerView data={defaultData(PREFIXES)} announcements={[item]} />).container;
    expect(withAnn.querySelector('h3')!.textContent).toBe('Kermes');
    expect(withAnn.innerHTML).not.toContain('data-edit-');
  });

  it('ziyaretçiye düzenleme öznitelikleri gitmez', () => {
    expect(render(<BultenlerView data={defaultData(PREFIXES)} />).container.innerHTML).not.toContain('data-edit-');
  });

  it('düzenleme modunda metinler, kanal listesi ve fotoğraf işaretlenir', () => {
    const { container } = render(<BultenlerView data={{ ...defaultData(PREFIXES), editing: true }} />);
    for (const key of ['bultenler.hero.title', 'bultenler.request.title', 'bultenler.request.ctaWhatsapp', 'site.phone', 'media.gardenWorkshops']) {
      expect(container.querySelector(`[data-edit-key="${key}"]`), key).not.toBeNull();
    }
    expect(container.querySelector('[data-edit-list="bultenler.channels"]')).not.toBeNull();
    expect(container.querySelector('h2[data-edit-key="bultenler.channels"][data-edit-path="kamera.title"]')).not.toBeNull();
  });

  it('kanal listesi: eklenebilir, yeni kanal mor şeritle başlar, şerit düzenlenemez', () => {
    const def = SLOTS['bultenler.channels'];
    expect(def.fixedItems).toBe(false);
    expect(def.newItem).toEqual({ band: 'band-grape' });
    expect(Object.keys(def.fields!)).toEqual(['title', 'body']);
    expect(def.fields!.title.max).toBe(40);
    expect(def.fields!.body.max).toBe(300);
  });

  it('eklenen kanal şeridiyle basılır', () => {
    const data = defaultData(PREFIXES);
    data.values['bultenler.channels'] = [
      ...(data.values['bultenler.channels'] as object[]),
      { id: 'yeni', title: 'Yeni kanal', body: 'Açıklama', band: 'band-grape' },
    ];
    const { container } = render(<BultenlerView data={data} />);
    expect(container.querySelector('.band-grape h2')?.textContent).toBe('Yeni kanal');
  });

  it('görünür her metin bir içerik alanından geliyor', () => {
    const { container } = render(<BultenlerView data={sentinelData(PREFIXES)} />);
    expect(uncoveredText(container)).toEqual([]);
  });
});
