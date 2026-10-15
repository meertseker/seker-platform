import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import GunlukAkisView from '@/app/(site)/gunluk-akis/GunlukAkisView';
import { defaultData, sentinelData, uncoveredText } from '@/lib/content/testing';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), notFound: vi.fn() }));

const PREFIXES = ['gunlukakis.', 'meta.gunlukakis.', 'day.', 'media.'];

describe('gunlukakis ziyaretçi HTML', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00+03:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('düzenleme katmanından önceki hâliyle aynı', () => {
    const { container } = render(<GunlukAkisView data={defaultData(PREFIXES)} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('ziyaretçiye düzenleme öznitelikleri gitmez', () => {
    expect(render(<GunlukAkisView data={defaultData(PREFIXES)} />).container.innerHTML).not.toContain('data-edit-');
  });

  it('düzenleme modunda metinler, sahne listesi ve fotoğraflar işaretlenir', () => {
    const { container } = render(<GunlukAkisView data={{ ...defaultData(PREFIXES), editing: true }} />);
    for (const key of ['gunlukakis.hero.title', 'gunlukakis.plan.full.hours', 'gunlukakis.cta.lead']) {
      expect(container.querySelector(`[data-edit-key="${key}"]`), key).not.toBeNull();
    }
    expect(container.querySelector('[data-edit-list="day.chapters"]')).not.toBeNull();
    for (const path of ['karsilama.title', 'karsilama.lead', 'karsilama.body1', 'karsilama.body2', 'bahce.body2']) {
      const hit = container.querySelector(`[data-edit-key="day.chapters"][data-edit-path="${path}"]`);
      // kapanis dışında hepsinin 2. paragrafı var; yalnızca kapanis.body2 boş ve basılmaz.
      expect(hit, path).not.toBeNull();
    }
    expect(container.querySelector('[data-edit-path="kapanis.body2"]')).toBeNull();
    expect(container.querySelector('[data-edit-key="media.giraffesGarden"]')).not.toBeNull();
    // Kenar çubuğundaki başlık aynaları işaretsiz: aynı alan iki kez işaretlenmez.
    expect(container.querySelectorAll('[data-edit-path="karsilama.title"]')).toHaveLength(1);
  });

  it('görünür her metin bir içerik alanından geliyor', () => {
    const { container } = render(<GunlukAkisView data={sentinelData(PREFIXES)} />);
    container.querySelectorAll('form').forEach((el) => el.remove());
    expect(uncoveredText(container)).toEqual([]);
  });
});
