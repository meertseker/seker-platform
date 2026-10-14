import Image from 'next/image'
import Link from 'next/link'
import Timecode from './cine/Timecode'
import { YEAR_ROUND_BRANCHES, getBranch } from '@/content/program'
import { MEDIA } from '@/content/media'

/**
 * Öne çıkan dört dersin kartı. Fotoğraflar content/program.ts'deki
 * mediaKey üzerinden gelir — hepsi okulun kendi çekimi.
 *
 * Ders adları ve açıklamaları da oradan okunur.
 */

/** Kartta öne çıkan dört ders; kalanlar aşağıdaki şeritte adıyla geçer. */
const FEATURED_SLUGS = ['seramik', 'robotik-kodlama', 'satranc', 'bale-dans'] as const

const ActivitiesSection = () => {
  const featured = FEATURED_SLUGS.map((slug) => getBranch(slug)).filter(
    (branch): branch is NonNullable<typeof branch> => Boolean(branch),
  )

  return (
    <section className="bg-paper-warm py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <Timecode>Branşlar</Timecode>
          <h2 className="mt-2 text-3xl text-ink md:text-4xl">Branş Derslerimiz</h2>
          <p className="mx-auto mt-4 max-w-2xl text-ink-soft">
            Hangi çocuğun neyle açılacağını önceden bilemezsiniz. Bu yüzden
            programımızı farklı branş ve çalışmalarla zenginleştiriyor, her
            çocuğa kendi ilgi alanını bulabileceği kadar çok kapı açıyoruz.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((branch) => {
            const photo = MEDIA[branch.mediaKey]
            return (
              <Link
                key={branch.slug}
                href={`/aktiviteler?ders=${branch.slug}`}
                className="card-lift overflow-hidden rounded-3xl bg-white shadow-sm"
              >
                <div
                  className="relative h-44 overflow-hidden"
                  style={{ viewTransitionName: `branch-${branch.slug}` }}
                >
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 z-10 bg-gradient-to-t from-ink/80 via-ink/15 to-transparent" />
                  <h3 className="absolute inset-x-0 bottom-0 z-10 p-5 font-display text-2xl leading-tight text-white">
                    {branch.name}
                  </h3>
                </div>
                <div className="p-5">
                  <p className="text-sm text-ink-soft">{branch.summary}</p>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Programın tamamı — velinin aradığı ders adı listede görünsün. */}
        <ul className="mt-10 flex flex-wrap justify-center gap-2">
          {YEAR_ROUND_BRANCHES.map((branch) => (
            <li key={branch.slug}>
              <Link
                href={`/aktiviteler?ders=${branch.slug}`}
                className="inline-block rounded-full bg-white px-4 py-2 text-sm text-ink shadow-sm ring-1 ring-rule hover:text-grape"
              >
                {branch.name}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-10 text-center">
          <Link
            href="/aktiviteler"
            className="inline-block rounded-full border-2 border-grape px-8 py-3 font-semibold text-grape hover:bg-grape hover:text-white"
          >
            Bütün derslerin ayrıntısını görün
          </Link>
        </div>
      </div>
    </section>
  )
}

export default ActivitiesSection
