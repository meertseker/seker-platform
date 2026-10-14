import { notFound } from 'next/navigation';
import Link from 'next/link';
import PageHero from '@/app/components/PageHero';
import JsonLd from '@/app/components/JsonLd';
import LeadForm from '@/app/components/LeadForm';
import { AGE_GROUPS_CONTENT, getAgeGroup } from '@/content/ageGroups';
import { buildMetadata } from '@/lib/metadata';
import { buildBreadcrumbSchema } from '@/lib/schema';

/** Odak alanı kartlarının şerit renkleri — sitenin aksan sırası. */
const FOCUS_STRIPES = ['bg-grape', 'bg-bubble', 'bg-mint', 'bg-sunny'];

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
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Ana Sayfa', path: '/' },
          { name: 'Yaş Grupları', path: '/yas-gruplari' },
          { name: group.title, path: `/yas-gruplari/${group.slug}` },
        ])}
      />

      <PageHero
        eyebrow={group.ageLabel}
        title={group.headline}
        tone="bubble"
        media={{
          src: group.image,
          alt: `${group.title} etkinlikleri`,
          transitionName: `age-${group.slug}`,
        }}
      />

      <section className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-lg text-ink-soft">{group.intro}</p>
        <p className="mt-6 rounded-2xl bg-paper-warm px-6 py-4 text-ink">
          <strong>Sınıf mevcudu:</strong> {group.classSize}
        </p>
      </section>

      <section className="bg-paper-warm py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center font-display text-3xl text-ink">
            {group.ageLabel} programında odak alanlarımız
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {group.focusAreas.map((area, index) => (
              <div
                key={area.title}
                className="card-lift overflow-hidden rounded-3xl bg-white shadow-sm"
              >
                <div className={`h-1.5 ${FOCUS_STRIPES[index % FOCUS_STRIPES.length]}`} />
                <div className="p-8">
                  <h3 className="font-display text-xl text-ink">{area.title}</h3>
                  <p className="mt-3 text-ink-soft">{area.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="font-display text-3xl text-ink">Günün akışından</h2>
        <ul className="mt-6 space-y-3">
          {group.dailyHighlights.map((item) => (
            <li key={item} className="flex gap-3 text-ink-soft">
              <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-bubble" />
              {item}
            </li>
          ))}
        </ul>
        <Link
          href="/gunluk-akis"
          className="mt-8 inline-block rounded-full border-2 border-grape px-6 py-3 font-semibold text-grape hover:bg-grape hover:text-white"
        >
          Tam günlük akışı görün
        </Link>
      </section>

      <section className="bg-paper-warm py-16">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-center font-display text-3xl text-ink">
            {group.ageLabel} kontenjanımızı sorun
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
