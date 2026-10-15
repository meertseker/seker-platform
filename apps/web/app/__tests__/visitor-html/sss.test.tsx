import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import Page from '@/app/(site)/sss/page';

describe('sss ziyaretçi HTML', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00+03:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('düzenleme katmanından önceki hâliyle aynı', () => {
    const { container } = render(<Page />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('tüm cevaplar açıkken aynı', () => {
    const { container } = render(<Page />);
    container.querySelectorAll('button').forEach((b) => fireEvent.click(b));
    expect(container.innerHTML).toMatchSnapshot();
  });
});
