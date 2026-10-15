import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import LandingView from '@/app/(lp)/lp/[slug]/LandingView';
import { LANDING_SLUGS } from '@/content/landingPages';
import { defaultData, sentinelData, uncoveredText } from '@/lib/content/testing';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), notFound: vi.fn() }));

const prefixes = (slug: string) => [`lp.${slug}.`, 'lp.common.', 'testimonials.', 'form.'];

describe('reklam sayfaları ziyaretçi HTML', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00+03:00'));
  });
  afterEach(() => vi.useRealTimers());

  it.each(LANDING_SLUGS)('%s: düzenleme katmanından önceki hâliyle aynı', (slug) => {
    const { container } = render(<LandingView slug={slug} data={defaultData(prefixes(slug))} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it.each(LANDING_SLUGS)('%s: ziyaretçiye düzenleme öznitelikleri gitmez', (slug) => {
    const { container } = render(<LandingView slug={slug} data={defaultData(prefixes(slug))} />);
    expect(container.innerHTML).not.toContain('data-edit-');
  });

  it.each(LANDING_SLUGS)('%s: düzenleme modunda ana alanlar işaretlenir', (slug) => {
    const { container } = render(<LandingView slug={slug} data={{ ...defaultData(prefixes(slug)), editing: true }} />);
    for (const key of [`lp.${slug}.h1`, `lp.${slug}.subhead`, `lp.${slug}.formHeading`, `lp.${slug}.media`, 'lp.common.ctaPrimary', 'site.phone']) {
      expect(container.querySelector(`[data-edit-key="${key}"]`), key).not.toBeNull();
    }
    for (const list of ['proofPoints', 'bodyBlocks', 'faq']) {
      expect(container.querySelector(`[data-edit-list="lp.${slug}.${list}"]`), list).not.toBeNull();
    }
  });

  it.each(LANDING_SLUGS)('%s: görünür her metin bir içerik alanından geliyor (KVKK onay cümlesi data-edit-ignore ile hariç)', (slug) => {
    const { container } = render(<LandingView slug={slug} data={{ ...sentinelData(prefixes(slug)), editing: true }} />);
    expect(uncoveredText(container)).toEqual([]);
  });

  it.each(LANDING_SLUGS)('%s: metin ve JSON-LD içinde doldurulmamış belirteç kalmaz (F15)', (slug) => {
    const { container } = render(<LandingView slug={slug} data={defaultData(prefixes(slug))} />);
    const ld = Array.from(container.querySelectorAll('script[type="application/ld+json"]')).map((s) => s.textContent).join('');
    expect(ld).not.toBe('');
    for (const token of ['{yilSayisi}', '{kurulusYili}']) {
      expect(container.textContent).not.toContain(token);
      expect(ld).not.toContain(token);
    }
  });
});
