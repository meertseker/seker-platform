import type { Metadata } from 'next';
import LegalView from '../LegalView';
import { getReaderData } from '@/lib/content/server';
import { makeReader } from '@/lib/content/reader';
import { buildMetadata } from '@/lib/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const c = makeReader(await getReaderData());
  return buildMetadata({ title: c.text('meta.cerez.title'), description: c.text('meta.cerez.description'), path: '/cerez' });
}

export default async function CerezPage() {
  return <LegalView data={await getReaderData()} page="cerez" />;
}
