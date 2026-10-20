import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { CONSENT_KEY } from '@/lib/consent';
import { CONSENT_EVENT } from '@/lib/metaPixel';
import MetaPixel from '../MetaPixel';

// Betik gerçekten DOM'a girmez (ağ isteği hiç denenmez); eklenmek istenen öğeler burada toplanır.
let appended: HTMLScriptElement[] = [];
const pixelScripts = () => appended.filter((el) => el.src.includes('fbevents.js'));

beforeEach(() => {
  window.localStorage.clear();
  document.head.innerHTML = '';
  delete (window as unknown as { fbq?: unknown }).fbq;
  appended = [];
  vi.stubEnv('NEXT_PUBLIC_CONSENT_VERSION', '2');
  vi.spyOn(document.head, 'appendChild').mockImplementation(((node: Node) => {
    appended.push(node as HTMLScriptElement);
    return node;
  }) as typeof document.head.appendChild);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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
    // Otomatik Gelişmiş Eşleştirme init'ten önce kapatılır: piksel form alanlarını okumaz.
    expect(fbq.queue).toEqual([['set', 'autoConfig', false, '12345'], ['init', '12345'], ['track', 'PageView']]);
  });

  it('onay metni v1 iken kimlik dolu ve onay verilmiş olsa da yüklemez', () => {
    vi.stubEnv('NEXT_PUBLIC_CONSENT_VERSION', '1');
    vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', '12345');
    window.localStorage.setItem(CONSENT_KEY, 'granted');
    render(<MetaPixel />);
    expect(pixelScripts().length).toBe(0);
    expect((window as unknown as { fbq?: unknown }).fbq).toBeUndefined();
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
