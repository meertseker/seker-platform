import Header from '@/app/components/Header';
import PageHero from '@/app/components/PageHero';
import JsonLd from '@/app/components/JsonLd';
import TrackedLink from '@/app/components/TrackedLink';
import { buildMetadata } from '@/lib/metadata';
import { buildBreadcrumbSchema } from '@/lib/schema';
import { SITE } from '@/lib/site';
import { PUBLISHED_TESTIMONIALS } from '@/content/testimonials';

export const metadata = buildMetadata({
  title: 'Veli Yorumları',
  description:
    'Şeker Anaokulu velilerinin deneyimleri. Beykent Büyükçekmece\'de anaokulu arayan aileler için gerçek veli görüşleri.',
  path: '/veli-yorumlari',
});

const SOURCE_LABELS: Record<(typeof PUBLISHED_TESTIMONIALS)[number]['source'], string> = {
  google: 'Google İşletme Profili',
  form: 'Ön görüşme formu',
  'yuz-yuze': 'Yüz yüze görüşme',
};

/** Alıntı rozetlerinin renkleri — sitenin aksan sırası. */
const QUOTE_ACCENTS = ['bg-grape', 'bg-bubble-deep', 'bg-mint-deep', 'bg-sunny-deep'];

export default function VeliYorumlariPage() {
  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Ana Sayfa', path: '/' },
          { name: 'Veli Yorumları', path: '/veli-yorumlari' },
        ])}
      />

      <PageHero
        eyebrow="Veli Yorumları"
        title="Bizi seçen ailelerin deneyimi"
        lead="Beykent Büyükçekmece'de çocuğunuz için okul ararken en çok güvendiğiniz kaynak, hâlihazırda bizi tercih etmiş ailelerin deneyimidir."
        tone="sunny"
      />

      {PUBLISHED_TESTIMONIALS.length > 0 ? (
        <section className="mx-auto max-w-5xl px-6 py-16">
          <div className="grid gap-8 md:grid-cols-2">
            {PUBLISHED_TESTIMONIALS.map((item, index) => (
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
                <blockquote className="text-lg leading-relaxed text-ink">
                  &ldquo;{item.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-6 text-sm text-ink-soft">
                  <span className="font-semibold text-ink">{item.author}</span> — {item.context}
                  <span className="block text-ink-soft">{SOURCE_LABELS[item.source]}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-2xl px-6 py-16 text-center">
          <div className="overflow-hidden rounded-3xl bg-white shadow-lg shadow-ink/5">
            <div aria-hidden="true" className="grid h-2 grid-cols-4">
              <span className="bg-grape" />
              <span className="bg-bubble" />
              <span className="bg-sunny" />
              <span className="bg-mint" />
            </div>
            <div className="p-10">
              <p className="font-display text-2xl text-ink">
                Veli yorumlarımızı burada topluyoruz.
              </p>
              <p className="mt-4 text-ink-soft">
                Yorumları yalnızca velilerimizden yazılı onay aldıktan sonra yayımlıyoruz; bu
                sayfa yakında dolacak. Bu arada en güvenilir bilgi kaynağı okulumuzu bizzat
                görmek — sınıfları ve öğretmenlerimizle tanışmak için bir ziyaret planlayalım.
              </p>
              <a
                href="/kayit"
                className="mt-8 inline-block rounded-full bg-grape px-8 py-4 font-semibold text-white shadow-lg shadow-grape/30 transition hover:bg-ink"
              >
                Okul Ziyareti Planlayın
              </a>
            </div>
          </div>
        </section>
      )}

      <section className="bg-paper-warm py-16 text-center">
        <h2 className="font-display text-2xl text-ink">
          Şeker Anaokulu&apos;nda veliyseniz deneyiminizi paylaşın
        </h2>
        <p className="mx-auto mt-4 max-w-xl px-6 text-ink-soft">
          Google İşletme Profilimiz üzerinden bıraktığınız yorumlar diğer aileler için de yol
          gösterici oluyor.
        </p>
        <TrackedLink
          href={SITE.mapsUrl}
          event="cta_click"
          payload={{ page: 'veli-yorumlari', target: 'google-review' }}
          external
          className="mt-8 inline-block rounded-full border-2 border-grape px-8 py-4 font-semibold text-grape transition hover:bg-grape hover:text-white"
        >
          Google&apos;da Yorum Bırakın
        </TrackedLink>
      </section>
    </div>
  );
}
