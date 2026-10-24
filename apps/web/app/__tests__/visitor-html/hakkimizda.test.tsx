import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import HakkimizdaView from '@/app/(site)/hakkimizda/HakkimizdaView';
import TrustBar from '@/app/components/TrustBar';
import { defaultData, sentinelData, uncoveredText } from '@/lib/content/testing';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const PREFIXES = ['hakkimizda.', 'meta.hakkimizda.', 'guvenlik.', 'media.'];
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
      'hakkimizda.hero.title', 'hakkimizda.values.title', 'hakkimizda.visit.lead',
      'guvenlik.hero.eyebrow', 'guvenlik.hero.title',
    ]) {
      expect(container.querySelector(`[data-edit-key="${key}"]`), key).not.toBeNull();
    }
    for (const list of ['hakkimizda.facts', 'hakkimizda.values', 'guvenlik.sections']) {
      expect(container.querySelector(`[data-edit-list="${list}"]`), list).not.toBeNull();
    }
    expect(container.querySelector('p[data-edit-key="hakkimizda.facts"][data-edit-path="yil.value"]')).not.toBeNull();
    expect(container.querySelector('h3[data-edit-key="hakkimizda.values"][data-edit-path="guven.title"]')).not.toBeNull();
    expect(container.querySelector('h3[data-edit-key="guvenlik.sections"][data-edit-path="mutfak.title"]')).not.toBeNull();
  });

  it('bölüm sırası: künye → değerler → güvenlik (#guvenlik çapası) → ziyaret formu', () => {
    const { container } = render(<HakkimizdaView data={{ ...defaultData(PREFIXES), editing: true }} />);
    const order = ['[data-edit-list="hakkimizda.facts"]', '[data-edit-list="hakkimizda.values"]', 'section#guvenlik', 'form']
      .map((sel) => container.querySelector(sel));
    order.forEach((el, i) => expect(el, String(i)).not.toBeNull());
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(container.querySelector('section#guvenlik [data-edit-list="guvenlik.sections"]')).not.toBeNull();
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
