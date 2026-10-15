import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import TesekkurlerView from '@/app/(site)/tesekkurler/TesekkurlerView';
import { defaultData, sentinelData, uncoveredText } from '@/lib/content/testing';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const PREFIXES = ['tesekkurler.', 'meta.tesekkurler.'];

describe('tesekkurler ziyaretçi HTML', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00+03:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('düzenleme katmanından önceki hâliyle aynı', () => {
    const { container } = render(<TesekkurlerView data={defaultData(PREFIXES)} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('ziyaretçiye düzenleme öznitelikleri gitmez', () => {
    expect(render(<TesekkurlerView data={defaultData(PREFIXES)} />).container.innerHTML).not.toContain('data-edit-');
  });

  it('düzenleme modunda metinler işaretlenir', () => {
    const { container } = render(<TesekkurlerView data={{ ...defaultData(PREFIXES), editing: true }} />);
    for (const key of ['tesekkurler.hero.title', 'tesekkurler.lead', 'tesekkurler.ctaWhatsapp', 'tesekkurler.home', 'site.phone']) {
      expect(container.querySelector(`[data-edit-key="${key}"]`), key).not.toBeNull();
    }
  });

  it('görünür her metin bir içerik alanından geliyor', () => {
    const { container } = render(<TesekkurlerView data={sentinelData(PREFIXES)} />);
    expect(uncoveredText(container)).toEqual([]);
  });
});
