import Image from 'next/image'
import Link from 'next/link'
import Timecode from './cine/Timecode'
import { Editable } from './edit/Editable'
import type { Reader } from '@/lib/content/types'

type BranchItem = { id: string; name: string; summary: string; season: string; mediaKey: string }

/**
 * Öne çıkan dört dersin kartı. Fotoğraflar content/program.ts'deki
 * mediaKey üzerinden gelir — hepsi okulun kendi çekimi.
 *
 * Ders adları ve açıklamaları da program.branches listesinden okunur.
 */

/** Kartta öne çıkan dört ders; kalanlar aşağıdaki şeritte adıyla geçer. */
const FEATURED_SLUGS = ['seramik', 'robotik-kodlama', 'satranc', 'bale-dans'] as const

const ActivitiesSection = ({ c }: { c: Reader }) => {
  const branches = c.list<BranchItem>('program.branches')
  const featured = FEATURED_SLUGS.map((slug) => branches.find((b) => b.id === slug)).filter(
    (branch): branch is BranchItem => Boolean(branch),
  )
  const yearRound = branches.filter((b) => b.season === 'yil-boyu')

  return (
    <section className="bg-paper-warm py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <Timecode editAttrs={c.attrs('home.activities.eyebrow')}>{c.text('home.activities.eyebrow')}</Timecode>
          <Editable c={c} k="home.activities.title" as="h2" className="mt-2 text-3xl text-ink md:text-4xl" />
          <Editable c={c} k="home.activities.lead" as="p" className="mx-auto mt-4 max-w-2xl text-ink-soft" />
        </div>

        {/* Telefonda tek sıra yatay kaydırma (dört fotoğraflı kart alt alta ~1100 px tutuyordu); md+ ızgara. */}
        <div
          className="mt-8 -mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 md:mx-0 md:mt-12 md:grid md:grid-cols-2 md:gap-6 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-4"
          {...c.listAttrs('program.branches')}
        >
          {featured.map((branch) => {
            const photo = c.image(`media.${branch.mediaKey}`)
            return (
              <Link
                key={branch.id}
                href={`/aktiviteler?ders=${branch.id}`}
                className="card-lift w-64 shrink-0 snap-start overflow-hidden rounded-3xl bg-white shadow-sm md:w-auto"
              >
                <div
                  className="relative h-44 overflow-hidden"
                  style={{ viewTransitionName: `branch-${branch.id}` }}
                  {...c.attrs(`media.${branch.mediaKey}`)}
                >
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    fill
                    sizes="(max-width: 768px) 256px, (max-width: 1024px) 50vw, 25vw"
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
                </div>
              </Link>
            )
          })}
        </div>

        {/* Programın tamamı — velinin aradığı ders adı listede görünsün. */}
        <ul className="mt-10 flex flex-wrap justify-center gap-2">
          {yearRound.map((branch) => (
            <li key={branch.id}>
              <Link
                href={`/aktiviteler?ders=${branch.id}`}
                className="inline-block rounded-full bg-white px-4 py-2 text-sm text-ink shadow-sm ring-1 ring-rule hover:text-grape"
              >
                {c.fill(branch.name)}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-10 text-center">
          <Link
            href="/aktiviteler"
            className="inline-block rounded-full border-2 border-grape px-8 py-3 font-semibold text-grape hover:bg-grape hover:text-white"
            {...c.attrs('home.activities.cta')}
          >
            {c.text('home.activities.cta')}
          </Link>
        </div>
      </div>
    </section>
  )
}

export default ActivitiesSection
