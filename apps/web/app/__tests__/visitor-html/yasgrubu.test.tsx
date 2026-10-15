import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), notFound: vi.fn() }));

import Page from '@/app/(site)/yas-gruplari/[slug]/page';

const SLUGS = ['2-3-yas', '3-4-yas', '4-5-yas', '5-6-yas'];

describe('yasgrubu ziyaretçi HTML', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00+03:00'));
  });
  afterEach(() => vi.useRealTimers());

  it.each(SLUGS)('%s: düzenleme katmanından önceki hâliyle aynı', async (slug) => {
    const { container } = render(await Page({ params: Promise.resolve({ slug }) }));
    expect(container.innerHTML).toMatchSnapshot();
  });
});
