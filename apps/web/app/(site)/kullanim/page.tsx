import type { Metadata } from 'next';
import LegalView from '../LegalView';
import { getReaderData } from '@/lib/content/server';
import { makeReader } from '@/lib/content/reader';
import { buildMetadata } from '@/lib/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const c = makeReader(await getReaderData());
  return buildMetadata({ title: c.text('meta.kullanim.title'), description: c.text('meta.kullanim.description'), path: '/kullanim' });
}

export default async function KullanimPage() {
  return <LegalView data={await getReaderData()} page="kullanim" />;
}
