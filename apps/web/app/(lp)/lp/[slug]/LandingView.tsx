import Image from 'next/image';
import LeadForm from '@/app/components/LeadForm';
import JsonLd from '@/app/components/JsonLd';
import Frame from '@/app/components/cine/Frame';
import ProofStrip from '@/app/components/lp/ProofStrip';
import { Editable } from '@/app/components/edit/Editable';
import type { Testimonial } from '@/content/testimonials';
import { mapsUrl, phoneE164 } from '@/lib/site';
import { buildFaqSchema } from '@/lib/schema';
import { makeReader, pickData } from '@/lib/content/reader';
import type { Reader, ReaderData } from '@/lib/content/types';

type Block = { id: string; heading: string; text: string };
type Faq = { id: string; question: string; answer: string };

/** Beş yıldız; metin taşımaz (yorumun kaynağı altında "Google yorumu" olarak yazar). */
function Stars() {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 20" className="block h-3.5 w-[70px] shrink-0 fill-[#E9A100]">
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} transform={`translate(${i * 20} 0)`} d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
      ))}
    </svg>
  );
}

/** Veli yorumu: yıldız, tam metin (kesilmez), ad ve kaynak. İlk ekranda ve sayfanın aşağısında aynı biçim. */
function QuoteCard({ c, quote }: { c: Reader; quote: Testimonial }) {
  return (
    <figure className="h-full rounded-2xl border border-rule bg-white px-4 py-4 lg:px-5">
      <Stars />
      <blockquote className="mt-2.5 text-[15px] leading-relaxed text-ink">&ldquo;{c.fill(quote.quote)}&rdquo;</blockquote>
      <figcaption className="mt-3 text-[13px] leading-snug text-ink-soft">
        <span className="font-bold text-ink">{c.fill(quote.author)}</span>
        <span className="block">{c.fill(quote.context)}</span>
      </figcaption>
    </figure>
  );
}

export default function LandingView({
  slug,
  data,
  year,
}: {
  slug: string;
  data: ReaderData;
  year?: number;
}) {
  const c = makeReader(data);
  const k = (field: string) => `lp.${slug}.${field}`;
  const blocks = c.list<Block>(k('bodyBlocks'));
  const faq = c.list<Faq>(k('faq'));

  // Yalnızca yazılı onayla yayına hazır (ready: true) yorumlar gösterilir —
  // bkz. content/testimonials.ts (liste `testimonials.items`, Görev 11). Bugün bu liste boşsa bölüm hiç render
  // edilmez; boş bir "yorumlar" başlığı görünür bir boşluk bırakmaz.
  // İlk ikisi formdan önce (kısa güven), sonraki ikisi sayfanın aşağısında; aynı yorum iki kez görünmez.
  const ready = c.list<Testimonial>('testimonials.items').filter((item) => item.ready);
  const heroQuotes = ready.slice(0, 2);
  const quotes = ready.slice(2, 4);
  const hero = c.image('lp.common.heroImage');

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

      {/* İlk ekran. Telefonda: bahçe fotoğrafı kenardan kenara ve karartmasız (4:3; 375 px altında 3:2), altında düz
          zeminde başlık, kısa metin, forma inen düğme, okulun rakamları, iki veli yorumu ve form. Masaüstünde
          sol sütunda başlık ve fotoğraf, sağ sütunda form. Metin hiçbir yerde fotoğrafın üstünde durmaz. */}
      <section>
        <div className="mx-auto max-w-6xl lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-start lg:gap-12 lg:px-6 lg:pt-10 lg:pb-16">
          <div className="flex min-w-0 flex-col">
            <div className="relative aspect-[3/2] overflow-hidden bg-paper-warm min-[375px]:aspect-[4/3] lg:order-2 lg:mt-7 lg:aspect-[3/2] lg:rounded-[28px]">
              <Image
                src={hero.src}
                alt={hero.alt}
                fill
                preload
                loading="eager"
                fetchPriority="high"
                sizes="(min-width: 1152px) 690px, (min-width: 1024px) 60vw, 100vw"
                className="object-cover"
                {...c.attrs('lp.common.heroImage')}
              />
              {/* Şeker ambalajı kenarı: fotoğraf sayfaya fisto kesimle bağlanır (yalnız telefonda). */}
              <div aria-hidden="true" className="scallop absolute inset-x-0 -bottom-px lg:hidden" />
            </div>

            <div className="px-5 pt-4 sm:px-6 lg:order-1 lg:px-0 lg:pt-0">
              <Editable c={c} k={k('h1')} as="h1" className="lp-title text-balance text-ink" />
              <Editable c={c} k={k('subhead')} as="p" className="lp-lede mt-2.5 max-w-[60ch] whitespace-pre-line text-ink-soft lg:mt-4" />
              {/* Telefonda form yorumların altında kalır; ilk ekranda forma inen yol görünsün. */}
              <a
                href="#form"
                className="mt-4 flex min-h-12 items-center justify-center rounded-full bg-grape px-6 text-base font-semibold text-white shadow-md shadow-grape/25 lg:hidden"
                {...c.attrs('lp.common.ctaPrimary')}
              >
                {c.text('lp.common.ctaPrimary')}
              </a>
            </div>

            <div className="px-5 sm:px-6 lg:order-3 lg:px-0">
              <ProofStrip c={c} listKey={k('proofPoints')} />

              {heroQuotes.length > 0 && (
                <ul className="mt-6 grid gap-3 lg:mt-7 lg:grid-cols-2 lg:gap-4" {...c.listAttrs('testimonials.items')}>
                  {heroQuotes.map((quote) => (
                    <li key={quote.id} className="min-w-0">
                      <QuoteCard c={c} quote={quote} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div
            id="form"
            className="mt-8 scroll-mt-3 border-t border-rule bg-paper-warm px-5 pt-8 pb-10 sm:px-6 lg:sticky lg:top-6 lg:mt-0 lg:rounded-[28px] lg:border lg:bg-white lg:p-8 lg:shadow-[0_18px_50px_-24px_rgb(46_16_101/0.35)]"
          >
            <Editable c={c} k={k('formHeading')} as="h2" className="text-[1.625rem] text-ink lg:text-[1.5rem]" />
            <Editable c={c} k={k('formIntro')} as="p" className="mt-1.5 text-[15px] text-ink-soft" />
            <div className="mt-6">
              <LeadForm data={pickData(data, ['form.'])} qualify currentYear={year} />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-5 pt-12 sm:px-6">
        <Frame image={c.image(k('media'))} editAttrs={c.attrs(k('media'))} ratio="wide" sizes="(max-width: 768px) 100vw, 1100px" />
      </div>

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
          <div className="grid gap-4 md:grid-cols-2" {...c.listAttrs('testimonials.items')}>
            {quotes.map((quote) => (
              <QuoteCard key={quote.id} c={c} quote={quote} />
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
