import { SITE } from './site';
import type { FaqItem } from '@/content/faq';

export const preschoolSchema = {
  '@context': 'https://schema.org',
  '@type': 'Preschool',
  '@id': `${SITE.url}/#organization`,
  name: SITE.name,
  alternateName: [...SITE.alternateNames],
  description: SITE.description,
  url: SITE.url,
  logo: `${SITE.url}/logo.png`,
  image: `${SITE.url}/og-default.jpg`,
  telephone: SITE.phone.e164,
  email: SITE.email,
  foundingDate: String(SITE.foundingYear),
  priceRange: '$$$',
  address: {
    '@type': 'PostalAddress',
    streetAddress: SITE.address.street,
    addressLocality: SITE.address.district,
    addressRegion: SITE.address.city,
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
      opens: SITE.hours.opens,
      closes: SITE.hours.closes,
    },
  ],
  areaServed: SITE.areaServed.map((name) => ({ '@type': 'Place', name })),
  sameAs: Object.values(SITE.social).filter((url) => url.length > 0),
};

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
