import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import Page from '@/app/(site)/hakkimizda/page';
import TrustBar from '@/app/components/TrustBar';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/time', async (orig) => ({ ...(await orig<typeof import('@/lib/time')>()), currentYear: async () => 2026 }));

describe('hakkimizda ziyaretçi HTML', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00+03:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('düzenleme katmanından önceki hâliyle aynı', async () => {
    const { container } = render(await Page());
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('TrustBar: düzenleme katmanından önceki hâliyle aynı', () => {
    const { container } = render(<TrustBar />);
    expect(container.innerHTML).toMatchSnapshot();
  });
});
