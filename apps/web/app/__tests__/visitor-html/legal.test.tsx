import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import GizlilikPage from '@/app/(site)/gizlilik/page';
import KullanimPage from '@/app/(site)/kullanim/page';
import CerezPage from '@/app/(site)/cerez/page';

describe('yasal sayfalar ziyaretçi HTML', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00+03:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('gizlilik: düzenleme katmanından önceki hâliyle aynı', () => {
    expect(render(<GizlilikPage />).container.innerHTML).toMatchSnapshot();
  });
  it('kullanim: düzenleme katmanından önceki hâliyle aynı', () => {
    expect(render(<KullanimPage />).container.innerHTML).toMatchSnapshot();
  });
  it('cerez: düzenleme katmanından önceki hâliyle aynı', () => {
    expect(render(<CerezPage />).container.innerHTML).toMatchSnapshot();
  });
});
