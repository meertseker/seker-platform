import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import AgeGroupView from '@/app/(site)/yas-gruplari/[slug]/AgeGroupView';
import { defaultData, sentinelData, uncoveredText } from '@/lib/content/testing';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), notFound: vi.fn() }));

const PREFIXES = ['yasgrubu.', 'ageGroups.', 'media.'];
const SLUGS = ['2-3-yas', '3-4-yas', '4-5-yas', '5-6-yas'];

describe('yasgrubu ziyaretçi HTML', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00+03:00'));
  });
  afterEach(() => vi.useRealTimers());

  it.each(SLUGS)('%s: düzenleme katmanından önceki hâliyle aynı', (slug) => {
    const { container } = render(<AgeGroupView data={defaultData(PREFIXES)} slug={slug} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it.each(SLUGS)('%s: ziyaretçiye düzenleme öznitelikleri gitmez', (slug) => {
    expect(render(<AgeGroupView data={defaultData(PREFIXES)} slug={slug} />).container.innerHTML).not.toContain('data-edit-');
  });

  it('düzenleme modunda grup alanları ve ortak etiketler işaretlenir', () => {
    const data = { ...defaultData(PREFIXES), editing: true };
    const { container } = render(<AgeGroupView data={data} slug="5-6-yas" />);
    for (const path of ['5-6-yas.ageLabel', '5-6-yas.headline', '5-6-yas.intro', '5-6-yas.focus1Title', '5-6-yas.focus4Text', '5-6-yas.highlight5']) {
      expect(container.querySelector(`[data-edit-key="ageGroups.items"][data-edit-path="${path}"]`), path).not.toBeNull();
    }
    for (const key of ['yasgrubu.classSize.label', 'yasgrubu.flow.title', 'yasgrubu.flow.cta', 'yasgrubu.cta.lead']) {
      expect(container.querySelector(`[data-edit-key="${key}"]`), key).not.toBeNull();
    }
    // Yaş etiketi ile birleşen başlıklar işaretsiz kalır.
    expect(container.querySelector('h2[data-edit-key]:not([data-edit-key="yasgrubu.flow.title"])')).toBeNull();
  });

  it.each(SLUGS)('%s: görünür her metin bir içerik alanından geliyor', (slug) => {
    const { container } = render(<AgeGroupView data={sentinelData(PREFIXES)} slug={slug} />);
    container.querySelectorAll('form').forEach((el) => el.remove());
    expect(uncoveredText(container)).toEqual([]);
  });
});
