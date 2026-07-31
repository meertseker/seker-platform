import Header from '@/app/components/Header';
import JsonLd from '@/app/components/JsonLd';
import LeadForm from '@/app/components/LeadForm';
import { DAILY_FLOW } from '@/content/dailyFlow';
import { buildMetadata } from '@/lib/metadata';
import { buildBreadcrumbSchema } from '@/lib/schema';

export const metadata = buildMetadata({
  title: 'Günlük Akış',
  description:
    'Şeker Anaokulu\'nda bir gün nasıl geçiyor? 07:15\'ten 19:15\'e saat saat günlük programımız, öğün düzenimiz ve atölye saatlerimiz.',
  path: '/gunluk-akis',
});

export default function GunlukAkisPage() {
  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Ana Sayfa', path: '/' },
          { name: 'Günlük Akış', path: '/gunluk-akis' },
        ])}
      />

      <section className="bg-ink py-20 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-paper/70">07:15 – 19:15</p>
        <h1 className="mx-auto mt-4 max-w-3xl px-6 font-display text-4xl text-white md:text-5xl">
          Çocuğunuzun günü saat saat.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl px-6 text-paper">
          Karşılamadan uğurlamaya kadar her saatin bir amacı var.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <ol className="relative space-y-10 border-l-2 border-rule pl-8">
          {DAILY_FLOW.map((item) => (
            <li key={item.time} className="relative">
              <span className="absolute -left-[2.55rem] top-1 h-4 w-4 rounded-full bg-ink-soft" />
              <p className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
                {item.time}
              </p>
              <h2 className="mt-1 font-display text-xl text-ink">{item.title}</h2>
              <p className="mt-2 text-ink-soft">{item.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-paper py-16">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-center font-display text-3xl text-ink">
            Bu akışı yerinde görmek ister misiniz?
          </h2>
          <p className="mt-4 text-center text-ink-soft">
            Ön görüşme sırasında sınıfları ve günün akışını birlikte geziyoruz.
          </p>
          <div className="mt-10">
            <LeadForm variant="compact" />
          </div>
        </div>
      </section>
    </div>
  );
}
