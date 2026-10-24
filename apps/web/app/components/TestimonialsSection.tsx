import Link from 'next/link';
import Timecode from './cine/Timecode';
import { Editable } from './edit/Editable';
import type { Reader } from '@/lib/content/types';

/**
 * Ana sayfadaki veli yorumları — hero'dan hemen sonra gelen kanıt bölümü.
 * Üç yorum Google İşletme Profili'nden, kısaltılmadan; hero'daki dördüncü
 * yorumla çakışmaz. Yorum metinleri site geneli `testimonials.items`
 * listesinden okunur; hangi üçünün gösterileceği burada sabittir:
 * üç ayrı itiraza cevap verirler (başka okulları denemiş veli, ilkokula
 * geçiş, uyum süreci kaygısı).
 */
export const HOME_QUOTE_IDS = ['emre-kolej-karsilastirma', 'gizem-ilkokul', 'ismail-uyum'] as const;

type Quote = { id: string; quote: string; author: string; context: string; ready: boolean };

/** Alıntı rozetlerinin renkleri — sitenin aksan sırası. */
const ACCENTS = ['bg-grape', 'bg-bubble-deep', 'bg-mint-deep'];

export default function TestimonialsSection({ c }: { c: Reader }) {
  const all = c.list<Quote>('testimonials.items');
  const quotes = HOME_QUOTE_IDS.map((id) => all.find((q) => q.id === id && q.ready)).filter((q): q is Quote => Boolean(q));
  if (!quotes.length) return null;

  return (
    <section className="bg-paper py-12 md:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Timecode editAttrs={c.attrs('home.testimonials.eyebrow')}>{c.text('home.testimonials.eyebrow')}</Timecode>
            <Editable c={c} k="home.testimonials.title" as="h2" className="mt-2 max-w-2xl text-2xl text-ink md:mt-3 md:text-4xl" />
          </div>
          <Link
            href="/veli-yorumlari"
            className="text-sm text-ink underline underline-offset-4 md:text-base"
            {...c.attrs('home.testimonials.link')}
          >
            {c.text('home.testimonials.link')}
          </Link>
        </div>

        {/* Telefonda tek sıra yatay kaydırma; md+ üç sütun. */}
        <div
          className="mt-6 -mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 pt-4 md:mx-0 md:mt-10 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:pb-0"
          {...c.listAttrs('testimonials.items')}
        >
          {quotes.map((q, index) => (
            <figure
              key={q.id}
              className="card-lift relative w-72 shrink-0 snap-start rounded-3xl bg-white p-6 shadow-sm ring-1 ring-rule md:w-auto md:p-8"
            >
              <span
                aria-hidden="true"
                className={`absolute -top-4 left-6 flex h-9 w-9 items-center justify-center rounded-full font-display text-xl text-white ${ACCENTS[index % ACCENTS.length]}`}
              >
                &ldquo;
              </span>
              <blockquote
                className="mt-2 text-base leading-relaxed text-ink"
                {...c.attrs('testimonials.items', `${q.id}.quote`)}
              >
                {c.fill(q.quote)}
              </blockquote>
              {/* Yazar ve açıklama tek satırda: liste panelinden düzenlenir. */}
              <figcaption className="mt-4 text-sm text-ink-soft">
                {c.fill(q.author)} · {c.fill(q.context)}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
