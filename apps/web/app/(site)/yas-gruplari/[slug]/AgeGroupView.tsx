import Link from 'next/link';
import PageHero from '@/app/components/PageHero';
import JsonLd from '@/app/components/JsonLd';
import LeadForm from '@/app/components/LeadForm';
import { Editable } from '@/app/components/edit/Editable';
import { buildBreadcrumbSchema } from '@/lib/schema';
import { makeReader, pickData } from '@/lib/content/reader';
import type { ReaderData } from '@/lib/content/types';

export type AgeGroupItem = {
  id: string;
  title: string;
  ageLabel: string;
  headline: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  classSize: string;
  image: string;
} & Record<string, string>;

/** Odak alanı kartlarının şerit renkleri — sitenin aksan sırası. */
const FOCUS_STRIPES = ['bg-grape', 'bg-bubble', 'bg-mint', 'bg-sunny'];

const FOCUS_NUMBERS = [1, 2, 3, 4];
const HIGHLIGHT_FIELDS = ['highlight1', 'highlight2', 'highlight3', 'highlight4', 'highlight5'];

export default function AgeGroupView({ data, slug }: { data: ReaderData; slug: string }) {
  const c = makeReader(data);
  const group = c.list<AgeGroupItem>('ageGroups.items').find((g) => g.id === slug);
  if (!group) throw new Error(`Yaş grubu bulunamadı: ${slug}`);
  const path = (field: string) => `${group.id}.${field}`;
  const ageLabel = c.fill(group.ageLabel);

  return (
    <div className="min-h-screen bg-paper">
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Ana Sayfa', path: '/' },
          { name: 'Yaş Grupları', path: '/yas-gruplari' },
          { name: c.fill(group.title), path: `/yas-gruplari/${group.id}` },
        ])}
      />

      <PageHero
        eyebrow={ageLabel}
        title={c.fill(group.headline)}
        editAttrs={{
          eyebrow: c.attrs('ageGroups.items', path('ageLabel')),
          title: c.attrs('ageGroups.items', path('headline')),
        }}
        tone="bubble"
        media={{
          src: group.image,
          alt: `${c.fill(group.title)} etkinlikleri`,
          transitionName: `age-${group.id}`,
        }}
      />

      <section className="mx-auto max-w-3xl px-6 py-16" {...c.listAttrs('ageGroups.items')}>
        <Editable c={c} k="ageGroups.items" path={path('intro')} value={group.intro} as="p" className="text-lg text-ink-soft" />
        <p className="mt-6 rounded-2xl bg-paper-warm px-6 py-4 text-ink">
          <strong {...c.attrs('yasgrubu.classSize.label')}>{c.text('yasgrubu.classSize.label')}</strong> {c.fill(group.classSize)}
        </p>
      </section>

      <section className="bg-paper-warm py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center font-display text-3xl text-ink">
            {ageLabel} {c.text('yasgrubu.focus.suffix')}
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {FOCUS_NUMBERS.map((n, index) => (
              <div
                key={n}
                className="card-lift overflow-hidden rounded-3xl bg-white shadow-sm"
              >
                <div className={`h-1.5 ${FOCUS_STRIPES[index % FOCUS_STRIPES.length]}`} />
                <div className="p-8">
                  <Editable c={c} k="ageGroups.items" path={path(`focus${n}Title`)} value={group[`focus${n}Title`]} as="h3" className="font-display text-xl text-ink" />
                  <Editable c={c} k="ageGroups.items" path={path(`focus${n}Text`)} value={group[`focus${n}Text`]} as="p" className="mt-3 text-ink-soft" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <Editable c={c} k="yasgrubu.flow.title" as="h2" className="font-display text-3xl text-ink" />
        <ul className="mt-6 space-y-3">
          {HIGHLIGHT_FIELDS.filter((field) => group[field]).map((field) => (
            <li key={field} className="flex gap-3 text-ink-soft" {...c.attrs('ageGroups.items', path(field))}>
              <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-bubble" />
              {c.fill(group[field])}
            </li>
          ))}
        </ul>
        <Link
          href="/gunluk-akis"
          className="mt-8 inline-block rounded-full border-2 border-grape px-6 py-3 font-semibold text-grape hover:bg-grape hover:text-white"
          {...c.attrs('yasgrubu.flow.cta')}
        >
          {c.text('yasgrubu.flow.cta')}
        </Link>
      </section>

      <section className="bg-paper-warm py-16">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-center font-display text-3xl text-ink">
            {ageLabel} {c.text('yasgrubu.cta.suffix')}
          </h2>
          <Editable c={c} k="yasgrubu.cta.lead" as="p" className="mt-4 text-center text-ink-soft" />
          <div className="mt-10 rounded-3xl bg-white p-6 shadow-lg shadow-ink/5 md:p-8">
            <LeadForm data={pickData(data, ['form.'])} />
          </div>
        </div>
      </section>
    </div>
  );
}
