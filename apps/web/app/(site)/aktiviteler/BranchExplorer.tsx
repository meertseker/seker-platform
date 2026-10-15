"use client"
import React, { useState } from 'react'
import Image from 'next/image'
import { Editable } from '@/app/components/edit/Editable'
import { makeReader } from '@/lib/content/reader'
import type { ReaderData } from '@/lib/content/types'

type Season = 'yil-boyu' | 'yaz'

type BranchItem = {
  id: string
  name: string
  summary: string
  season: Season
  mediaKey: string
  body1: string
  body2: string
  body3: string
  body4: string
  gain1: string
  gain2: string
  gain3: string
  gain4: string
  gain5: string
}

const BODY_FIELDS = ['body1', 'body2', 'body3', 'body4'] as const
const GAIN_FIELDS = ['gain1', 'gain2', 'gain3', 'gain4', 'gain5'] as const

/**
 * Ders listesi ve seçilen dersin ayrıntısı. Bütün metinler
 * `program.branches` listesi ve `aktiviteler.*` alanlarından gelir; bu bileşen yalnızca sunum yapar.
 *
 * Fotoğraflar her dersin mediaKey'i üzerinden okul çekimidir.
 * Atölye içi kare henüz yok; bahçe ve açık hava atölyesi kareleri kullanılır.
 *
 * İstemci bileşeni: sunucu ebeveyn `pickData(data, ['program.', 'aktiviteler.', 'media.'])` geçirir.
 */
export default function BranchExplorer({ data, initialSlug }: { data: ReaderData; initialSlug?: string }) {
  const c = makeReader(data)
  const all = c.list<BranchItem>('program.branches')
  const seasonBranches: Record<Season, BranchItem[]> = {
    'yil-boyu': all.filter((branch) => branch.season === 'yil-boyu'),
    yaz: all.filter((branch) => branch.season === 'yaz'),
  }

  const resolveInitial = (slug?: string): { season: Season; selectedSlug: string } => {
    if (slug && seasonBranches['yil-boyu'].some((branch) => branch.id === slug)) {
      return { season: 'yil-boyu', selectedSlug: slug }
    }
    if (slug && seasonBranches.yaz.some((branch) => branch.id === slug)) {
      return { season: 'yaz', selectedSlug: slug }
    }
    return { season: 'yil-boyu', selectedSlug: seasonBranches['yil-boyu'][0].id }
  }

  const initial = resolveInitial(initialSlug)
  const [season, setSeason] = useState<Season>(initial.season)
  const [selectedSlug, setSelectedSlug] = useState<string>(initial.selectedSlug)

  const branches = seasonBranches[season]
  const selected = branches.find((b) => b.id === selectedSlug) ?? branches[0]
  const selectedPhoto = c.image(`media.${selected.mediaKey}`)

  const changeSeason = (next: Season) => {
    setSeason(next)
    setSelectedSlug(seasonBranches[next][0].id)
  }

  const selectBranch = (slug: string) => {
    setSelectedSlug(slug)
    document.getElementById('ders-detay')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <div className="bg-white py-8">
        <div className="mx-auto max-w-6xl px-6">
          <div
            role="tablist"
            aria-label="Dönem seçimi"
            className="mx-auto flex w-fit gap-1 rounded-full bg-paper-warm p-1"
          >
            {(
              [
                { id: 'yil-boyu', key: 'aktiviteler.tab.yearRound' },
                { id: 'yaz', key: 'aktiviteler.tab.summer' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={season === tab.id}
                onClick={() => changeSeason(tab.id)}
                className={`rounded-full px-6 py-2.5 font-semibold transition-colors ${
                  season === tab.id ? 'bg-grape text-white shadow-sm' : 'text-ink-soft hover:text-ink'
                }`}
                {...c.attrs(tab.key)}
              >
                {c.text(tab.key)}
              </button>
            ))}
          </div>
          <Editable
            c={c}
            k={season === 'yil-boyu' ? 'aktiviteler.season.yearRound.note' : 'aktiviteler.season.summer.note'}
            as="p"
            className="mx-auto mt-5 max-w-2xl text-center text-ink-soft"
          />
        </div>
      </div>

      <div className="bg-paper-warm py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 md:gap-8"
            {...c.listAttrs('program.branches')}
          >
            {branches.map((branch) => {
              const photo = c.image(`media.${branch.mediaKey}`)
              return (
                <button
                  key={branch.id}
                  onClick={() => selectBranch(branch.id)}
                  className={`card-lift overflow-hidden rounded-3xl bg-white text-left shadow-sm ${
                    selected.id === branch.id ? 'ring-2 ring-grape' : ''
                  }`}
                >
                  <div className="relative h-44 overflow-hidden" {...c.attrs(`media.${branch.mediaKey}`)}>
                    <Image
                      src={photo.src}
                      alt={photo.alt}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 z-10 bg-gradient-to-t from-ink/80 via-ink/15 to-transparent" />
                    <Editable
                      c={c}
                      k="program.branches"
                      path={`${branch.id}.name`}
                      value={branch.name}
                      as="h3"
                      className="absolute inset-x-0 bottom-0 z-10 p-5 font-display text-2xl leading-tight text-white"
                    />
                  </div>
                  <div className="p-5">
                    <Editable
                      c={c}
                      k="program.branches"
                      path={`${branch.id}.summary`}
                      value={branch.summary}
                      as="p"
                      className="text-sm text-ink-soft"
                    />
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-grape">
                      {c.text('aktiviteler.card.cta')}
                      <span aria-hidden="true">→</span>
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div id="ders-detay" className="scroll-mt-32 bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="overflow-hidden rounded-3xl shadow-lg shadow-ink/5 ring-1 ring-rule">
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div
                className="relative min-h-64 overflow-hidden md:min-h-full"
                style={{ viewTransitionName: `branch-${selected.id}` }}
              >
                <Image
                  src={selectedPhoto.src}
                  alt={selectedPhoto.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 z-10 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 z-10 p-8">
                  <p className="timecode text-white/80">
                    {selected.season === 'yaz' ? c.text('aktiviteler.tab.summer') : c.text('aktiviteler.tab.yearRound')}
                  </p>
                  {/* Ders adının aynası: kart başlığıyla aynı alan, bu yüzden işaretlenmez. */}
                  <p className="mt-2 font-display text-3xl leading-tight text-white md:text-4xl">
                    {c.fill(selected.name)}
                  </p>
                </div>
              </div>

              <div className="p-6 md:p-10">
                <div className="space-y-4 text-ink-soft">
                  {BODY_FIELDS.filter((field) => selected[field]).map((field, index) => (
                    <Editable
                      key={field}
                      c={c}
                      k="program.branches"
                      path={`${selected.id}.${field}`}
                      value={selected[field]}
                      as="p"
                      className={index === 0 ? 'text-lg text-ink' : undefined}
                    />
                  ))}
                </div>

                <Editable c={c} k="aktiviteler.detail.gains" as="h3" className="mt-8 font-display text-lg text-ink" />
                <ul className="mt-4 flex flex-wrap gap-2">
                  {GAIN_FIELDS.filter((field) => selected[field]).map((field) => (
                    <Editable
                      key={field}
                      c={c}
                      k="program.branches"
                      path={`${selected.id}.${field}`}
                      value={selected[field]}
                      as="li"
                      className="rounded-full bg-paper-warm px-4 py-2 text-sm text-ink"
                    />
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
