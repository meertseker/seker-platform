import { notFound } from 'next/navigation';
import LeadForm from '@/app/components/LeadForm';
import JsonLd from '@/app/components/JsonLd';
import Frame from '@/app/components/cine/Frame';
import ProofStrip from '@/app/components/lp/ProofStrip';
import { LANDING_PAGES, getLandingPage } from '@/content/landingPages';
import { PUBLISHED_TESTIMONIALS } from '@/content/testimonials';
import { SITE, WHATSAPP_URL } from '@/lib/site';
import { buildMetadata } from '@/lib/metadata';
import { buildFaqSchema } from '@/lib/schema';

export function generateStaticParams() {
  return LANDING_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getLandingPage(slug);
  if (!page) return {};
  return buildMetadata({
    title: page.metaTitle,
    description: page.metaDescription,
    path: `/lp/${page.slug}`,
    noindex: true,
  });
}

export default async function LandingPageRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getLandingPage(slug);
  if (!page) notFound();

  // Yalnızca yazılı onayla yayına hazır (ready: true) yorumlar gösterilir —
  // bkz. content/testimonials.ts. Bugün bu liste boşsa bölüm hiç render
  // edilmez; boş bir "yorumlar" başlığı görünür bir boşluk bırakmaz.
  const quotes = PUBLISHED_TESTIMONIALS.slice(0, 2);

  // buildFaqSchema content/faq.ts'nin FaqItem tipini bekler (id/featured/ready
  // dahil); landing page SSS'leri yalnızca soru/cevap taşır. Şema yalnızca
  // question/answer alanlarını okur, bu yüzden eksik alanlar burada
  // zararsız şekilde dolduruluyor.
  const faqSchema = buildFaqSchema(
    page.faq.map((item, index) => ({
      id: `${page.slug}-faq-${index}`,
      question: item.question,
      answer: item.answer,
      featured: false,
      ready: true,
    })),
  );

  return (
    <div className="bg-paper">
      <JsonLd data={faqSchema} />

      {/* Hero — form, ilk ekranın hemen altında; sayfanın tek birincil
          eylemi mobilde uzun bir kaydırma gerektirmez. */}
      <section className="mx-auto max-w-5xl px-6 pt-10 pb-8">
        <h1 className="text-4xl text-ink md:text-5xl">{page.h1}</h1>
        <p className="mt-6 max-w-2xl text-lg text-ink-soft">{page.subhead}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href="#form" className="rounded-full bg-ink px-8 py-4 text-center font-medium text-paper">
            Ön Görüşme Randevusu
          </a>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-ink px-8 py-4 text-center font-medium text-ink"
          >
            WhatsApp&apos;tan Yazın
          </a>
        </div>
      </section>

      <section id="form" className="scroll-mt-8 bg-ink py-14">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-3xl text-paper">{page.formHeading}</h2>
          <p className="mt-4 text-paper/80">{page.formIntro}</p>
          <div className="mt-8 rounded-2xl bg-paper p-6 md:p-8">
            <LeadForm />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 pt-10">
        <Frame mediaKey={page.mediaKey} ratio="wide" sizes="(max-width: 768px) 100vw, 1100px" />
      </div>

      <ProofStrip points={page.proofPoints} />

      <section className="mx-auto max-w-3xl px-6 py-14">
        {page.bodyBlocks.map((block) => (
          <div key={block.heading} className="mb-10 last:mb-0">
            <h2 className="text-2xl text-ink">{block.heading}</h2>
            <p className="mt-3 text-ink-soft">{block.text}</p>
          </div>
        ))}
      </section>

      {quotes.length > 0 && (
        <section className="mx-auto max-w-4xl px-6 pb-14">
          <div className="grid gap-6 md:grid-cols-2">
            {quotes.map((quote) => (
              <figure key={quote.id} className="rounded-2xl bg-paper-warm p-7">
                <blockquote className="text-ink">&ldquo;{quote.quote}&rdquo;</blockquote>
                <figcaption className="timecode mt-4 text-ink-soft">
                  {quote.author} · {quote.context}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-3xl px-6 pb-14">
        <h2 className="text-3xl text-ink">Sıkça Sorulanlar</h2>
        <dl className="mt-8 space-y-6">
          {page.faq.map((item) => (
            <div key={item.question} className="border-t border-rule pt-6">
              <dt className="font-medium text-ink">{item.question}</dt>
              <dd className="mt-2 text-ink-soft">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="border-t border-rule bg-paper-warm py-14">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl text-ink">Okulu gezin, sonra karar verin</h2>
          <p className="mt-4 text-ink-soft">
            {SITE.address.street}, {SITE.address.district}/{SITE.address.city}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="#form" className="rounded-full bg-ink px-8 py-4 text-paper">
              Ön Görüşme Randevusu
            </a>
            <a href={`tel:${SITE.phone.e164}`} className="rounded-full border border-ink px-8 py-4 text-ink">
              {SITE.phone.display}
            </a>
            <a
              href={SITE.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-ink px-8 py-4 text-ink"
            >
              Haritada Gör
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
