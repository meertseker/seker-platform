import type { Metadata } from 'next';
import TesekkurlerView from './TesekkurlerView';
import { getReaderData } from '@/lib/content/server';
import { makeReader } from '@/lib/content/reader';

export async function generateMetadata(): Promise<Metadata> {
  const c = makeReader(await getReaderData());
  return {
    title: c.text('meta.tesekkurler.title'),
    robots: { index: false, follow: false },
  };
}

export default async function TesekkurlerPage() {
  return <TesekkurlerView data={await getReaderData()} />;
}
