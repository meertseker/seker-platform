import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';
import { AGE_GROUPS_CONTENT } from '@/content/ageGroups';

const ROUTES: { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' }[] = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/kayit', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/ucretler', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/egitim-yaklasimimiz', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/yas-gruplari', priority: 0.8, changeFrequency: 'monthly' },
  ...AGE_GROUPS_CONTENT.map((group) => ({
    path: `/yas-gruplari/${group.slug}`,
    priority: 0.8 as const,
    changeFrequency: 'monthly' as const,
  })),
  { path: '/gunluk-akis', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/guvenlik', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/veli-yorumlari', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/aktiviteler', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/hakkimizda', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/sss', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/bultenler', priority: 0.5, changeFrequency: 'weekly' },
  { path: '/iletisim', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/gizlilik', priority: 0.3, changeFrequency: 'monthly' },
  { path: '/kullanim', priority: 0.3, changeFrequency: 'monthly' },
  { path: '/cerez', priority: 0.3, changeFrequency: 'monthly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map((route) => ({
    url: `${SITE.url}${route.path === '/' ? '' : route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
