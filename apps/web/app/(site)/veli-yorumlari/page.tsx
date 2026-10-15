import YorumlarView from './YorumlarView';
import { getReaderData } from '@/lib/content/server';
import { makeReader } from '@/lib/content/reader';
import { buildMetadata } from '@/lib/metadata';

export async function generateMetadata() {
  const c = makeReader(await getReaderData());
  return buildMetadata({
    title: c.text('meta.yorumlar.title'),
    description: c.text('meta.yorumlar.description'),
    path: '/veli-yorumlari',
  });
}

export default async function VeliYorumlariPage() {
  return <YorumlarView data={await getReaderData()} />;
}
