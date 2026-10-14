"use client"
import React, { useState } from 'react'
import Image from 'next/image'
import { SUMMER_BRANCHES, YEAR_ROUND_BRANCHES, type Branch } from '@/content/program'
import { MEDIA } from '@/content/media'

type Season = 'yil-boyu' | 'yaz'

const SEASON_BRANCHES: Record<Season, Branch[]> = {
  'yil-boyu': YEAR_ROUND_BRANCHES,
  yaz: SUMMER_BRANCHES,
}

function resolveInitial(slug?: string): { season: Season; selectedSlug: string } {
  if (slug && YEAR_ROUND_BRANCHES.some((branch) => branch.slug === slug)) {
    return { season: 'yil-boyu', selectedSlug: slug }
  }
  if (slug && SUMMER_BRANCHES.some((branch) => branch.slug === slug)) {
    return { season: 'yaz', selectedSlug: slug }
  }
  return { season: 'yil-boyu', selectedSlug: YEAR_ROUND_BRANCHES[0].slug }
}

/**
 * Ders listesi ve seçilen dersin ayrıntısı. Bütün metinler
 * content/program.ts'den gelir; bu bileşen yalnızca sunum yapar.
 *
 * Fotoğraflar her dersin mediaKey'i üzerinden okul çekimidir.
 * Atölye içi kare henüz yok; bahçe ve açık hava atölyesi kareleri kullanılır.
 */
export default function BranchExplorer({ initialSlug }: { initialSlug?: string }) {
  const initial = resolveInitial(initialSlug)
  const [season, setSeason] = useState<Season>(initial.season)
  const [selectedSlug, setSelectedSlug] = useState<string>(initial.selectedSlug)

  const branches = SEASON_BRANCHES[season]
  const selected = branches.find((b) => b.slug === selectedSlug) ?? branches[0]
  const selectedPhoto = MEDIA[selected.mediaKey]

  const changeSeason = (next: Season) => {
    setSeason(next)
    setSelectedSlug(SEASON_BRANCHES[next][0].slug)
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
                { id: 'yil-boyu', label: 'Yıl boyu' },
                { id: 'yaz', label: 'Yaz dönemi' },
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
              >
                {tab.label}
              </button>
            ))}
          </div>
          <p className="mx-auto mt-5 max-w-2xl text-center text-ink-soft">
            {season === 'yil-boyu'
              ? 'Eğitim yılı boyunca haftalık programda yer alan dersler. Her biri alanında uzman bir öğretmenle yürüyor.'
              : 'Yaz döneminde programa eklenen çalışmalar. Yıl boyu süren dersler yaz aylarında da devam eder.'}
          </p>
        </div>
      </div>

      <div className="bg-paper-warm py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 md:gap-8">
            {branches.map((branch) => {
              const photo = MEDIA[branch.mediaKey]
              return (
                <button
                  key={branch.slug}
                  onClick={() => selectBranch(branch.slug)}
                  className={`card-lift overflow-hidden rounded-3xl bg-white text-left shadow-sm ${
                    selected.slug === branch.slug ? 'ring-2 ring-grape' : ''
                  }`}
                >
                  <div className="relative h-44 overflow-hidden">
                    <Image
                      src={photo.src}
                      alt={photo.alt}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 z-10 bg-gradient-to-t from-ink/80 via-ink/15 to-transparent" />
                    <h3 className="absolute inset-x-0 bottom-0 z-10 p-5 font-display text-2xl leading-tight text-white">
                      {branch.name}
                    </h3>
                  </div>
                  <div className="p-5">
                    <p className="text-sm text-ink-soft">{branch.summary}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-grape">
                      Ayrıntısını okuyun
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
                style={{ viewTransitionName: `branch-${selected.slug}` }}
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
                    {selected.season === 'yaz' ? 'Yaz dönemi' : 'Yıl boyu'}
                  </p>
                  <p className="mt-2 font-display text-3xl leading-tight text-white md:text-4xl">
                    {selected.name}
                  </p>
                </div>
              </div>

              <div className="p-6 md:p-10">
                <div className="space-y-4 text-ink-soft">
                  {selected.body.map((paragraph, index) => (
                    <p key={index} className={index === 0 ? 'text-lg text-ink' : undefined}>
                      {paragraph}
                    </p>
                  ))}
                </div>

                <h3 className="mt-8 font-display text-lg text-ink">Neyi destekliyor?</h3>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {selected.gains.map((gain) => (
                    <li
                      key={gain}
                      className="rounded-full bg-paper-warm px-4 py-2 text-sm text-ink"
                    >
                      {gain}
                    </li>
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
