import EgitimView from './EgitimView';
import { getReaderData } from '@/lib/content/server';
import { makeReader } from '@/lib/content/reader';
import { buildMetadata } from '@/lib/metadata';

export async function generateMetadata() {
  const c = makeReader(await getReaderData());
  return buildMetadata({
    title: c.text('meta.egitim.title'),
    description: c.text('meta.egitim.description'),
    path: '/egitim-yaklasimimiz',
  });
}

export default async function EgitimYaklasimimizPage() {
  return <EgitimView data={await getReaderData()} />;
}
