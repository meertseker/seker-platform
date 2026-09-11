import Image from 'next/image';
import Link from 'next/link';
import Header from '@/app/components/Header';
import PageHero from '@/app/components/PageHero';
import JsonLd from '@/app/components/JsonLd';
import LeadForm from '@/app/components/LeadForm';
import { AGE_GROUPS_CONTENT } from '@/content/ageGroups';
import { buildMetadata } from '@/lib/metadata';
import { buildBreadcrumbSchema } from '@/lib/schema';

export const metadata = buildMetadata({
  title: 'Yaş Grupları',
  description:
    'Özel Şeker Anaokulu\'nda 2 yaşından ilkokula hazırlığa kadar dört yaş grubu: 2-3 yaş oyun grubu, 3-4 yaş, 4-5 yaş ve 5-6 yaş sınıfları. Her grup için ayrı program ve 10 kişilik sınıf mevcudu.',
  path: '/yas-gruplari',
});

/** Yaş grubu kartlarının şerit renkleri — küçükten büyüğe sabit sıra. */
const AGE_STRIPES = ['bg-bubble', 'bg-sunny', 'bg-mint', 'bg-sky'];

export default function AgeGroupsIndexPage() {
  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Ana Sayfa', path: '/' },
          { name: 'Yaş Grupları', path: '/yas-gruplari' },
        ])}
      />

      <PageHero
        eyebrow="2 yaştan ilkokula hazırlığa"
        title="Her yaşın kendi programı, kendi sınıfı var."
        lead="Dört yaş grubu, dört ayrı gelişim dönemi. Çocuğunuzun bulunduğu gruba tıklayarak o yaşa özel programı, günlük akışı ve sınıf mevcudunu inceleyin."
        tone="grape"
      />

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-8 md:grid-cols-2">
          {AGE_GROUPS_CONTENT.map((group, index) => (
            <Link
              key={group.slug}
              href={`/yas-gruplari/${group.slug}`}
              className="card-lift group overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-rule hover:shadow-xl hover:shadow-ink/10"
            >
              <div className={`h-2 ${AGE_STRIPES[index % AGE_STRIPES.length]}`} />
              <div className="relative h-56 w-full">
                <Image
                  src={group.image}
                  alt={`${group.title} etkinlikleri`}
                  fill
                  className="object-cover transition group-hover:scale-105"
                />
              </div>
              <div className="p-8">
                <p className="timecode text-grape">{group.ageLabel}</p>
                <h2 className="mt-3 font-display text-2xl text-ink">{group.title}</h2>
                <p className="mt-3 text-ink-soft">{group.headline}</p>
                <span className="mt-6 inline-flex items-center gap-2 font-semibold text-grape">
                  Programı incele
                  <span aria-hidden="true" className="transition group-hover:translate-x-1">→</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-paper-warm py-16">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-center font-display text-3xl text-ink">
            Çocuğunuzun yaş grubu için kontenjan sorun
          </h2>
          <p className="mt-4 text-center text-ink-soft">
            Sınıf mevcudumuz sınırlı olduğu için kayıtları dönem başında kapatıyoruz.
          </p>
          <div className="mt-10 rounded-3xl bg-white p-6 shadow-lg shadow-ink/5 md:p-8">
            <LeadForm />
          </div>
        </div>
      </section>
    </div>
  );
}
