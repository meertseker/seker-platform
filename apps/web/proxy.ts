import { NextResponse, type NextRequest } from 'next/server';
import { LANDING_PAGES } from '@/content/landingPages';
import { AGE_GROUPS_CONTENT } from '@/content/ageGroups';
import { lookupLpStatus, lpNeedsLookup, lpProxyDecision, previewProxyDecision } from '@/lib/landing/status';

/**
 * Kök layout'taki Suspense (fallback={null}) kabuğu 200 ile akıttığından, sayfa içindeki notFound()
 * durum kodunu artık 404'e çeviremez (`dynamicParams = false` da cacheComponents ile uyumsuz).
 * Bilinen sluglar kod tarafında sabit olduğundan, bilinmeyen slug daha sayfa render edilmeden
 * 404 sayfasına yönlendirilir (rewrite). Sayfalar ön üretimli kalır; proxy yalnızca bu iki yolda çalışır.
 *
 * `/lp/<slug>`: kodda olmayan slug veritabanındaki reklam sayfalarına bakılarak karar verilir (Reklam Konsolu
 * Paket A): yayında → geçer, arşiv → 302, yok/taslak → 404, sorgu hatası → geçer (sayfa karar verir).
 * Proxy Next 16'da varsayılan olarak Node.js çalışma zamanında çalışır (fetch + AbortSignal.timeout,
 * process.env kullanılabilir): node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md § Runtime
 * https://nextjs.org/docs/app/api-reference/file-conventions/proxy#runtime
 */
const KNOWN: Record<string, Set<string>> = {
  lp: new Set(LANDING_PAGES.map((p) => p.slug)),
  'yas-gruplari': new Set(AGE_GROUPS_CONTENT.map((g) => g.slug)),
};

const notFoundRewrite = (request: NextRequest) =>
  NextResponse.rewrite(new URL('/_not-found-slug', request.url), { status: 404 });

export async function proxy(request: NextRequest) {
  const [, section, rawSlug, token] = request.nextUrl.pathname.split('/');
  // /lp/onizleme/<token>: biçimi bozuk token sayfa render edilmeden gerçek 404.
  if (section === 'lp' && rawSlug === 'onizleme' && token !== undefined) {
    return previewProxyDecision(token).kind === 'next' ? NextResponse.next() : notFoundRewrite(request);
  }
  if (!rawSlug || !KNOWN[section]) return NextResponse.next();
  let slug: string;
  try {
    slug = decodeURIComponent(rawSlug);
  } catch {
    return notFoundRewrite(request);
  }
  if (KNOWN[section].has(slug)) return NextResponse.next();
  if (section !== 'lp') return notFoundRewrite(request);

  const status = lpNeedsLookup(slug, KNOWN.lp) ? await lookupLpStatus(slug) : null;
  const decision = lpProxyDecision(slug, KNOWN.lp, status);
  if (decision.kind === 'redirect') return NextResponse.redirect(new URL(decision.to, request.url), 302);
  if (decision.kind === 'notFound') return notFoundRewrite(request);
  return NextResponse.next();
}

export const config = {
  matcher: ['/lp/:slug', '/lp/onizleme/:token', '/yas-gruplari/:slug'],
};
