import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LandingView from '../../[slug]/LandingView';
import { getReaderData } from '@/lib/content/server';
import { getPreviewLandingPage } from '@/lib/landing/db';
import { landingReaderData } from '@/lib/landing/readerData';
import { currentYear } from '@/lib/time';

/**
 * Gizli önizleme: paneldeki "Önizle" bağlantısı. Taslak ya da yayındaki sayfa token ile açılır;
 * dizine eklenmez, form gönderilmez. generateStaticParams yok: her istek dinamik
 * (getPreviewLandingPage `connection()` ile önbelleksiz okur). `onizleme` slug'ı ayrılmış olduğundan
 * `[slug]` rotasıyla çakışmaz; `/lp/onizleme/<token>` proxy eşleştiricisine (`/lp/:slug`) girmez.
 */
export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Önizleme', robots: { index: false, follow: false } };
}

export default async function PreviewRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const page = await getPreviewLandingPage(token);
  if (!page) notFound();
  return (
    <LandingView
      slug="onizleme"
      data={landingReaderData(await getReaderData(), 'onizleme', page.fields)}
      year={await currentYear()}
      formDisabled
    />
  );
}
