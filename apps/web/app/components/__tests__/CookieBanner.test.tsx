import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CONSENT_KEY } from '@/lib/consent';
import CookieBanner from '../CookieBanner';

/**
 * Fix round 1/5 — the pure helper tests in lib/__tests__/consent.test.ts
 * exercise readConsent/buildConsentUpdate but never render CookieBanner, so
 * a gutted choose() (or a missing replay-on-mount effect) would still pass
 * the suite. These tests render the component itself and assert on the
 * gtag('consent','update', …) calls it produces, which is what a returning
 * visitor's browser actually needs to see.
 */

function storageWith(value: string | null) {
  const store: Record<string, string> = {};
  if (value !== null) store[CONSENT_KEY] = value;
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, val: string) => {
      store[key] = val;
    },
  } as unknown as Storage;
}

describe('CookieBanner', () => {
  let gtag: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    gtag = vi.fn();
    window.gtag = gtag as unknown as (...args: unknown[]) => void;
  });

  afterEach(() => {
    cleanup();
    delete window.gtag;
  });

  it('kayıt yokken bandı gösterir ve seçim yapılana kadar update göndermez', () => {
    Object.defineProperty(window, 'localStorage', { value: storageWith(null), configurable: true });

    render(<CookieBanner />);

    expect(screen.getByRole('dialog', { name: 'Çerez tercihi' })).toBeDefined();
    expect(gtag).not.toHaveBeenCalled();
  });

  it('daha önce onay verilmişse bandı gizler ve granted sinyalini tekrar gönderir', () => {
    Object.defineProperty(window, 'localStorage', { value: storageWith('granted'), configurable: true });

    render(<CookieBanner />);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(gtag).toHaveBeenCalledWith('consent', 'update', {
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'granted',
    });
  });

  it('daha önce reddedilmişse bandı gizler ve denied sinyalini tekrar gönderir', () => {
    Object.defineProperty(window, 'localStorage', { value: storageWith('denied'), configurable: true });

    render(<CookieBanner />);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(gtag).toHaveBeenCalledWith('consent', 'update', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
    });
  });

  it('"Kabul Et" tıklanınca granted güncellemesi gönderilir ve bant kapanır', () => {
    Object.defineProperty(window, 'localStorage', { value: storageWith(null), configurable: true });

    render(<CookieBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Kabul Et' }));

    expect(gtag).toHaveBeenCalledWith('consent', 'update', {
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'granted',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('"Reddet" tıklanınca denied güncellemesi gönderilir ve bant kapanır', () => {
    Object.defineProperty(window, 'localStorage', { value: storageWith(null), configurable: true });

    render(<CookieBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Reddet' }));

    expect(gtag).toHaveBeenCalledWith('consent', 'update', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
