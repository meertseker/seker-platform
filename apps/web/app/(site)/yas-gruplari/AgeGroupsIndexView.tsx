import Image from 'next/image';
import Link from 'next/link';
import PageHero from '@/app/components/PageHero';
import JsonLd from '@/app/components/JsonLd';
import LeadForm from '@/app/components/LeadForm';
import { Editable } from '@/app/components/edit/Editable';
import { buildBreadcrumbSchema } from '@/lib/schema';
import { makeReader } from '@/lib/content/reader';
import type { ReaderData } from '@/lib/content/types';

type AgeGroupCard = { id: string; title: string; ageLabel: string; headline: string; image: string };

/** Yaş grubu kartlarının şerit renkleri — küçükten büyüğe sabit sıra. */
const AGE_STRIPES = ['bg-bubble', 'bg-sunny', 'bg-mint', 'bg-sky'];

export default function AgeGroupsIndexView({ data }: { data: ReaderData }) {
  const c = makeReader(data);
  const groups = c.list<AgeGroupCard>('ageGroups.items');

  return (
    <div className="min-h-screen bg-paper">
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Ana Sayfa', path: '/' },
          { name: 'Yaş Grupları', path: '/yas-gruplari' },
        ])}
      />

      <PageHero
        c={c}
        keys={{ eyebrow: 'yasgruplari.hero.eyebrow', title: 'yasgruplari.hero.title', lead: 'yasgruplari.hero.lead' }}
        tone="grape"
      />

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-8 md:grid-cols-2" {...c.listAttrs('ageGroups.items')}>
          {groups.map((group, index) => (
            <Link
              key={group.id}
              href={`/yas-gruplari/${group.id}`}
              className="card-lift group overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-rule hover:shadow-xl hover:shadow-ink/10"
            >
              <div className={`h-2 ${AGE_STRIPES[index % AGE_STRIPES.length]}`} />
              <div
                className="relative h-56 w-full"
                style={{ viewTransitionName: `age-${group.id}` }}
              >
                <Image
                  src={group.image}
                  alt={`${c.fill(group.title)} etkinlikleri`}
                  fill
                  className="object-cover transition group-hover:scale-105"
                />
              </div>
              <div className="p-8">
                <Editable c={c} k="ageGroups.items" path={`${group.id}.ageLabel`} value={group.ageLabel} as="p" className="timecode text-grape" />
                <Editable c={c} k="ageGroups.items" path={`${group.id}.title`} value={group.title} as="h2" className="mt-3 font-display text-2xl text-ink" />
                <Editable c={c} k="ageGroups.items" path={`${group.id}.headline`} value={group.headline} as="p" className="mt-3 text-ink-soft" />
                <span className="mt-6 inline-flex items-center gap-2 font-semibold text-grape">
                  {c.text('yasgruplari.card.cta')}
                  <span aria-hidden="true" className="transition group-hover:translate-x-1">→</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-paper-warm py-16">
        <div className="mx-auto max-w-2xl px-6">
          <Editable c={c} k="yasgruplari.cta.title" as="h2" className="text-center font-display text-3xl text-ink" />
          <Editable c={c} k="yasgruplari.cta.lead" as="p" className="mt-4 text-center text-ink-soft" />
          <div className="mt-10 rounded-3xl bg-white p-6 shadow-lg shadow-ink/5 md:p-8">
            <LeadForm />
          </div>
        </div>
      </section>
    </div>
  );
}
