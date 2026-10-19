import LeadForm from '@/app/components/LeadForm';
import JsonLd from '@/app/components/JsonLd';
import Frame from '@/app/components/cine/Frame';
import ProofStrip from '@/app/components/lp/ProofStrip';
import { Editable } from '@/app/components/edit/Editable';
import type { Testimonial } from '@/content/testimonials';
import { mapsUrl, phoneE164, whatsappUrl } from '@/lib/site';
import { buildFaqSchema } from '@/lib/schema';
import { makeReader, pickData } from '@/lib/content/reader';
import type { ReaderData } from '@/lib/content/types';

type Block = { id: string; heading: string; text: string };
type Faq = { id: string; question: string; answer: string };

export default function LandingView({ slug, data }: { slug: string; data: ReaderData }) {
  const c = makeReader(data);
  const k = (field: string) => `lp.${slug}.${field}`;
  const blocks = c.list<Block>(k('bodyBlocks'));
  const faq = c.list<Faq>(k('faq'));

  // Yalnızca yazılı onayla yayına hazır (ready: true) yorumlar gösterilir —
  // bkz. content/testimonials.ts (liste `testimonials.items`, Görev 11). Bugün bu liste boşsa bölüm hiç render
  // edilmez; boş bir "yorumlar" başlığı görünür bir boşluk bırakmaz.
  const quotes = c.list<Testimonial>('testimonials.items').filter((item) => item.ready).slice(0, 2);

  // buildFaqSchema content/faq.ts'nin FaqItem tipini bekler (id/featured/ready
  // dahil); landing page SSS'leri yalnızca soru/cevap taşır. Şema yalnızca
  // question/answer alanlarını okur, bu yüzden eksik alanlar burada
  // zararsız şekilde dolduruluyor. Metinler içerikten gelir; belirteçler c.fill ile dolar.
  const faqSchema = buildFaqSchema(
    faq.map((item) => ({
      id: `${slug}-faq-${item.id}`,
      question: c.fill(item.question),
      answer: c.fill(item.answer),
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
        <Editable c={c} k={k('h1')} as="h1" className="text-4xl text-ink md:text-5xl" />
        <Editable c={c} k={k('subhead')} as="p" className="mt-6 max-w-2xl whitespace-pre-line text-lg text-ink-soft" />
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href="#form" className="rounded-full bg-ink px-8 py-4 text-center font-medium text-paper" {...c.attrs('lp.common.ctaPrimary')}>
            {c.text('lp.common.ctaPrimary')}
          </a>
          <a
            href={whatsappUrl(c)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-ink px-8 py-4 text-center font-medium text-ink"
            {...c.attrs('lp.common.ctaWhatsapp')}
          >
            {c.text('lp.common.ctaWhatsapp')}
          </a>
        </div>
      </section>

      <section id="form" className="scroll-mt-8 bg-ink py-14">
        <div className="mx-auto max-w-2xl px-6">
          <Editable c={c} k={k('formHeading')} as="h2" className="text-3xl text-paper" />
          <Editable c={c} k={k('formIntro')} as="p" className="mt-4 text-paper/80" />
          <div className="mt-8 rounded-2xl bg-paper p-6 md:p-8">
            <LeadForm data={pickData(data, ['form.'])} qualify currentYear={new Date().getFullYear()} />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 pt-10">
        <Frame image={c.image(k('media'))} editAttrs={c.attrs(k('media'))} ratio="wide" sizes="(max-width: 768px) 100vw, 1100px" />
      </div>

      <ProofStrip c={c} listKey={k('proofPoints')} />

      <section className="mx-auto max-w-3xl px-6 py-14" {...c.listAttrs(k('bodyBlocks'))}>
        {blocks.map((block) => (
          <div key={block.id} className="mb-10 last:mb-0">
            <Editable c={c} k={k('bodyBlocks')} path={`${block.id}.heading`} value={block.heading} as="h2" className="text-2xl text-ink" />
            <Editable c={c} k={k('bodyBlocks')} path={`${block.id}.text`} value={block.text} as="p" className="mt-3 text-ink-soft" />
          </div>
        ))}
      </section>

      {quotes.length > 0 && (
        <section className="mx-auto max-w-4xl px-6 pb-14">
          <div className="grid gap-6 md:grid-cols-2" {...c.listAttrs('testimonials.items')}>
            {quotes.map((quote) => (
              <figure key={quote.id} className="rounded-2xl bg-paper-warm p-7">
                <blockquote className="text-ink">&ldquo;{c.fill(quote.quote)}&rdquo;</blockquote>
                <figcaption className="timecode mt-4 text-ink-soft">
                  {c.fill(quote.author)} · {c.fill(quote.context)}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-3xl px-6 pb-14">
        <Editable c={c} k="lp.common.faqTitle" as="h2" className="text-3xl text-ink" />
        <dl className="mt-8 space-y-6" {...c.listAttrs(k('faq'))}>
          {faq.map((item) => (
            <div key={item.id} className="border-t border-rule pt-6">
              <Editable c={c} k={k('faq')} path={`${item.id}.question`} value={item.question} as="dt" className="font-medium text-ink" />
              <Editable c={c} k={k('faq')} path={`${item.id}.answer`} value={item.answer} as="dd" className="mt-2 text-ink-soft" />
            </div>
          ))}
        </dl>
      </section>

      <section className="border-t border-rule bg-paper-warm py-14">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <Editable c={c} k="lp.common.visitTitle" as="h2" className="text-3xl text-ink" />
          {/* Adres satırı üç alanın birleşimi: tek öğede işaretlenmez, alanlar sayfa ayarlarında düzenlenir. */}
          <p className="mt-4 text-ink-soft">
            {c.text('site.address.street')}, {c.text('site.address.district')}/{c.text('site.address.city')}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="#form" className="rounded-full bg-ink px-8 py-4 text-paper" {...c.attrs('lp.common.ctaPrimary')}>
              {c.text('lp.common.ctaPrimary')}
            </a>
            <a href={`tel:${phoneE164(c)}`} className="rounded-full border border-ink px-8 py-4 text-ink" {...c.attrs('site.phone')}>
              {c.text('site.phone')}
            </a>
            <a
              href={mapsUrl(c)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-ink px-8 py-4 text-ink"
              {...c.attrs('lp.common.mapsCta')}
            >
              {c.text('lp.common.mapsCta')}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
