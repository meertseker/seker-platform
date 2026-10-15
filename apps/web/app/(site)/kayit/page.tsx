import KayitView from './KayitView';
import { getReaderData } from '@/lib/content/server';
import { makeReader } from '@/lib/content/reader';
import { buildMetadata } from '@/lib/metadata';

export async function generateMetadata() {
  const c = makeReader(await getReaderData());
  return buildMetadata({
    title: c.text('meta.kayit.title'),
    description: c.text('meta.kayit.description'),
    path: '/kayit',
  });
}

export default async function KayitPage() {
  return <KayitView data={await getReaderData()} />;
}
