import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import EgitimView from '@/app/(site)/egitim-yaklasimimiz/EgitimView';
import { defaultData, sentinelData, uncoveredText } from '@/lib/content/testing';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const PREFIXES = ['egitim.', 'meta.egitim.', 'program.', 'faq.', 'media.'];

describe('egitim ziyaretçi HTML', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00+03:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('düzenleme katmanından önceki hâliyle aynı', () => {
    const { container } = render(<EgitimView data={defaultData(PREFIXES)} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('ziyaretçiye düzenleme öznitelikleri gitmez', () => {
    const { container } = render(<EgitimView data={defaultData(PREFIXES)} />);
    expect(container.innerHTML).not.toContain('data-edit-');
  });

  it('düzenleme modunda metinler ve listeler işaretlenir; birleşik branş paragrafı işaretsiz kalır', () => {
    const data = { ...defaultData(PREFIXES), editing: true };
    const { container } = render(<EgitimView data={data} />);
    for (const key of ['egitim.hero.title', 'egitim.english.title', 'egitim.ages.note', 'egitim.cta.lead']) {
      expect(container.querySelector(`[data-edit-key="${key}"]`), key).not.toBeNull();
    }
    for (const list of ['egitim.sections', 'egitim.english.tracks', 'egitim.ages.items']) {
      expect(container.querySelector(`[data-edit-list="${list}"]`), list).not.toBeNull();
    }
    expect(container.querySelector('h2[data-edit-key="egitim.sections"][data-edit-path="montessori.question"]')).not.toBeNull();
    expect(container.querySelector('p[data-edit-key="egitim.sections"][data-edit-path="brans.p1"]')).not.toBeNull();
    expect(container.querySelector('p[data-edit-key="egitim.sections"][data-edit-path="brans.p2"]')).toBeNull();
    // Boş p4 basılmaz.
    expect(container.querySelector('[data-edit-path="planlama.p4"]')).toBeNull();
  });

  it('görünür her metin bir içerik alanından geliyor', () => {
    const { container } = render(<EgitimView data={sentinelData(PREFIXES)} />);
    // Başvuru formu (LeadForm) bu görevin kapsamı değil.
    container.querySelectorAll('form').forEach((el) => el.remove());
    expect(uncoveredText(container)).toEqual([]);
  });
});
