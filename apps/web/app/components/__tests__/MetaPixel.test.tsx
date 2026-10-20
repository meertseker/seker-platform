import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { CONSENT_KEY } from '@/lib/consent';
import { CONSENT_EVENT } from '@/lib/metaPixel';
import MetaPixel from '../MetaPixel';

const pixelScripts = () => document.querySelectorAll('script[src*="fbevents.js"]');

beforeEach(() => {
  window.localStorage.clear();
  document.head.innerHTML = '';
  delete (window as unknown as { fbq?: unknown }).fbq;
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('MetaPixel', () => {
  it('kimlik boşken hiçbir şey çizmez ve betik eklemez', () => {
    vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', '');
    window.localStorage.setItem(CONSENT_KEY, 'granted');
    const { container } = render(<MetaPixel />);
    expect(container.innerHTML).toBe('');
    expect(pixelScripts().length).toBe(0);
    expect((window as unknown as { fbq?: unknown }).fbq).toBeUndefined();
  });

  it('onay yokken betik eklemez; onay olayı gelince bir kez ekler', () => {
    vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', '12345');
    render(<MetaPixel />);
    expect(pixelScripts().length).toBe(0);

    window.localStorage.setItem(CONSENT_KEY, 'granted');
    act(() => {
      window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: 'granted' }));
      window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: 'granted' }));
    });
    expect(pixelScripts().length).toBe(1);
    const fbq = (window as unknown as { fbq: { queue: unknown[][] } }).fbq;
    expect(fbq.queue).toEqual([['init', '12345'], ['track', 'PageView']]);
  });

  it('red olayında yüklemez', () => {
    vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', '12345');
    render(<MetaPixel />);
    window.localStorage.setItem(CONSENT_KEY, 'denied');
    act(() => {
      window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: 'denied' }));
    });
    expect(pixelScripts().length).toBe(0);
  });

  it('onay daha önce verilmişse ilk yüklemede ekler, yeniden bağlanınca ikilemez', () => {
    vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', '12345');
    window.localStorage.setItem(CONSENT_KEY, 'granted');
    render(<MetaPixel />);
    cleanup();
    render(<MetaPixel />);
    expect(pixelScripts().length).toBe(1);
  });
});
