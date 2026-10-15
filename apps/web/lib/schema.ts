import { SITE, phoneE164 } from './site';
import type { Reader } from './content/types';
import type { FaqItem } from '@/content/faq';

/** Okul bilgileri site.* alanlarından gelir; yapı, adresler (url/logo/görsel) ve koordinat kodda kalır. */
export function buildPreschoolSchema(c: Reader) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Preschool',
    '@id': `${SITE.url}/#organization`,
    name: c.text('site.name'),
    alternateName: [...SITE.alternateNames],
    description: c.text('site.description'),
    url: SITE.url,
    logo: `${SITE.url}/logo.png`,
    image: `${SITE.url}/bahce-genis.webp`,
    telephone: phoneE164(c),
    email: c.text('site.email'),
    foundingDate: c.text('site.foundingYear'),
    priceRange: '$$$',
    address: {
      '@type': 'PostalAddress',
      streetAddress: c.text('site.address.street'),
      addressLocality: c.text('site.address.district'),
      addressRegion: c.text('site.address.city'),
      postalCode: SITE.address.postalCode,
      addressCountry: SITE.address.country,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: SITE.geo.latitude,
      longitude: SITE.geo.longitude,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: c.text('site.hours.full.opens'),
        closes: c.text('site.hours.full.closes'),
      },
    ],
    areaServed: SITE.areaServed.map((name) => ({ '@type': 'Place', name })),
    sameAs: Object.values(SITE.social).filter((url) => url.length > 0),
  };
}

export function buildFaqSchema(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export function buildBreadcrumbSchema(trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: `${SITE.url}${crumb.path}`,
    })),
  };
}
