import Header from '@/app/components/Header';
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

      <section className="bg-ink py-20 text-center">
        <h1 className="px-6 font-display text-4xl text-white md:text-5xl">Veli Yorumları</h1>
        <p className="mx-auto mt-6 max-w-2xl px-6 text-paper">
          Beykent Büyükçekmece&apos;de çocuğunuz için okul ararken en çok güvendiğiniz kaynak,
          hâlihazırda bizi tercih etmiş ailelerin deneyimidir.
        </p>
      </section>

      {PUBLISHED_TESTIMONIALS.length > 0 ? (
        <section className="mx-auto max-w-5xl px-6 py-16">
          <div className="grid gap-8 md:grid-cols-2">
            {PUBLISHED_TESTIMONIALS.map((item) => (
              <figure key={item.id} className="rounded-2xl bg-paper p-8">
                <blockquote className="text-lg leading-relaxed text-ink">
                  &ldquo;{item.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-6 text-sm text-ink-soft">
                  <span className="font-medium text-ink">{item.author}</span> — {item.context}
                  <span className="block text-ink-soft">{SOURCE_LABELS[item.source]}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-2xl px-6 py-16 text-center">
          <div className="rounded-2xl border border-rule bg-paper p-10">
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
              className="mt-8 inline-block rounded-full bg-ink px-8 py-4 font-medium text-white transition hover:bg-ink-soft"
            >
              Okul Ziyareti Planlayın
            </a>
          </div>
        </section>
      )}

      <section className="bg-paper py-16 text-center">
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
          className="mt-8 inline-block rounded-full border border-ink px-8 py-4 font-medium text-ink transition hover:bg-paper-warm"
        >
          Google&apos;da Yorum Bırakın
        </TrackedLink>
      </section>
    </div>
  );
}
