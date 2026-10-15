import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import AgeGroupsIndexView from '@/app/(site)/yas-gruplari/AgeGroupsIndexView';
import { defaultData, sentinelData, uncoveredText } from '@/lib/content/testing';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), notFound: vi.fn() }));

const PREFIXES = ['yasgruplari.', 'meta.yasgruplari.', 'ageGroups.', 'media.'];

describe('yasgruplari ziyaretçi HTML', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00+03:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('düzenleme katmanından önceki hâliyle aynı', () => {
    const { container } = render(<AgeGroupsIndexView data={defaultData(PREFIXES)} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('ziyaretçiye düzenleme öznitelikleri gitmez', () => {
    expect(render(<AgeGroupsIndexView data={defaultData(PREFIXES)} />).container.innerHTML).not.toContain('data-edit-');
  });

  it('düzenleme modunda metinler ve liste işaretlenir', () => {
    const { container } = render(<AgeGroupsIndexView data={{ ...defaultData(PREFIXES), editing: true }} />);
    for (const key of ['yasgruplari.hero.title', 'yasgruplari.cta.lead']) {
      expect(container.querySelector(`[data-edit-key="${key}"]`), key).not.toBeNull();
    }
    expect(container.querySelector('[data-edit-list="ageGroups.items"]')).not.toBeNull();
    expect(container.querySelector('h2[data-edit-key="ageGroups.items"][data-edit-path="3-4-yas.title"]')).not.toBeNull();
  });

  it('görünür her metin bir içerik alanından geliyor', () => {
    const { container } = render(<AgeGroupsIndexView data={sentinelData(PREFIXES)} />);
    // Başvuru formu (LeadForm) bu görevin kapsamı değil.
    container.querySelectorAll('form').forEach((el) => el.remove());
    expect(uncoveredText(container)).toEqual([]);
  });
});
