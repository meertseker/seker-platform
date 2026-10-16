import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';

let editing = false;
vi.mock('@/lib/content/getContent', () => ({ isEditing: async () => editing }));
vi.mock('next/script', () => ({
  default: ({ id, src, children }: { id: string; src?: string; children?: ReactNode }) => (
    <script data-id={id} data-src={src}>
      {children}
    </script>
  ),
}));

import Analytics from '../Analytics';

async function markup() {
  const el = await Analytics();
  return el ? renderToStaticMarkup(el) : '';
}

describe('Analytics', () => {
  beforeEach(() => {
    editing = false;
    process.env.NEXT_PUBLIC_GTM_ID = 'GTM-TEST';
    process.env.NEXT_PUBLIC_GOOGLE_ADS_TAG_ID = '';
    process.env.NEXT_PUBLIC_GA4_ID = '';
  });

  it('ziyaretçiye GTM betiğini verir', async () => {
    expect(await markup()).toContain('data-id="gtm"');
  });

  it('düzenleme (draft) modunda hiçbir şey çizmez', async () => {
    editing = true;
    process.env.NEXT_PUBLIC_GOOGLE_ADS_TAG_ID = 'AW-123';
    expect(await Analytics()).toBeNull();
  });

  it('Google Ads etiketi kimliği varsa gtag.js yüklenir ve config çağrılır', async () => {
    process.env.NEXT_PUBLIC_GTM_ID = '';
    process.env.NEXT_PUBLIC_GOOGLE_ADS_TAG_ID = 'AW-18516861263';
    const html = await markup();
    expect(html).toContain('data-src="https://www.googletagmanager.com/gtag/js?id=AW-18516861263"');
    expect(html).toContain("window.gtag('config', 'AW-18516861263')");
    expect(html).not.toContain('data-id="gtm"');
  });

  it('Google Ads ve GA4 birlikteyse gtag.js bir kez yüklenir, iki config çağrılır', async () => {
    process.env.NEXT_PUBLIC_GTM_ID = '';
    process.env.NEXT_PUBLIC_GOOGLE_ADS_TAG_ID = 'AW-18516861263';
    process.env.NEXT_PUBLIC_GA4_ID = 'G-ABC123XYZ';
    const html = await markup();
    expect(html.match(/gtag\/js\?id=/g)).toHaveLength(1);
    expect(html).toContain("window.gtag('config', 'AW-18516861263')");
    expect(html).toContain("window.gtag('config', 'G-ABC123XYZ')");
  });

  it('yalnız GA4 varsa gtag.js GA4 kimliğiyle yüklenir', async () => {
    process.env.NEXT_PUBLIC_GTM_ID = '';
    process.env.NEXT_PUBLIC_GA4_ID = 'G-ABC123XYZ';
    expect(await markup()).toContain('gtag/js?id=G-ABC123XYZ');
  });

  it('biçimi bozuk etiket kimliği yok sayılır (betik enjeksiyonu yok)', async () => {
    process.env.NEXT_PUBLIC_GTM_ID = '';
    process.env.NEXT_PUBLIC_GOOGLE_ADS_TAG_ID = "AW-1');alert(1);//";
    process.env.NEXT_PUBLIC_GA4_ID = "G-1');alert(1);//";
    expect(await Analytics()).toBeNull();
  });

  it('hiçbir kimlik yoksa hiçbir şey çizmez', async () => {
    process.env.NEXT_PUBLIC_GTM_ID = '';
    expect(await Analytics()).toBeNull();
  });
});
