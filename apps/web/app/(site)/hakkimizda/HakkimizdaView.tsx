import Image from 'next/image'
import PageHero from '@/app/components/PageHero'
import AboutSection from '@/app/components/AboutSection'
import JsonLd from '@/app/components/JsonLd'
import LeadForm from '@/app/components/LeadForm'
import { Editable } from '@/app/components/edit/Editable'
import { buildBreadcrumbSchema } from '@/lib/schema'
import { makeReader, pickData } from '@/lib/content/reader'
import type { ReaderData } from '@/lib/content/types'

type Fact = { id: string; value: string; label: string }
type Value = { id: string; title: string; description: string }

/** Değer simgelerinin rengi ve çizimi (id ile eşlenir); metinler `hakkimizda.values` listesinden gelir. */
const VALUE_LOOK: Record<string, { chip: string; path: string }> = {
  sevgi: {
    chip: 'bg-bubble-deep',
    path: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  },
  guven: {
    chip: 'bg-mint-deep',
    path: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  aidiyet: {
    chip: 'bg-grape',
    path: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  bagimsizlik: {
    chip: 'bg-tangerine-deep',
    path: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
}

export default function HakkimizdaView({ data }: { data: ReaderData }) {
  const c = makeReader(data)
  const facts = c.list<Fact>('hakkimizda.facts')
  const values = c.list<Value>('hakkimizda.values')
  const aboutData = pickData(data, ['about.', 'media.'])

  return (
    <div className="min-h-screen bg-paper">
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Ana Sayfa', path: '/' },
          { name: 'Hakkımızda', path: '/hakkimizda' },
        ])}
      />

      <PageHero
        c={c}
        keys={{ eyebrow: 'hakkimizda.hero.eyebrow', title: 'hakkimizda.hero.title', lead: 'hakkimizda.hero.lead' }}
        tone="bubble"
      />

      {/* Doğrulanabilir künye — okulun yaşı ve fiziksel alanı. */}
      <section className="py-12">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4" {...c.listAttrs('hakkimizda.facts')}>
            {facts.map((fact, index) => (
              <div key={fact.id} className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-rule">
                <Editable
                  c={c}
                  k="hakkimizda.facts"
                  path={`${fact.id}.value`}
                  value={fact.value}
                  as="p"
                  className={`font-display text-3xl ${
                    index % 2 === 0 ? 'text-grape' : 'text-bubble-deep'
                  }`}
                />
                <Editable
                  c={c}
                  k="hakkimizda.facts"
                  path={`${fact.id}.label`}
                  value={fact.label}
                  as="p"
                  className="mt-1 text-sm text-ink-soft"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="pb-16">
        <div className="container mx-auto px-4 md:px-6">
          <AboutSection
            data={aboutData}
            id="garden"
            buttonLink="/gunluk-akis"
            imageKey="media.gardenWide"
            imagePosition="right"
            accent="mint"
          />

          <div className="my-16 text-center md:hidden" {...c.attrs('media.mudKitchenSmall')}>
            <Image
              src={c.image('media.mudKitchenSmall').src}
              alt={c.image('media.mudKitchenSmall').alt}
              className="mx-auto rounded-3xl shadow-lg shadow-ink/10"
              width={300}
              height={200}
            />
          </div>

          <div className="mt-16">
            <AboutSection
              data={aboutData}
              id="staff"
              buttonLink="/aktiviteler"
              imageKey="media.gardenWorkshops"
              imagePosition="left"
              accent="bubble"
            />
          </div>
        </div>
      </div>

      {/* Psikolog desteği — velinin en çok merak ettiği başlıklardan biri. */}
      <section className="bg-paper-warm py-16">
        <div className="mx-auto max-w-3xl px-6">
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-rule">
            <div className="h-1.5 bg-sky" />
            <div className="p-8 md:p-10">
              <Editable c={c} k="hakkimizda.psychologist.title" as="h2" className="font-display text-2xl text-ink md:text-3xl" />
              <Editable c={c} k="hakkimizda.psychologist.lead" as="p" className="mt-5 text-lg text-ink" />
              <Editable c={c} k="hakkimizda.psychologist.note" as="p" className="mt-4 text-ink-soft" />
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mb-12 text-center">
            <Editable c={c} k="hakkimizda.values.title" as="h2" className="font-display text-3xl text-ink md:text-4xl" />
            <Editable c={c} k="hakkimizda.values.lead" as="p" className="mx-auto mt-4 max-w-2xl text-ink-soft" />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4" {...c.listAttrs('hakkimizda.values')}>
            {values.map((value) => (
              <div
                key={value.id}
                className="card-lift rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-rule"
              >
                <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${VALUE_LOOK[value.id].chip}`}>
                  <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={VALUE_LOOK[value.id].path} />
                  </svg>
                </div>
                <Editable c={c} k="hakkimizda.values" path={`${value.id}.title`} value={value.title} as="h3" className="mb-2 font-display text-xl text-ink" />
                <Editable c={c} k="hakkimizda.values" path={`${value.id}.description`} value={value.description} as="p" className="text-sm leading-relaxed text-ink-soft" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-paper-warm py-16">
        <div className="mx-auto max-w-2xl px-6">
          <Editable c={c} k="hakkimizda.visit.title" as="h2" className="text-center font-display text-3xl text-ink" />
          <Editable c={c} k="hakkimizda.visit.lead" as="p" className="mt-4 text-center text-ink-soft" />
          <div className="mt-10 rounded-3xl bg-white p-6 shadow-lg shadow-ink/5 md:p-8">
            <LeadForm data={pickData(data, ['form.'])} />
          </div>
        </div>
      </section>
    </div>
  )
}
