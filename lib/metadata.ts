import type { Metadata } from 'next';
import { SITE } from './site';

export function buildMetadata({
  title,
  description,
  path,
  image = '/og-default.jpg',
  noindex = false,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  noindex?: boolean;
}): Metadata {
  const url = `${SITE.url}${path === '/' ? '' : path}`;
  const fullTitle = title === SITE.name ? title : `${title} | ${SITE.name}`;

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
