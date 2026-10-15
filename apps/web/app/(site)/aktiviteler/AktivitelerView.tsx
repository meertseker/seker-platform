import type { ReactNode } from 'react';
import PageHero from '@/app/components/PageHero';
import JsonLd from '@/app/components/JsonLd';
import LeadForm from '@/app/components/LeadForm';
import BranchExplorer from './BranchExplorer';
import { Editable } from '@/app/components/edit/Editable';
import { buildBreadcrumbSchema } from '@/lib/schema';
import { makeReader, pickData } from '@/lib/content/reader';
import type { ReaderData } from '@/lib/content/types';

type WeekDay = { id: string; day: string; title: string; description: string };

/** İstemci keşfedicinin ihtiyaç duyduğu içerik dilimi (sunucu ebeveyn bunu geçirir). */
export const EXPLORER_PREFIXES = ['program.', 'aktiviteler.', 'media.'];

/**
 * `explorer`: sayfa `?ders=` parametresini okuyan Suspense sarmalını geçirir;
 * verilmezse parametresiz hâli (ilk ders seçili) basılır.
 */
export default function AktivitelerView({ data, explorer }: { data: ReaderData; explorer?: ReactNode }) {
  const c = makeReader(data);
  const days = c.list<WeekDay>('program.weekDays');

  return (
    <div className="min-h-screen bg-paper-warm">
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Ana Sayfa', path: '/' },
          { name: 'Branş Dersleri', path: '/aktiviteler' },
        ])}
      />

      <PageHero
        c={c}
        keys={{ eyebrow: 'aktiviteler.hero.eyebrow', title: 'aktiviteler.hero.title', lead: 'aktiviteler.hero.lead' }}
        tone="grape"
        scallopTone="white"
      />

      {explorer ?? <BranchExplorer data={pickData(data, EXPLORER_PREFIXES)} />}

      {/* Haftanın günlerine bağlı ritüeller — derslerle birlikte okunması anlamlı. */}
      <section className="bg-paper-warm py-16">
        <div className="mx-auto max-w-6xl px-6">
          <Editable c={c} k="aktiviteler.week.title" as="h2" className="text-center font-display text-3xl text-ink" />
          <Editable c={c} k="aktiviteler.week.lead" as="p" className="mx-auto mt-4 max-w-2xl text-center text-ink-soft" />
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5" {...c.listAttrs('program.weekDays')}>
            {days.map((item) => (
              <li key={item.id} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-rule">
                <Editable c={c} k="program.weekDays" path={`${item.id}.day`} value={item.day} as="p" className="timecode text-grape" />
                <Editable c={c} k="program.weekDays" path={`${item.id}.title`} value={item.title} as="h3" className="mt-3 font-display text-lg leading-snug text-ink" />
                <Editable c={c} k="program.weekDays" path={`${item.id}.description`} value={item.description} as="p" className="mt-3 text-sm leading-relaxed text-ink-soft" />
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-2xl px-6">
          <Editable c={c} k="aktiviteler.cta.title" as="h2" className="text-center font-display text-3xl text-ink" />
          <Editable c={c} k="aktiviteler.cta.lead" as="p" className="mt-4 text-center text-ink-soft" />
          <div className="mt-10 rounded-3xl bg-white p-6 shadow-lg shadow-ink/5 ring-1 ring-rule md:p-8">
            <LeadForm data={pickData(data, ['form.'])} />
          </div>
        </div>
      </section>
    </div>
  );
}
