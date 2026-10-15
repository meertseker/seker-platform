import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import Page from '@/app/(site)/iletisim/page';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/content/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/content/server')>();
  return { ...actual, getReaderData: async () => actual.buildReaderData({}, false, new Date().getFullYear()) };
});

describe('iletisim ziyaretçi HTML', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00+03:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('düzenleme katmanından önceki hâliyle aynı', async () => {
    const { container } = render(await Page());
    expect(container.innerHTML).toMatchSnapshot();
  });
});
