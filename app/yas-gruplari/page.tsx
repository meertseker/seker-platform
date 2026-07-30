import Image from 'next/image';
import Link from 'next/link';
import Header from '@/app/components/Header';
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

      <section className="bg-ink py-20 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-mark">2 yaştan ilkokula hazırlığa</p>
        <h1 className="mx-auto mt-4 max-w-3xl px-6 font-display text-4xl text-white md:text-5xl">
          Her yaşın kendi programı, kendi sınıfı var.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl px-6 text-paper">
          Dört yaş grubu, dört ayrı gelişim dönemi. Çocuğunuzun bulunduğu gruba tıklayarak
          o yaşa özel programı, günlük akışı ve sınıf mevcudunu inceleyin.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-8 md:grid-cols-2">
          {AGE_GROUPS_CONTENT.map((group) => (
            <Link
              key={group.slug}
              href={`/yas-gruplari/${group.slug}`}
              className="group overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-md"
            >
              <div className="relative h-56 w-full">
                <Image
                  src={group.image}
                  alt={`${group.title} etkinlikleri`}
                  fill
                  className="object-cover transition group-hover:scale-105"
                />
              </div>
              <div className="p-8">
                <p className="text-sm uppercase tracking-[0.2em] text-ink-soft">{group.ageLabel}</p>
                <h2 className="mt-3 font-display text-2xl text-ink">{group.title}</h2>
                <p className="mt-3 text-ink-soft">{group.headline}</p>
                <span className="mt-6 inline-block text-ink underline">
                  Programı incele
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-paper py-16">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-center font-display text-3xl text-ink">
            Çocuğunuzun yaş grubu için kontenjan sorun
          </h2>
          <p className="mt-4 text-center text-ink-soft">
            Sınıf mevcudumuz sınırlı olduğu için kayıtları dönem başında kapatıyoruz.
          </p>
          <div className="mt-10">
            <LeadForm variant="compact" />
          </div>
        </div>
      </section>
    </div>
  );
}
