import { notFound } from 'next/navigation';
import LandingView from './LandingView';
import { LANDING_PAGES, getLandingPage } from '@/content/landingPages';
import { getReaderData } from '@/lib/content/server';
import { makeReader } from '@/lib/content/reader';
import { getPublishedLandingPage } from '@/lib/landing/db';
import { landingReaderData } from '@/lib/landing/readerData';
import { buildMetadata } from '@/lib/metadata';
import { currentYear } from '@/lib/time';

/** Yalnız koddaki beş sayfa ön üretilir; veritabanı sayfaları istek anında (proxy 404/302'yi önceden verir). */
export function generateStaticParams() {
  return LANDING_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getLandingPage(slug)) {
    const page = await getPublishedLandingPage(slug);
    if (!page) return {};
    return buildMetadata({
      title: page.fields.metaTitle,
      description: page.fields.metaDescription,
      path: `/lp/${slug}`,
      noindex: true,
    });
  }
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
  if (!getLandingPage(slug)) {
    const page = await getPublishedLandingPage(slug);
    if (!page) notFound();
    return (
      <LandingView slug={slug} data={landingReaderData(await getReaderData(), slug, page.fields)} year={await currentYear()} />
    );
  }
  return <LandingView slug={slug} data={await getReaderData()} year={await currentYear()} />;
}
