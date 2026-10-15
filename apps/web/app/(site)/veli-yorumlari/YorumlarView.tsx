import PageHero from '@/app/components/PageHero';
import JsonLd from '@/app/components/JsonLd';
import TrackedLink from '@/app/components/TrackedLink';
import { Editable } from '@/app/components/edit/Editable';
import { buildBreadcrumbSchema } from '@/lib/schema';
import { mapsUrl } from '@/lib/site';
import { makeReader } from '@/lib/content/reader';
import type { ReaderData } from '@/lib/content/types';
import type { Testimonial } from '@/content/testimonials';

const SOURCE_KEYS: Record<Testimonial['source'], string> = {
  google: 'yorumlar.source.google',
  form: 'yorumlar.source.form',
  'yuz-yuze': 'yorumlar.source.yuzyuze',
};

/** Alıntı rozetlerinin renkleri — sitenin aksan sırası. */
const QUOTE_ACCENTS = ['bg-grape', 'bg-bubble-deep', 'bg-mint-deep', 'bg-sunny-deep'];

export default function YorumlarView({ data }: { data: ReaderData }) {
  const c = makeReader(data);
  const published = c.list<Testimonial>('testimonials.items').filter((item) => item.ready);
  return (
    <div className="min-h-screen bg-paper">
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Ana Sayfa', path: '/' },
          { name: 'Veli Yorumları', path: '/veli-yorumlari' },
        ])}
      />

      <PageHero
        c={c}
        keys={{ eyebrow: 'yorumlar.hero.eyebrow', title: 'yorumlar.hero.title', lead: 'yorumlar.hero.lead' }}
        tone="sunny"
      />

      {published.length > 0 ? (
        <section className="mx-auto max-w-5xl px-6 py-16">
          <div className="grid gap-8 md:grid-cols-2" {...c.listAttrs('testimonials.items')}>
            {published.map((item, index) => (
              <figure
                key={item.id}
                className="card-lift relative rounded-3xl bg-white p-8 shadow-sm ring-1 ring-rule"
              >
                <span
                  aria-hidden="true"
                  className={`absolute -top-4 left-8 flex h-9 w-9 items-center justify-center rounded-full font-display text-xl text-white ${QUOTE_ACCENTS[index % QUOTE_ACCENTS.length]}`}
                >
                  &ldquo;
                </span>
                {/* Tırnak işaretleri aynı elemanda basıldığı için alıntı satır içi işaretlenmez (liste panelinden düzenlenir). */}
                <blockquote className="text-lg leading-relaxed text-ink">
                  &ldquo;{c.fill(item.quote)}&rdquo;
                </blockquote>
                <figcaption className="mt-6 text-sm text-ink-soft">
                  <span className="font-semibold text-ink" {...c.attrs('testimonials.items', `${item.id}.author`)}>
                    {c.fill(item.author)}
                  </span>{' '}
                  — {c.fill(item.context)}
                  <span className="block text-ink-soft" {...c.attrs(SOURCE_KEYS[item.source])}>
                    {c.text(SOURCE_KEYS[item.source])}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-2xl px-6 py-16 text-center" {...c.listAttrs('testimonials.items')}>
          <div className="overflow-hidden rounded-3xl bg-white shadow-lg shadow-ink/5">
            <div aria-hidden="true" className="grid h-2 grid-cols-4">
              <span className="bg-grape" />
              <span className="bg-bubble" />
              <span className="bg-sunny" />
              <span className="bg-mint" />
            </div>
            <div className="p-10">
              <Editable c={c} k="yorumlar.empty.title" as="p" className="font-display text-2xl text-ink" />
              <Editable c={c} k="yorumlar.empty.body" as="p" className="mt-4 text-ink-soft" />
              <a
                href="/kayit"
                className="mt-8 inline-block rounded-full bg-grape px-8 py-4 font-semibold text-white shadow-lg shadow-grape/30 transition hover:bg-ink"
                {...c.attrs('yorumlar.empty.cta')}
              >
                {c.text('yorumlar.empty.cta')}
              </a>
            </div>
          </div>
        </section>
      )}

      <section className="bg-paper-warm py-16 text-center">
        <Editable c={c} k="yorumlar.share.title" as="h2" className="font-display text-2xl text-ink" />
        <Editable c={c} k="yorumlar.share.lead" as="p" className="mx-auto mt-4 max-w-xl px-6 text-ink-soft" />
        <TrackedLink
          href={mapsUrl(c)}
          event="cta_click"
          payload={{ page: 'veli-yorumlari', target: 'google-review' }}
          external
          className="mt-8 inline-block rounded-full border-2 border-grape px-8 py-4 font-semibold text-grape transition hover:bg-grape hover:text-white"
          editAttrs={c.attrs('yorumlar.share.cta')}
        >
          {c.text('yorumlar.share.cta')}
        </TrackedLink>
      </section>
    </div>
  );
}
