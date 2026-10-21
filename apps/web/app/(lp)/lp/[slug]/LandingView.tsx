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
import type { ReaderData } from '@/lib/content/types';

type Block = { id: string; heading: string; text: string };
type Faq = { id: string; question: string; answer: string };

/** Beş yıldız; metin taşımaz (yorum kaynağı yanında "Google yorumu" olarak yazar). */
function Stars() {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 20" className="h-3 w-[60px] shrink-0 fill-[#f5b301]">
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} transform={`translate(${i * 20} 0)`} d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
      ))}
    </svg>
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
  // İlk üçü ilk ekranda, sonraki ikisi sayfanın aşağısında; aynı yorum iki kez görünmez.
  const ready = c.list<Testimonial>('testimonials.items').filter((item) => item.ready);
  const heroQuotes = ready.slice(0, 3);
  const quotes = ready.slice(3, 5);
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

      {/* İlk ekran: binanın göründüğü bahçe fotoğrafının üstünde başlık, yazımız, üç veli yorumu ve form.
          Form zaten görünür olduğu için forma kaydıran düğme yok. Mobilde yorumlar kısaltılır ki form
          ilk ekranda başlasın; masaüstünde form sağ sütunda tam görünür. */}
      <section className="relative isolate overflow-hidden bg-ink">
        <Image
          src={hero.src}
          alt={hero.alt}
          fill
          preload
          loading="eager"
          fetchPriority="high"
          sizes="100vw"
          className="-z-10 object-cover object-left"
          {...c.attrs('lp.common.heroImage')}
        />
        {/* Nötr karartma: metin okunur, bina ve bahçe seçilir. */}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/45 to-black/65 lg:bg-gradient-to-r lg:from-black/70 lg:via-black/45 lg:to-black/10" />
        <div className="mx-auto grid max-w-6xl items-start gap-4 px-4 pt-5 pb-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,430px)] lg:gap-12 lg:pt-10 lg:pb-14">
          <div className="min-w-0">
            <Editable c={c} k={k('h1')} as="h1" className="text-[1.5rem] leading-tight text-white text-balance [text-shadow:0_1px_12px_rgb(0_0_0/0.35)] md:text-4xl" />
            {/* Mobilde ilk üç satır: form ilk ekranda başlasın. Metnin tamamı masaüstünde görünür. */}
            <Editable c={c} k={k('subhead')} as="p" className="mt-2.5 line-clamp-3 max-w-2xl whitespace-pre-line text-[15px] text-white/90 md:mt-4 md:line-clamp-none md:text-base" />
            {heroQuotes.length > 0 && (
              <ul className="mt-3.5 grid min-w-0 gap-2 md:mt-6 md:gap-3" {...c.listAttrs('testimonials.items')}>
                {heroQuotes.map((quote, i) => (
                  <li key={quote.id} className={`min-w-0 ${i === 2 ? 'hidden md:block' : ''}`}>
                    <figure className="rounded-xl bg-white/95 px-3.5 py-2.5 md:px-5 md:py-3.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <Stars />
                        <figcaption className="min-w-0 truncate text-xs font-medium text-ink-soft">
                          {c.fill(quote.author)} · {c.fill(quote.context)}
                        </figcaption>
                      </div>
                      <blockquote className="mt-1 line-clamp-2 text-sm text-ink md:text-[15px]">
                        &ldquo;{c.fill(quote.quote)}&rdquo;
                      </blockquote>
                    </figure>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div id="form" className="min-w-0 scroll-mt-4 rounded-2xl bg-paper p-5 shadow-xl md:p-7">
            <Editable c={c} k={k('formHeading')} as="h2" className="text-2xl text-ink" />
            <Editable c={c} k={k('formIntro')} as="p" className="mt-2 text-sm text-ink-soft" />
            <div className="mt-5">
              <LeadForm data={pickData(data, ['form.'])} qualify currentYear={year} />
            </div>
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
