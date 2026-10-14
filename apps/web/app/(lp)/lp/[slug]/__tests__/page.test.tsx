import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { LANDING_PAGES, LANDING_SLUGS } from '@/content/landingPages';

/**
 * LeadForm ('use client') useRouter() çağırır; RTL bunu gerçek bir Next.js
 * App Router bağlamı olmadan mount eder ("invariant expected app router to
 * be mounted"). notFound() ve diğer gerçek next/navigation exportları
 * korunur — yalnızca useRouter sahtesi eklenir. vi.mock, vitest tarafından
 * dosyanın en üstüne hoist edilir; aşağıdaki statik import bu sahteden
 * sonra çözülür.
 */
vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/navigation')>();
  return {
    ...actual,
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    }),
  };
});

import LandingPageRoute, { generateStaticParams, generateMetadata } from '../page';

/**
 * app/(lp)/lp/[slug]/page.tsx için kaynak taraması + render testleri.
 * app/__tests__/homepage.test.tsx'in kurduğu desenin bu rotaya genişlemiş
 * hali: npm run build + insan gözüyle grep yeterli değil — noindex,
 * notFound(), cine.css dışlaması ve mark disiplini burada da testle
 * korunmalı (fix round 1/5 review notu).
 */

const PAGE_PATH = path.join('app', '(lp)', 'lp', '[slug]', 'page.tsx');
const PAGE_SRC = readFileSync(path.join(process.cwd(), PAGE_PATH), 'utf8');

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe('generateStaticParams — tam olarak beş gerçek slug', () => {
  it('LANDING_SLUGS ile birebir eşleşir, ne eksik ne fazla', () => {
    const result = generateStaticParams();
    expect(result).toHaveLength(5);
    expect(result.map((p) => p.slug).sort()).toEqual([...LANDING_SLUGS].sort());
  });
});

describe('generateMetadata — noindex her zaman', () => {
  it.each(LANDING_SLUGS)('%s için robots: {index:false, follow:false} döner', async (slug) => {
    const metadata = await generateMetadata(params(slug));
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('bilinmeyen slug için boş metadata döner (sayfa notFound() ile kapanır)', async () => {
    const metadata = await generateMetadata(params('yok-boyle-bir-sey'));
    expect(metadata).toEqual({});
  });
});

describe('bilinmeyen slug — notFound()', () => {
  it('LandingPageRoute bilinmeyen slug için Next.js notFound() fırlatır', async () => {
    await expect(LandingPageRoute(params('yok-boyle-bir-sey'))).rejects.toThrow(
      /NEXT_HTTP_ERROR_FALLBACK/,
    );
  });

  it('bilinen bir slug için fırlatmaz', async () => {
    await expect(LandingPageRoute(params('beykent-anaokulu'))).resolves.toBeDefined();
  });
});

describe('cine.css dışlaması — bu sayfa asla sinematik kaydırma katmanını yüklemez', () => {
  it('page.tsx cine.css import etmez', () => {
    expect(PAGE_SRC).not.toContain('cine.css');
  });

  it('page.tsx kaydırmayla tetiklenen animasyon sınıfı içermez (cine-chapter, cine-spine-item)', () => {
    expect(PAGE_SRC).not.toMatch(/\bcine-chapter\b/);
    expect(PAGE_SRC).not.toMatch(/\bcine-spine-item\b/);
    expect(PAGE_SRC).not.toContain('animation-timeline');
  });
});

describe('--color-mark disiplini', () => {
  it('page.tsx text/bg/border/ring-mark kullanmaz (yalnızca LeadForm ve Roster\'a izinli — bkz. typography.test.ts)', () => {
    expect(PAGE_SRC).not.toMatch(/\b(?:text|bg|border|ring)-mark\b/);
  });
});

describe('render — beş LP için yasak kelime / fiyat sızmaz', () => {
  const BANNED_WORDS = ['indirim', 'kampanya', 'uygun fiyat', 'bütçe dostu', 'fırsat'];

  it.each(LANDING_SLUGS)('%s render çıktısı yasaklı kelime içermez', async (slug) => {
    const jsx = await LandingPageRoute(params(slug));
    const { container } = render(jsx);
    const text = (container.textContent ?? '').toLowerCase();
    for (const word of BANNED_WORDS) {
      expect(text).not.toContain(word);
    }
  });

  it.each(LANDING_SLUGS)('%s render çıktısı ₺ veya fiyat deseni içermez', async (slug) => {
    const jsx = await LandingPageRoute(params(slug));
    const { container } = render(jsx);
    const text = container.textContent ?? '';
    expect(text).not.toContain('₺');
    expect(text).not.toMatch(/\d{3}\.\d{3}/);
  });
});

describe('bölüm sırası — form gövde içeriğinden önce gelir (kasıtlı dönüşüm kararı)', () => {
  it('id="form" bölümü ProofStrip ve gövde bloklarından önce render edilir', () => {
    const formIndex = PAGE_SRC.indexOf('id="form"');
    const proofStripIndex = PAGE_SRC.indexOf('<ProofStrip');
    const bodyBlocksIndex = PAGE_SRC.indexOf('page.bodyBlocks.map');

    expect(formIndex).toBeGreaterThan(-1);
    expect(proofStripIndex).toBeGreaterThan(-1);
    expect(bodyBlocksIndex).toBeGreaterThan(-1);
    expect(formIndex).toBeLessThan(proofStripIndex);
    expect(formIndex).toBeLessThan(bodyBlocksIndex);
  });

  it('render edilen DOM\'da form (Adınız Soyadınız alanı) SSS başlığından önce gelir', async () => {
    const jsx = await LandingPageRoute(params('beykent-anaokulu'));
    const { container } = render(jsx);
    const html = container.innerHTML;
    const formFieldIndex = html.indexOf('Telefon numaranız');
    const faqHeadingIndex = html.indexOf('Sıkça Sorulanlar');
    expect(formFieldIndex).toBeGreaterThan(-1);
    expect(faqHeadingIndex).toBeGreaterThan(-1);
    expect(formFieldIndex).toBeLessThan(faqHeadingIndex);
  });
});

describe('beş LP için temel render sağlığı', () => {
  it.each(LANDING_PAGES)('$slug h1 ve form alanını render eder', async (page) => {
    const jsx = await LandingPageRoute(params(page.slug));
    const { container, getByText } = render(jsx);
    expect(getByText(page.h1)).toBeDefined();
    expect(container.querySelector('#form')).not.toBeNull();
  });
});
