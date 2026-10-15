import { notFound } from 'next/navigation';
import LandingView from './LandingView';
import { LANDING_PAGES, getLandingPage } from '@/content/landingPages';
import { getReaderData } from '@/lib/content/server';
import { makeReader } from '@/lib/content/reader';
import { buildMetadata } from '@/lib/metadata';

export function generateStaticParams() {
  return LANDING_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getLandingPage(slug)) return {};
  const c = makeReader(await getReaderData());
  return buildMetadata({
    title: c.text(`lp.${slug}.metaTitle`),
    description: c.text(`lp.${slug}.metaDescription`),
    path: `/lp/${slug}`,
    noindex: true,
  });
}

export default async function LandingPageRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!getLandingPage(slug)) notFound();
  return <LandingView slug={slug} data={await getReaderData()} />;
}
