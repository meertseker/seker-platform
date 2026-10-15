import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import KayitView from '@/app/(site)/kayit/KayitView';
import { defaultData, sentinelData, uncoveredText } from '@/lib/content/testing';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const PREFIXES = ['kayit.', 'meta.kayit.', 'form.'];

describe('kayit ziyaretçi HTML', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00+03:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('düzenleme katmanından önceki hâliyle aynı', () => {
    const { container } = render(<KayitView data={defaultData(PREFIXES)} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('ziyaretçiye düzenleme öznitelikleri gitmez', () => {
    expect(render(<KayitView data={defaultData(PREFIXES)} />).container.innerHTML).not.toContain('data-edit-');
  });

  it('düzenleme modunda metinler, adımlar ve form etiketleri işaretlenir', () => {
    const { container } = render(<KayitView data={{ ...defaultData(PREFIXES), editing: true }} />);
    for (const key of ['kayit.hero.title', 'kayit.form.title', 'kayit.steps.title', 'kayit.contact.ctaWhatsapp', 'site.phone', 'form.submit', 'form.parentName.label']) {
      expect(container.querySelector(`[data-edit-key="${key}"]`), key).not.toBeNull();
    }
    expect(container.querySelector('[data-edit-list="kayit.steps"]')).not.toBeNull();
    expect(container.querySelector('h3[data-edit-key="kayit.steps"][data-edit-path="ziyaret.title"]')).not.toBeNull();
  });

  it('görünür her metin bir içerik alanından geliyor (KVKK onay cümlesi data-edit-ignore ile hariç)', () => {
    const { container } = render(<KayitView data={{ ...sentinelData(PREFIXES), editing: true }} />);
    expect(uncoveredText(container)).toEqual([]);
  });
});
