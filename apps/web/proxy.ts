import { NextResponse, type NextRequest } from 'next/server';
import { LANDING_PAGES } from '@/content/landingPages';
import { AGE_GROUPS_CONTENT } from '@/content/ageGroups';

/**
 * Kök layout'taki Suspense (fallback={null}) kabuğu 200 ile akıttığından, sayfa içindeki notFound()
 * durum kodunu artık 404'e çeviremez (`dynamicParams = false` da cacheComponents ile uyumsuz).
 * Bilinen sluglar kod tarafında sabit olduğundan, bilinmeyen slug daha sayfa render edilmeden
 * 404 sayfasına yönlendirilir (rewrite). Sayfalar ön üretimli kalır; proxy yalnızca bu iki yolda çalışır.
 */
const KNOWN: Record<string, Set<string>> = {
  lp: new Set(LANDING_PAGES.map((p) => p.slug)),
  'yas-gruplari': new Set(AGE_GROUPS_CONTENT.map((g) => g.slug)),
};

export function proxy(request: NextRequest) {
  const [, section, slug] = request.nextUrl.pathname.split('/');
  if (slug && KNOWN[section] && !KNOWN[section].has(decodeURIComponent(slug))) {
    return NextResponse.rewrite(new URL('/_not-found-slug', request.url), { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/lp/:slug', '/yas-gruplari/:slug'],
};
