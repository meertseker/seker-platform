import AgeGroupsIndexView from './AgeGroupsIndexView';
import { getReaderData } from '@/lib/content/server';
import { makeReader } from '@/lib/content/reader';
import { buildMetadata } from '@/lib/metadata';

export async function generateMetadata() {
  const c = makeReader(await getReaderData());
  return buildMetadata({
    title: c.text('meta.yasgruplari.title'),
    description: c.text('meta.yasgruplari.description'),
    path: '/yas-gruplari',
  });
}

export default async function AgeGroupsIndexPage() {
  return <AgeGroupsIndexView data={await getReaderData()} />;
}
