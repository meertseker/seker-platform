import GuvenlikView from './GuvenlikView';
import { getReaderData } from '@/lib/content/server';
import { makeReader } from '@/lib/content/reader';
import { buildMetadata } from '@/lib/metadata';

export async function generateMetadata() {
  const c = makeReader(await getReaderData());
  return buildMetadata({
    title: c.text('meta.guvenlik.title'),
    description: c.text('meta.guvenlik.description'),
    path: '/guvenlik',
  });
}

export default async function GuvenlikPage() {
  return <GuvenlikView data={await getReaderData()} />;
}
