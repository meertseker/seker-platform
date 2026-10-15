import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import YorumlarView from '@/app/(site)/veli-yorumlari/YorumlarView';
import { defaultData, sentinelData, uncoveredText } from '@/lib/content/testing';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const PREFIXES = ['yorumlar.', 'meta.yorumlar.', 'testimonials.'];

describe('yorumlar ziyaretçi HTML', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00+03:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('düzenleme katmanından önceki hâliyle aynı', () => {
    const { container } = render(<YorumlarView data={defaultData(PREFIXES)} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('ziyaretçiye düzenleme öznitelikleri gitmez', () => {
    expect(render(<YorumlarView data={defaultData(PREFIXES)} />).container.innerHTML).not.toContain('data-edit-');
  });

  it('düzenleme modunda metinler, yorum listesi, yazar ve kaynak işaretlenir', () => {
    const { container } = render(<YorumlarView data={{ ...defaultData(PREFIXES), editing: true }} />);
    for (const key of ['yorumlar.hero.title', 'yorumlar.share.title', 'yorumlar.share.cta', 'yorumlar.source.google']) {
      expect(container.querySelector(`[data-edit-key="${key}"]`), key).not.toBeNull();
    }
    expect(container.querySelector('[data-edit-list="testimonials.items"]')).not.toBeNull();
    expect(container.querySelector('span[data-edit-key="testimonials.items"][data-edit-path="muge-ilkokul-olsa.author"]')).not.toBeNull();
    // Alıntı tırnaklarla aynı elemanda basılıyor: işaretsiz (liste panelinden düzenlenir).
    expect(container.querySelector('blockquote[data-edit-key]')).toBeNull();
  });

  it('yayında olmayan yorum basılmaz', () => {
    const data = defaultData(PREFIXES);
    data.values['testimonials.items'] = (data.values['testimonials.items'] as { ready: boolean }[]).map((i, n) => ({ ...i, ready: n !== 0 }));
    const { container } = render(<YorumlarView data={data} />);
    expect(container.querySelectorAll('figure')).toHaveLength(9);
  });

  it('görünür her metin bir içerik alanından geliyor', () => {
    const { container } = render(<YorumlarView data={sentinelData(PREFIXES)} />);
    expect(uncoveredText(container)).toEqual([]);
  });

  it('boş durum: metinler ve düğme içerik alanından geliyor', () => {
    const data = sentinelData(PREFIXES);
    data.values['testimonials.items'] = [];
    const { container } = render(<YorumlarView data={{ ...data, editing: true }} />);
    expect(container.querySelector('[data-edit-key="yorumlar.empty.cta"]')).not.toBeNull();
    expect(uncoveredText(container)).toEqual([]);
  });
});
