import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { ATTRIBUTION_KEY } from '@/lib/attribution';
import AttributionFields from '../AttributionFields';

/**
 * lib/__tests__/attribution.test.ts yalnızca saf persistAttribution
 * fonksiyonunu test eder. Bu dosya asıl davranışı — bileşenin gerçek
 * navigasyon sırasında ilk dokunuşu koruyup korumadığını — sınar: veli
 * reklamdan /lp/... sayfasına iniyor (gclid'li), sonra /kayit'e gidiyor
 * (gclid'siz) ve orada formu dolduruyor. sessionStorage aynı sekmede
 * kaldığı için happy-dom'da sayfa geçişleri arası paylaşılır — gerçek
 * tarayıcı davranışını taklit eder.
 */

function hiddenValue(container: HTMLElement, name: string): string {
  const input = container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!input) throw new Error(`${name} input bulunamadı`);
  return input.value;
}

describe('AttributionFields — ilk dokunuş navigasyonu', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
  });

  it('reklamdan /lp/...?gclid=... sayfasına inip gclid\'siz /kayit\'e geçince gclid ve landing path korunur', async () => {
    // 1. dokunuş: reklamdan LP'ye iniş.
    window.happyDOM.setURL('https://example.com/lp/az-mevcutlu-anaokulu?gclid=Cj0ABC123');
    const first = render(<AttributionFields />);

    await waitFor(() => {
      expect(hiddenValue(first.container, 'gclid')).toBe('Cj0ABC123');
    });
    expect(hiddenValue(first.container, 'landingPath')).toBe('/lp/az-mevcutlu-anaokulu');
    expect(window.sessionStorage.getItem(ATTRIBUTION_KEY)).toBe(
      JSON.stringify({ gclid: 'Cj0ABC123', landingPath: '/lp/az-mevcutlu-anaokulu', utm: {} }),
    );
    first.unmount();

    // 2. dokunuş: aynı sekmede /kayit'e geçiş, gclid parametresi yok.
    window.happyDOM.setURL('https://example.com/kayit');
    const second = render(<AttributionFields />);

    await waitFor(() => {
      expect(hiddenValue(second.container, 'gclid')).toBe('Cj0ABC123');
    });
    // Landing path da ilk dokunuştan gelmeye devam eder — /kayit ile ezilmez.
    expect(hiddenValue(second.container, 'landingPath')).toBe('/lp/az-mevcutlu-anaokulu');
  });

  it('gclid hiç gelmediyse (organik ziyaretçi) form yine boş değerlerle sorunsuz render olur', async () => {
    window.happyDOM.setURL('https://example.com/kayit');
    const { container } = render(<AttributionFields />);

    await waitFor(() => {
      expect(hiddenValue(container, 'landingPath')).toBe('/kayit');
    });
    expect(hiddenValue(container, 'gclid')).toBe('');
  });

  it('sessionStorage erişimi çökerse (gizli mod) bileşen hata fırlatmadan render olmaya devam eder', async () => {
    window.happyDOM.setURL('https://example.com/lp/az-mevcutlu-anaokulu?gclid=WONTPERSIST');
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw new DOMException('erişim engellendi', 'SecurityError');
      },
    });

    try {
      expect(() => render(<AttributionFields />)).not.toThrow();
      // Attribution kaybedilir ama alanlar hâlâ boş string olarak mevcuttur —
      // form yine de gönderilebilir.
      const { container } = render(<AttributionFields />);
      await waitFor(() => {
        expect(hiddenValue(container, 'gclid')).toBe('');
      });
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(window, 'sessionStorage', originalDescriptor);
      }
    }
  });

  it('utm parametreleri gizli alanlara yazılır ve sonraki sayfada korunur', async () => {
    window.happyDOM.setURL('https://example.com/lp/kres-2-yas?utm_source=google&utm_campaign=kres');
    const first = render(<AttributionFields />);
    await waitFor(() => {
      expect(hiddenValue(first.container, 'utm_campaign')).toBe('kres');
    });
    expect(hiddenValue(first.container, 'utm_source')).toBe('google');
    expect(hiddenValue(first.container, 'utm_medium')).toBe('');
    first.unmount();

    window.happyDOM.setURL('https://example.com/kayit');
    const second = render(<AttributionFields />);
    await waitFor(() => {
      expect(hiddenValue(second.container, 'utm_campaign')).toBe('kres');
    });
  });
});
