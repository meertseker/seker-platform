import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { LandingFields } from '@seker/shared/landing';
import LandingView from '@/app/(lp)/lp/[slug]/LandingView';
import { DB_PAGE_DEFAULTS } from '@/content/landingPages';
import { makeReader } from '@/lib/content/reader';
import { defaultData } from '@/lib/content/testing';
import { landingReaderData } from '../readerData';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), notFound: vi.fn() }));

const SLUG = 'ilk-hafta-uyum';
const BASE_PREFIXES = ['lp.common.', 'testimonials.', 'form.'];

const fields: LandingFields = {
  h1: 'İlk hafta uyum nasıl geçer',
  subhead: 'Uyum haftasını çocuğunuzun temposunda planlıyoruz.',
  bodyBlocks: [
    { heading: 'İlk gün', text: 'Birlikte geliyorsunuz.' },
    { heading: 'İkinci gün', text: 'Kısa bir ayrılık deniyoruz.' },
  ],
  mediaKey: null,
  adPrimaryText: 'Reklam metni',
  adHeadline: 'Reklam başlığı',
  metaTitle: 'İlk hafta uyum | Şeker Anaokulu',
  metaDescription: 'Uyum haftası nasıl geçer.',
};

describe('landingReaderData', () => {
  it('sayfa alanlarını lp.<slug>.* anahtarlarına yazar', () => {
    const data = landingReaderData(defaultData(BASE_PREFIXES), SLUG, fields);
    const c = makeReader(data);
    expect(c.text(`lp.${SLUG}.h1`)).toBe(fields.h1);
    expect(c.text(`lp.${SLUG}.subhead`)).toBe(fields.subhead);
    expect(c.text(`lp.${SLUG}.metaTitle`)).toBe(fields.metaTitle);
    expect(c.text(`lp.${SLUG}.metaDescription`)).toBe(fields.metaDescription);
    expect(c.text(`lp.${SLUG}.formHeading`)).toBe(DB_PAGE_DEFAULTS.formHeading);
    expect(c.text(`lp.${SLUG}.formIntro`)).toBe(DB_PAGE_DEFAULTS.formIntro);
  });

  it('listeler p/b/f kimlikleriyle gelir; rakamlar ve SSS kod sabitlerinden', () => {
    const c = makeReader(landingReaderData(defaultData(BASE_PREFIXES), SLUG, fields));
    const blocks = c.list(`lp.${SLUG}.bodyBlocks`);
    expect(blocks).toHaveLength(2);
    expect(blocks.map((b) => b.id)).toEqual(['b1', 'b2']);
    expect(blocks[0]).toMatchObject({ heading: 'İlk gün', text: 'Birlikte geliyorsunuz.' });
    const proof = c.list(`lp.${SLUG}.proofPoints`);
    expect(proof).toHaveLength(DB_PAGE_DEFAULTS.proofPoints.length);
    expect(proof[0].id).toBe('p1');
    const faq = c.list(`lp.${SLUG}.faq`);
    expect(faq).toHaveLength(DB_PAGE_DEFAULTS.faq.length);
    expect(faq.map((f) => f.id)).toEqual(DB_PAGE_DEFAULTS.faq.map((_, i) => `f${i + 1}`));
  });

  it('mediaKey yoksa bahçe atölyeleri görseli; varsa seçilen görsel', () => {
    const none = makeReader(landingReaderData(defaultData(BASE_PREFIXES), SLUG, fields));
    expect(none.image(`lp.${SLUG}.media`)).toMatchObject({ src: '/bahce-atolyeler.webp', assetId: null });
    const wide = makeReader(landingReaderData(defaultData(BASE_PREFIXES), SLUG, { ...fields, mediaKey: 'gardenWide' }));
    expect(wide.image(`lp.${SLUG}.media`).src).toBe('/bahce-genis.webp');
  });

  it('taban veri düzenleme modunda olsa da sonuç düzenlenemez (meta ve updatedAt boş)', () => {
    const base = { ...defaultData(BASE_PREFIXES), editing: true, updatedAt: { 'lp.common.ctaPrimary': '2026-10-01' } };
    const data = landingReaderData(base, SLUG, fields);
    expect(data.editing).toBe(false);
    expect(data.meta).toEqual({});
    expect(data.updatedAt).toEqual({});
  });

  it('LandingView ile hatasız render edilir, düzenleme özniteliği sızmaz', () => {
    const base = { ...defaultData(BASE_PREFIXES), editing: true };
    const { container } = render(<LandingView slug={SLUG} data={landingReaderData(base, SLUG, fields)} />);
    expect(container.querySelector('h1')?.textContent).toBe(fields.h1);
    expect(container.innerHTML).not.toContain('data-edit-');
    expect(container.textContent).toContain('Kısa bir ayrılık deniyoruz.');
  });
});
