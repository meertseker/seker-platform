import PageHero from '@/app/components/PageHero';
import JsonLd from '@/app/components/JsonLd';
import FormSection from '@/app/components/FormSection';
import WeekRhythmSection from '@/app/components/WeekRhythmSection';
import TimeSpine from '@/app/components/cine/TimeSpine';
import DayChapters from '@/app/components/cine/DayChapters';
import { Editable } from '@/app/components/edit/Editable';
import { buildBreadcrumbSchema } from '@/lib/schema';
import { makeReader, pickData } from '@/lib/content/reader';
import type { ReaderData } from '@/lib/content/types';

export default function GunlukAkisView({ data }: { data: ReaderData }) {
  const c = makeReader(data);

  return (
    <div className="min-h-screen bg-paper">
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Ana Sayfa', path: '/' },
          { name: 'Günlük Akış', path: '/gunluk-akis' },
        ])}
      />
      <main>
        <PageHero
          c={c}
          keys={{ eyebrow: 'gunlukakis.hero.eyebrow', title: 'gunlukakis.hero.title', lead: 'gunlukakis.hero.lead' }}
          tone="sunny"
        />

        {/* Program seçenekleri — akışı okumaya başlamadan önce çerçeve. */}
        <section className="mx-auto max-w-6xl px-6 pt-12">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-paper-warm p-6">
              <Editable c={c} k="gunlukakis.plan.full.label" as="p" className="timecode text-grape" />
              <Editable c={c} k="gunlukakis.plan.full.hours" as="p" className="mt-2 font-display text-2xl text-ink" />
              <Editable c={c} k="gunlukakis.plan.full.note" as="p" className="mt-2 text-sm text-ink-soft" />
            </div>
            <div className="rounded-3xl bg-paper-warm p-6">
              <Editable c={c} k="gunlukakis.plan.half.label" as="p" className="timecode text-bubble-deep" />
              <Editable c={c} k="gunlukakis.plan.half.hours" as="p" className="mt-2 font-display text-2xl text-ink" />
              <Editable c={c} k="gunlukakis.plan.half.note" as="p" className="mt-2 text-sm text-ink-soft" />
            </div>
          </div>
        </section>

        <div className="mx-auto grid max-w-6xl gap-10 px-6 pt-14 lg:grid-cols-[180px_1fr]">
          <TimeSpine data={pickData(data, ['day.', 'gunlukakis.'])} />
          <DayChapters c={c} />
        </div>

        {/* Haftanın günlerine bağlı ritüeller — günün akışının haftalık karşılığı (ana sayfadan taşındı). */}
        <WeekRhythmSection c={c} />

        <FormSection c={c} data={data} keys={{ title: 'gunlukakis.cta.title', lead: 'gunlukakis.cta.lead' }} />
      </main>
    </div>
  );
}
