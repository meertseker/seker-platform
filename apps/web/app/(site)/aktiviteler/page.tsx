import { Suspense } from 'react';
import AktivitelerView, { EXPLORER_PREFIXES } from './AktivitelerView';
import BranchExplorer from './BranchExplorer';
import { getReaderData } from '@/lib/content/server';
import { makeReader, pickData } from '@/lib/content/reader';
import { buildMetadata } from '@/lib/metadata';
import type { ReaderData } from '@/lib/content/types';

export async function generateMetadata() {
  const c = makeReader(await getReaderData());
  return buildMetadata({
    title: c.text('meta.aktiviteler.title'),
    description: c.text('meta.aktiviteler.description'),
    path: '/aktiviteler',
  });
}

async function BranchFromParams({ searchParams, data }: { searchParams: Promise<{ ders?: string }>; data: ReaderData }) {
  const { ders } = await searchParams;
  return <BranchExplorer data={data} initialSlug={ders} />;
}

export default async function AktivitelerPage({
  searchParams,
}: {
  searchParams: Promise<{ ders?: string }>
}) {
  const data = await getReaderData();
  const explorerData = pickData(data, EXPLORER_PREFIXES);
  return (
    <AktivitelerView
      data={data}
      explorer={
        <Suspense fallback={<BranchExplorer data={explorerData} />}>
          <BranchFromParams searchParams={searchParams} data={explorerData} />
        </Suspense>
      }
    />
  );
}
