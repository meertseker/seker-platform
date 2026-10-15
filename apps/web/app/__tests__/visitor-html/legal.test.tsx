import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import LegalView from '@/app/(site)/LegalView';
import { defaultData, sentinelData, uncoveredText } from '@/lib/content/testing';
import { kvkkToHtml } from '@/lib/content/slots/legal';
import { KVKK_TEXT } from '@/content/kvkk';

const PAGES = ['gizlilik', 'kullanim', 'cerez'] as const;
const prefixes = (p: string) => ['legal.', `meta.${p}.`];

describe('yasal sayfalar ziyaretçi HTML', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00+03:00'));
  });
  afterEach(() => vi.useRealTimers());

  it.each(PAGES)('%s: düzenleme katmanından önceki hâliyle aynı', (p) => {
    const { container } = render(<LegalView data={defaultData(prefixes(p))} page={p} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it.each(PAGES)('%s: ziyaretçiye düzenleme öznitelikleri gitmez', (p) => {
    expect(render(<LegalView data={defaultData(prefixes(p))} page={p} />).container.innerHTML).not.toContain('data-edit-');
  });

  it.each(PAGES)('%s: görünür her metin bir içerik alanından geliyor', (p) => {
    const { container } = render(<LegalView data={sentinelData(prefixes(p))} page={p} />);
    expect(uncoveredText(container)).toEqual([]);
  });

  it('düzenleme modunda başlık ve gövde işaretlenir', () => {
    const { container } = render(<LegalView data={{ ...defaultData(prefixes('kullanim')), editing: true }} page="kullanim" />);
    for (const key of ['legal.kullanim.title', 'legal.kullanim.body', 'legal.common.contactCta']) {
      expect(container.querySelector(`[data-edit-key="${key}"]`), key).not.toBeNull();
    }
  });

  it('gizlilik varsayılanı tam KVKK metnidir, yer tutucu değil', () => {
    const html = kvkkToHtml(KVKK_TEXT);
    expect(html).not.toContain('hazırlanmaktadır');
    expect(html).toContain('<h2>KVKK md. 11 kapsamındaki haklarınız</h2>');
    expect(html).toContain('Google');
  });

  it('gizlilikte iletişim düğmesi yok, güncelleme satırı var', () => {
    const { container } = render(<LegalView data={defaultData(prefixes('gizlilik'))} page="gizlilik" />);
    expect(container.querySelector('a[href="/iletisim"]')).toBeNull();
    expect(container.textContent).toContain(`Son güncelleme: ${KVKK_TEXT.updatedOn}`);
  });
});
