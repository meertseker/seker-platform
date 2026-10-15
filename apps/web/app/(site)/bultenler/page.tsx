import BultenlerView from './BultenlerView';
import { getReaderData } from '@/lib/content/server';
import { makeReader } from '@/lib/content/reader';
import { buildMetadata } from '@/lib/metadata';

export async function generateMetadata() {
  const c = makeReader(await getReaderData());
  return buildMetadata({
    title: c.text('meta.bultenler.title'),
    description: c.text('meta.bultenler.description'),
    path: '/bultenler',
  });
}

export default async function BultenlerPage() {
  return <BultenlerView data={await getReaderData()} />;
}
