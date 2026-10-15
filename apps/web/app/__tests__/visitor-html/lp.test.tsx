import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import LandingPageRoute from '@/app/(lp)/lp/[slug]/page';
import { LANDING_SLUGS } from '@/content/landingPages';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), notFound: vi.fn() }));
vi.mock('@/lib/time', async (orig) => ({ ...(await orig<typeof import('@/lib/time')>()), currentYear: async () => 2026 }));

describe('reklam sayfaları ziyaretçi HTML', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00+03:00'));
  });
  afterEach(() => vi.useRealTimers());

  it.each(LANDING_SLUGS)('%s: düzenleme katmanından önceki hâliyle aynı', async (slug) => {
    const ui = await LandingPageRoute({ params: Promise.resolve({ slug }) });
    const { container } = render(ui);
    expect(container.innerHTML).toMatchSnapshot();
  });
});
