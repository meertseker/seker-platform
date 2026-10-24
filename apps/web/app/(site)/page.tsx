import HomeView from './HomeView';
import { getReaderData } from '@/lib/content/server';
import { getAnnouncements } from '@/lib/content/getContent';
import { makeReader } from '@/lib/content/reader';
import { buildMetadata } from '@/lib/metadata';

export async function generateMetadata() {
  const c = makeReader(await getReaderData());
  return buildMetadata({ title: c.text('meta.home.title'), description: c.text('meta.home.description'), path: '/' });
}

export default async function Home() {
  const [data, announcements] = await Promise.all([getReaderData(), getAnnouncements()]);
  return <HomeView data={data} announcements={announcements} />;
}
