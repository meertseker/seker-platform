import type { Metadata } from 'next';
import { SITE } from './site';

export function buildMetadata({
  title,
  description,
  path,
  image = '/bahce-genis.webp',
  noindex = false,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  noindex?: boolean;
}): Metadata {
  const url = `${SITE.url}${path === '/' ? '' : path}`;
  // Çağıran taraf soneki kendi yazmışsa iki kez eklenmesin; aksi hâlde
  // başlık arama sonucunda kırpılıyor.
  const suffix = ` | ${SITE.name}`;
  const base = title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
  const fullTitle = base === SITE.name ? SITE.name : `${base}${suffix}`;

  return {
    title: fullTitle,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE.name,
      locale: 'tr_TR',
      type: 'website',
      images: [{ url: `${SITE.url}${image}`, width: 1200, height: 630, alt: SITE.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [`${SITE.url}${image}`],
    },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
