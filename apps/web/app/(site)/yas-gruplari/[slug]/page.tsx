import { notFound } from 'next/navigation';
import AgeGroupView, { type AgeGroupItem } from './AgeGroupView';
import { AGE_GROUPS_CONTENT } from '@/content/ageGroups';
import { getReaderData } from '@/lib/content/server';
import { makeReader } from '@/lib/content/reader';
import { buildMetadata } from '@/lib/metadata';

// Adresler sabit: yaş grubu sayfaları kod tarafındaki sluglardan üretilir, metinler içerik alanlarından okunur.
export function generateStaticParams() {
  return AGE_GROUPS_CONTENT.map((group) => ({ slug: group.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = makeReader(await getReaderData());
  const group = c.list<AgeGroupItem>('ageGroups.items').find((g) => g.id === slug);
  if (!group) return {};
  return buildMetadata({
    title: c.fill(group.metaTitle),
    description: c.fill(group.metaDescription),
    path: `/yas-gruplari/${group.id}`,
    image: group.image,
  });
}

export default async function AgeGroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getReaderData();
  if (!makeReader(data).list<AgeGroupItem>('ageGroups.items').some((g) => g.id === slug)) notFound();
  return <AgeGroupView data={data} slug={slug} />;
}
