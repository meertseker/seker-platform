import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import GuvenlikView from '@/app/(site)/guvenlik/GuvenlikView';
import { defaultData, sentinelData, uncoveredText } from '@/lib/content/testing';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const PREFIXES = ['guvenlik.', 'meta.guvenlik.', 'media.'];

describe('guvenlik ziyaretçi HTML', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00+03:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('düzenleme katmanından önceki hâliyle aynı', () => {
    const { container } = render(<GuvenlikView data={defaultData(PREFIXES)} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('ziyaretçiye düzenleme öznitelikleri gitmez', () => {
    const { container } = render(<GuvenlikView data={defaultData(PREFIXES)} />);
    expect(container.innerHTML).not.toContain('data-edit-');
  });

  it('düzenleme modunda metinler ve liste işaretlenir', () => {
    const data = { ...defaultData(PREFIXES), editing: true };
    const { container } = render(<GuvenlikView data={data} />);
    for (const key of ['guvenlik.hero.title', 'guvenlik.cta.title']) {
      expect(container.querySelector(`[data-edit-key="${key}"]`), key).not.toBeNull();
    }
    expect(container.querySelector('[data-edit-list="guvenlik.sections"]')).not.toBeNull();
    expect(container.querySelector('h2[data-edit-key="guvenlik.sections"][data-edit-path="kamera.title"]')).not.toBeNull();
    expect(container.querySelector('p[data-edit-key="guvenlik.sections"][data-edit-path="servis.body"]')).not.toBeNull();
  });

  it('görünür her metin bir içerik alanından geliyor', () => {
    const { container } = render(<GuvenlikView data={sentinelData(PREFIXES)} />);
    // Başvuru formu (LeadForm) bu görevin kapsamı değil.
    container.querySelectorAll('form').forEach((el) => el.remove());
    expect(uncoveredText(container)).toEqual([]);
  });
});
