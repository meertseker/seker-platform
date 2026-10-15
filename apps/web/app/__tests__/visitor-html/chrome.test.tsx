import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import MobileActionBar from '@/app/components/MobileActionBar';
import WhatsAppButton from '@/app/components/WhatsAppButton';
import LpHeader from '@/app/components/lp/LpHeader';
import LpFooter from '@/app/components/lp/LpFooter';

vi.mock('next/navigation', () => ({ usePathname: () => '/sss', useRouter: () => ({ push: vi.fn() }) }));

describe('site geneli kabuk ziyaretçi HTML', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00+03:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('Header', () => {
    expect(render(<Header />).container.innerHTML).toMatchSnapshot();
  });
  it('Footer', () => {
    expect(render(<Footer year={2026} />).container.innerHTML).toMatchSnapshot();
  });
  it('MobileActionBar', () => {
    expect(render(<MobileActionBar />).container.innerHTML).toMatchSnapshot();
  });
  it('WhatsAppButton', () => {
    expect(render(<WhatsAppButton />).container.innerHTML).toMatchSnapshot();
  });
  it('LpHeader', () => {
    expect(render(<LpHeader />).container.innerHTML).toMatchSnapshot();
  });
  it('LpFooter', () => {
    expect(render(<LpFooter />).container.innerHTML).toMatchSnapshot();
  });
});
