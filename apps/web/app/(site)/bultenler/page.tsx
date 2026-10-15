import BultenlerView from './BultenlerView';
import { getReaderData } from '@/lib/content/server';
import { getAnnouncements } from '@/lib/content/getContent';
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
  const [data, announcements] = await Promise.all([getReaderData(), getAnnouncements()]);
  return <BultenlerView data={data} announcements={announcements} />;
}
