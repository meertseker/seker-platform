import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import EgitimView from '@/app/(site)/egitim-yaklasimimiz/EgitimView';
import { defaultData, sentinelData, uncoveredText } from '@/lib/content/testing';
import { SLOTS } from '@/lib/content/registry';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const PREFIXES = ['egitim.', 'meta.egitim.', 'program.', 'faq.', 'ageGroups.', 'media.'];

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

  it('düzenleme modunda metinler ve listeler işaretlenir; branş paragrafında giriş cümlesi düzenlenir', () => {
    const data = { ...defaultData(PREFIXES), editing: true };
    const { container } = render(<EgitimView data={data} />);
    for (const key of ['egitim.hero.title', 'egitim.english.title', 'egitim.ages.note', 'egitim.cta.lead']) {
      expect(container.querySelector(`[data-edit-key="${key}"]`), key).not.toBeNull();
    }
    for (const list of ['egitim.sections', 'egitim.english.tracks', 'ageGroups.items']) {
      expect(container.querySelector(`[data-edit-list="${list}"]`), list).not.toBeNull();
    }
    expect(container.querySelector('h2[data-edit-key="egitim.sections"][data-edit-path="montessori.question"]')).not.toBeNull();
    expect(container.querySelector('p[data-edit-key="egitim.sections"][data-edit-path="brans.p1"]')).not.toBeNull();
    expect(container.querySelector('p[data-edit-key="egitim.sections"][data-edit-path="brans.p2"]')).toBeNull();
    // Giriş cümlesi paragrafın içinde ayrı işaretli alan; türetilen branş adları onun dışında kalır.
    const intro = container.querySelector('span[data-edit-key="egitim.sections"][data-edit-path="brans.p2"]');
    expect(intro?.textContent).toBe('Programımızda şu çalışmalar yer alıyor:');
    expect(intro?.parentElement?.tagName).toBe('P');
    expect(intro?.parentElement?.textContent).toMatch(/^Programımızda şu çalışmalar yer alıyor: .+\.$/);
    const visitorBrans = render(<EgitimView data={defaultData(PREFIXES)} />).container;
    expect(visitorBrans.innerHTML).toContain('<p>Programımızda şu çalışmalar yer alıyor: ');
    // Boş p4 düzenlemede boş ve işaretli basılır (yeniden yazılabilsin); ziyaretçide basılmaz.
    const empty = container.querySelector('p[data-edit-path="planlama.p4"]');
    expect(empty?.textContent).toBe('');
    expect(empty?.getAttribute('data-edit-optional')).toBe('1');
    const visitor = render(<EgitimView data={defaultData(PREFIXES)} />).container;
    expect([...visitor.querySelectorAll('.space-y-4 > p')].filter((p) => !p.textContent?.trim())).toHaveLength(0);
  });

  it('yaş kartlarının metinleri ageGroups.items listesinin izdüşümüdür', () => {
    const data = defaultData(PREFIXES);
    const { container } = render(<EgitimView data={data} />);
    const groups = data.values['ageGroups.items'] as { id: string; ageLabel: string; groupName: string }[];
    const cards = [...container.querySelectorAll('a[href^="/yas-gruplari/"]')];
    expect(cards.map((a) => a.getAttribute('href'))).toEqual(groups.map((g) => `/yas-gruplari/${g.id}`));
    expect(cards.map((a) => [...a.querySelectorAll('p')].map((p) => p.textContent))).toEqual(
      groups.map((g) => [g.ageLabel, g.groupName]),
    );
    expect(SLOTS['egitim.ages.items']).toBeUndefined();
  });

  it('görünür her metin bir içerik alanından geliyor', () => {
    const { container } = render(<EgitimView data={sentinelData(PREFIXES)} />);
    // Başvuru formu (LeadForm) bu görevin kapsamı değil.
    container.querySelectorAll('form').forEach((el) => el.remove());
    expect(uncoveredText(container)).toEqual([]);
  });
});
