import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import SSS from '@/app/(site)/sss/SSS';
import { defaultData, sentinelData, uncoveredText } from '@/lib/content/testing';

const PREFIXES = ['sss.', 'meta.sss.', 'faq.'];

const openAll = (container: HTMLElement) => container.querySelectorAll('button').forEach((b) => fireEvent.click(b));

describe('sss ziyaretçi HTML', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00+03:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('düzenleme katmanından önceki hâliyle aynı', () => {
    const { container } = render(<SSS data={defaultData(PREFIXES)} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('tüm cevaplar açıkken aynı', () => {
    const { container } = render(<SSS data={defaultData(PREFIXES)} />);
    openAll(container);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('ziyaretçiye düzenleme öznitelikleri gitmez', () => {
    const { container } = render(<SSS data={defaultData(PREFIXES)} />);
    openAll(container);
    expect(container.innerHTML).not.toContain('data-edit-');
  });

  it('düzenleme modunda metinler ve soru-cevap listesi işaretlenir', () => {
    const { container } = render(<SSS data={{ ...defaultData(PREFIXES), editing: true }} />);
    openAll(container);
    for (const key of ['sss.hero.title', 'sss.cta.title', 'sss.cta.lead']) {
      expect(container.querySelector(`[data-edit-key="${key}"]`), key).not.toBeNull();
    }
    expect(container.querySelector('[data-edit-list="faq.items"]')).not.toBeNull();
    expect(container.querySelector('h3[data-edit-key="faq.items"][data-edit-path="yas-araligi.question"]')).not.toBeNull();
    expect(container.querySelector('p[data-edit-key="faq.items"][data-edit-path="yas-araligi.answer"]')).not.toBeNull();
  });

  it('hazır olmayan soru basılmaz', () => {
    const data = defaultData(PREFIXES);
    data.values['faq.items'] = (data.values['faq.items'] as { ready: boolean }[]).map((i, n) => ({ ...i, ready: n === 0 }));
    const { container } = render(<SSS data={data} />);
    expect(container.querySelectorAll('h3')).toHaveLength(1);
  });

  it('görünür her metin (cevaplar dahil) bir içerik alanından geliyor', () => {
    const { container } = render(<SSS data={sentinelData(PREFIXES)} />);
    openAll(container);
    expect(uncoveredText(container)).toEqual([]);
  });
});
