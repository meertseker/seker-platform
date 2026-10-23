import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { isPreviewPath, PREVIEW_PATH_GUARD_JS } from '../previewPath';
import { trackEvent } from '../analytics';
import { normalizeVisitPath } from '../visits';
import { CONSENT_KEY } from '@/lib/consent';

/**
 * Gizli önizleme (/lp/onizleme/<token>) ölçüm dışıdır: token'lı adres Meta'ya, Google'a ve
 * site_visits'e gitmez. Normal /lp/<slug> ölçülmeye devam eder.
 */

let pathname = '/lp/onizleme/' + 'A'.repeat(43);
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('@/lib/content/getContent', () => ({ isEditing: async () => false }));
vi.mock('next/script', () => ({
  default: ({ id, src, children }: { id: string; src?: string; children?: ReactNode }) => (
    <script data-id={id} data-src={src}>
      {children}
    </script>
  ),
}));

import VisitBeacon from '@/app/components/VisitBeacon';
import MetaPixel from '@/app/components/MetaPixel';
import Analytics from '@/app/components/Analytics';

const PREVIEW = '/lp/onizleme/' + 'A'.repeat(43);
const NORMAL = '/lp/beykent-anaokulu';

function go(path: string) {
  pathname = path;
  window.history.replaceState({}, '', path);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  go('/');
});

describe('isPreviewPath', () => {
  it('yalnız /lp/onizleme ve altı', () => {
    expect(isPreviewPath(PREVIEW)).toBe(true);
    expect(isPreviewPath('/lp/onizleme')).toBe(true);
    expect(isPreviewPath('/lp/onizleme/')).toBe(true);
    expect(isPreviewPath('/lp/onizleme-2')).toBe(false);
    expect(isPreviewPath(NORMAL)).toBe(false);
    expect(isPreviewPath('/')).toBe(false);
  });
});

describe('trackEvent', () => {
  beforeEach(() => {
    window.dataLayer = [];
  });

  it('önizlemede olay göndermez', () => {
    go(PREVIEW);
    const gtag = vi.fn();
    window.gtag = gtag;
    vi.stubEnv('NEXT_PUBLIC_GA4_ID', 'G-TEST');
    trackEvent('whatsapp_click');
    trackEvent('cta_click');
    expect(window.dataLayer).toEqual([]);
    expect(gtag).not.toHaveBeenCalled();
    delete window.gtag;
  });

  it('normal reklam sayfasında gönderir', () => {
    go(NORMAL);
    trackEvent('cta_click');
    expect(window.dataLayer).toEqual([{ event: 'cta_click' }]);
  });
});

describe('ziyaret sayacı', () => {
  it('sunucu önizleme yolunu kaydetmez; benzer adlı slug kaydedilir', () => {
    expect(normalizeVisitPath(PREVIEW)).toBeNull();
    expect(normalizeVisitPath('/lp/onizleme')).toBeNull();
    expect(normalizeVisitPath('/lp/onizleme-2')).toBe('/lp/onizleme-2');
  });

  it('VisitBeacon önizlemede istek göndermez, normal sayfada gönderir', () => {
    const beacon = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
    go(PREVIEW);
    render(<VisitBeacon />);
    expect(beacon).not.toHaveBeenCalled();
    cleanup();
    go(NORMAL);
    render(<VisitBeacon />);
    expect(beacon).toHaveBeenCalledTimes(1);
  });
});

describe('Meta pikseli', () => {
  let appended: Node[] = [];
  beforeEach(() => {
    window.localStorage.clear();
    delete (window as unknown as { fbq?: unknown }).fbq;
    appended = [];
    vi.stubEnv('NEXT_PUBLIC_CONSENT_VERSION', '2');
    vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', '12345');
    vi.spyOn(document.head, 'appendChild').mockImplementation(((node: Node) => {
      appended.push(node);
      return node;
    }) as typeof document.head.appendChild);
  });

  it('önizlemede onay olsa da yüklenmez (PageView yok)', () => {
    go(PREVIEW);
    window.localStorage.setItem(CONSENT_KEY, 'granted');
    render(<MetaPixel />);
    expect(appended).toHaveLength(0);
    expect((window as unknown as { fbq?: unknown }).fbq).toBeUndefined();
  });
});

describe('Google etiketleri (GTM / gtag)', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_GTM_ID', 'GTM-TEST');
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_TAG_ID', 'AW-123');
    vi.stubEnv('NEXT_PUBLIC_GA4_ID', '');
  });

  async function inlineScripts() {
    const el = await Analytics();
    const html = el ? renderToStaticMarkup(el) : '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return Array.from(doc.querySelectorAll('script'))
      .filter((s) => !s.getAttribute('data-src'))
      .map((s) => s.textContent ?? '');
  }

  /** Satır içi betiği sahte bir pencerede çalıştırır; DOM'a ya da gtag'e dokunursa kaydeder. */
  function run(code: string, path: string) {
    const touched: string[] = [];
    const fakeDoc = new Proxy({}, { get: (_t, k) => { touched.push(`document.${String(k)}`); return () => [{ parentNode: { insertBefore() {} } }]; } });
    const fakeWin = { location: { pathname: path }, gtag: () => touched.push('gtag'), dataLayer: [] as unknown[] };
    new Function('window', 'document', 'location', code)(fakeWin, fakeDoc, fakeWin.location);
    if (fakeWin.dataLayer.length) touched.push('dataLayer');
    return touched;
  }

  it('satır içi betikler önizleme korumasını taşır', async () => {
    const scripts = await inlineScripts();
    expect(scripts.length).toBeGreaterThan(0);
    for (const code of scripts) expect(code).toContain(PREVIEW_PATH_GUARD_JS);
  });

  it('önizlemede GTM yüklenmez ve gtag config (page_view) çağrılmaz; normal sayfada çalışır', async () => {
    for (const code of await inlineScripts()) {
      expect(run(code, PREVIEW)).toEqual([]);
      expect(run(code, NORMAL).length).toBeGreaterThan(0);
    }
  });
});
