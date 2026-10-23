import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import LandingView from '@/app/(lp)/lp/[slug]/LandingView';
import { defaultData } from '@/lib/content/testing';

vi.mock('@/lib/content/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/content/server')>();
  return { ...actual, getReaderData: async () => actual.buildReaderData({}, false, 2026) };
});
const getPreviewLandingPage = vi.fn<(token: string) => Promise<unknown>>(async () => null);
vi.mock('@/lib/landing/db', () => ({ getPreviewLandingPage: (token: string) => getPreviewLandingPage(token) }));
vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/navigation')>();
  return { ...actual, useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }) };
});

import PreviewRoute, { generateMetadata } from '../page';

const TOKEN = 'A'.repeat(43);
const params = (token: string) => ({ params: Promise.resolve({ token }) });
const FIELDS = {
  h1: 'Önizlenen başlık',
  subhead: 'Alt başlık',
  bodyBlocks: [{ heading: 'Blok', text: 'Metin' }],
  mediaKey: null,
  adPrimaryText: '',
  adHeadline: '',
  metaTitle: 'Önizlenen başlık',
  metaDescription: 'Alt başlık',
};

describe('/lp/onizleme/[token]', () => {
  it('geçerli token: başlık, önizleme notu ve kapalı form', async () => {
    getPreviewLandingPage.mockResolvedValueOnce({ status: 'taslak', fields: FIELDS });
    const { container } = render(await PreviewRoute(params(TOKEN)));
    expect(getPreviewLandingPage).toHaveBeenCalledWith(TOKEN);
    expect(container.querySelector('h1')?.textContent).toBe(FIELDS.h1);
    expect(container.querySelector('[role="note"]')?.textContent).toBe('Önizleme · bu form gönderilmez');
    const fieldset = container.querySelector('#form fieldset[disabled]');
    expect(fieldset).not.toBeNull();
    expect(fieldset?.querySelector('input[name="phone"]')).not.toBeNull();
    expect(container.innerHTML).not.toContain('data-edit-');
  });

  it('bozuk ya da bulunmayan token: notFound()', async () => {
    getPreviewLandingPage.mockResolvedValueOnce(null);
    await expect(PreviewRoute(params('kisa'))).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK/);
  });

  it('generateMetadata: dizine eklenmez', async () => {
    const metadata = await generateMetadata();
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.title).toBe('Önizleme');
    expect(metadata.referrer).toBe('no-referrer');
  });

  it('formDisabled verilmeyen LandingView önizleme notu ve fieldset içermez', () => {
    const { container } = render(<LandingView slug="beykent-anaokulu" data={defaultData()} />);
    expect(container.querySelector('[role="note"]')).toBeNull();
    expect(container.innerHTML).not.toContain('Önizleme');
    expect(container.querySelector('fieldset[disabled]')).toBeNull();
  });
});
