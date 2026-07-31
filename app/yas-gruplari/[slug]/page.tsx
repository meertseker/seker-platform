import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Header from '@/app/components/Header';
import JsonLd from '@/app/components/JsonLd';
import LeadForm from '@/app/components/LeadForm';
import { AGE_GROUPS_CONTENT, getAgeGroup } from '@/content/ageGroups';
import { buildMetadata } from '@/lib/metadata';
import { buildBreadcrumbSchema } from '@/lib/schema';

export function generateStaticParams() {
  return AGE_GROUPS_CONTENT.map((group) => ({ slug: group.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const group = getAgeGroup(slug);
  if (!group) return {};
  return buildMetadata({
    title: group.metaTitle,
    description: group.metaDescription,
    path: `/yas-gruplari/${group.slug}`,
    image: group.image,
  });
}

export default async function AgeGroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const group = getAgeGroup(slug);
  if (!group) notFound();

  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Ana Sayfa', path: '/' },
          { name: 'Yaş Grupları', path: '/yas-gruplari' },
          { name: group.title, path: `/yas-gruplari/${group.slug}` },
        ])}
      />

      <section className="bg-ink py-20 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-paper/70">{group.ageLabel}</p>
        <h1 className="mx-auto mt-4 max-w-3xl px-6 font-display text-4xl text-white md:text-5xl">
          {group.headline}
        </h1>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-lg text-ink-soft">{group.intro}</p>
        <p className="mt-6 rounded-xl bg-paper px-6 py-4 text-ink">
          <strong>Sınıf mevcudu:</strong> {group.classSize}
        </p>
      </section>

      <section className="bg-paper py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center font-display text-3xl text-ink">
            {group.ageLabel} programında odak alanlarımız
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {group.focusAreas.map((area) => (
              <div key={area.title} className="rounded-xl bg-white p-8">
                <h3 className="font-display text-xl text-ink">{area.title}</h3>
                <p className="mt-3 text-ink-soft">{area.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <Image
            src={group.image}
            alt={`${group.title} etkinlikleri`}
            width={640}
            height={480}
            className="rounded-2xl object-cover"
          />
          <div>
            <h2 className="font-display text-3xl text-ink">Günün akışından</h2>
            <ul className="mt-6 space-y-3">
              {group.dailyHighlights.map((item) => (
                <li key={item} className="flex gap-3 text-ink-soft">
                  <span className="text-ink-soft">—</span>
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/gunluk-akis" className="mt-8 inline-block text-ink underline">
              Tam günlük akışı görün
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-paper py-16">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-center font-display text-3xl text-ink">
            {group.ageLabel} kontenjanımızı sorun
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
