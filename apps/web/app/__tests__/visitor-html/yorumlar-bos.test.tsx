import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import Page from '@/app/(site)/veli-yorumlari/page';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
// Yayında yorum yokken görünen boş durum.
vi.mock('@/content/testimonials', () => ({ TESTIMONIALS: [], PUBLISHED_TESTIMONIALS: [] }));

describe('yorumlar (boş durum) ziyaretçi HTML', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00+03:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('düzenleme katmanından önceki hâliyle aynı', () => {
    const { container } = render(<Page />);
    expect(container.innerHTML).toMatchSnapshot();
  });
});
