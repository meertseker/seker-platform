import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import HakkimizdaView from '@/app/(site)/hakkimizda/HakkimizdaView';
import TrustBar from '@/app/components/TrustBar';
import { defaultData, sentinelData, uncoveredText } from '@/lib/content/testing';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const PREFIXES = ['hakkimizda.', 'meta.hakkimizda.', 'about.', 'media.'];
const TRUST = ['trust.'];

describe('hakkimizda ziyaretçi HTML', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00+03:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('düzenleme katmanından önceki hâliyle aynı', () => {
    const { container } = render(<HakkimizdaView data={defaultData(PREFIXES)} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('TrustBar: düzenleme katmanından önceki hâliyle aynı', () => {
    const { container } = render(<TrustBar data={defaultData(TRUST)} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('ziyaretçiye düzenleme öznitelikleri gitmez', () => {
    expect(render(<HakkimizdaView data={defaultData(PREFIXES)} />).container.innerHTML).not.toContain('data-edit-');
    expect(render(<TrustBar data={defaultData(TRUST)} />).container.innerHTML).not.toContain('data-edit-');
  });

  it('düzenleme modunda metinler, listeler ve fotoğraflar işaretlenir', () => {
    const data = { ...defaultData(PREFIXES), editing: true };
    const { container } = render(<HakkimizdaView data={data} />);
    for (const key of [
      'hakkimizda.hero.title', 'hakkimizda.psychologist.lead', 'hakkimizda.visit.lead',
      'about.garden.title', 'about.garden.button', 'about.staff.description',
      'media.gardenWide', 'media.mudKitchenSmall', 'media.gardenWorkshops',
    ]) {
      expect(container.querySelector(`[data-edit-key="${key}"]`), key).not.toBeNull();
    }
    for (const list of ['hakkimizda.facts', 'hakkimizda.values']) {
      expect(container.querySelector(`[data-edit-list="${list}"]`), list).not.toBeNull();
    }
    expect(container.querySelector('p[data-edit-key="hakkimizda.facts"][data-edit-path="yil.value"]')).not.toBeNull();
    expect(container.querySelector('h3[data-edit-key="hakkimizda.values"][data-edit-path="guven.title"]')).not.toBeNull();
  });

  it('TrustBar: düzenleme modunda etiketler işaretlenir; sınıf mevcudu rakamları kodda kalır', () => {
    const { container } = render(<TrustBar data={{ ...defaultData(TRUST), editing: true }} />);
    expect(container.querySelector('[data-edit-key="trust.english.label"]')).not.toBeNull();
    expect(container.querySelector('[data-edit-key="trust.years.value"]')).not.toBeNull();
  });

  it('görünür her metin bir içerik alanından geliyor', () => {
    const { container } = render(<HakkimizdaView data={sentinelData(PREFIXES)} />);
    // Başvuru formu (LeadForm) bu görevin kapsamı değil.
    container.querySelectorAll('form').forEach((el) => el.remove());
    expect(uncoveredText(container)).toEqual([]);
  });

  it('TrustBar: görünür her metin bir içerik alanından geliyor', () => {
    const { container } = render(<TrustBar data={sentinelData(TRUST)} />);
    expect(uncoveredText(container)).toEqual([]);
  });
});
