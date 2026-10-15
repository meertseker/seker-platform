import GunlukAkisView from './GunlukAkisView';
import { getReaderData } from '@/lib/content/server';
import { makeReader } from '@/lib/content/reader';
import { buildMetadata } from '@/lib/metadata';

export async function generateMetadata() {
  const c = makeReader(await getReaderData());
  return buildMetadata({
    title: c.text('meta.gunlukakis.title'),
    description: c.text('meta.gunlukakis.description'),
    path: '/gunluk-akis',
  });
}

export default async function GunlukAkisPage() {
  return <GunlukAkisView data={await getReaderData()} />;
}
