import PageHero from '@/app/components/PageHero';
import JsonLd from '@/app/components/JsonLd';
import LeadForm from '@/app/components/LeadForm';
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

        <section className="band-grape relative mt-16 overflow-hidden py-16">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <span className="confetti-float absolute -left-8 top-8 h-32 w-32 rounded-full bg-sunny/15" />
            <span className="confetti-float absolute right-[6%] bottom-10 h-24 w-24 rounded-full bg-bubble/20" />
          </div>
          <div className="relative z-10 mx-auto max-w-2xl px-6">
            <Editable c={c} k="gunlukakis.cta.title" as="h2" className="text-3xl text-white" />
            <Editable c={c} k="gunlukakis.cta.lead" as="p" className="mt-4 text-white/85" />
            <div className="mt-8 rounded-3xl bg-white p-6 shadow-xl shadow-ink/20 md:p-8">
              <LeadForm data={pickData(data, ['form.'])} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
