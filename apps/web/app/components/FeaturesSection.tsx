import Link from 'next/link'
import Timecode from './cine/Timecode'
import { Editable } from './edit/Editable'
import type { Reader } from '@/lib/content/types'

/**
 * Dört kart, okulun kendi tanıtım metninde öne çıkardığı dört uygulamayı
 * taşır: sınıfların doğum ayına göre kurulması, haftanın beş günü Montessori,
 * günlük İngilizce ve okulda görev yapan uzman psikolog. Güvenlik ve
 * beslenme ayrıntıları burada yer almaz; onların kendi sayfaları var.
 */
const FEATURES = [
  {
    id: 'taniyoruz',
    href: '/yas-gruplari',
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
      </svg>
    ),
  },
  {
    id: 'montessori',
    href: '/egitim-yaklasimimiz',
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    id: 'ingilizce',
    href: '/egitim-yaklasimimiz',
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    id: 'psikolog',
    href: '/hakkimizda#guvenlik',
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
]

/** Kart aksanları — dört kartın her biri sitenin şeker paletinden bir ton alır. */
const ACCENTS = [
  { chip: 'bg-grape', ring: 'ring-grape/20' },
  { chip: 'bg-bubble-deep', ring: 'ring-bubble/30' },
  { chip: 'bg-mint-deep', ring: 'ring-mint/30' },
  { chip: 'bg-tangerine-deep', ring: 'ring-tangerine/30' },
]

const FeaturesSection = ({ c }: { c: Reader }) => {
  const cards = c.list<{ id: string; title: string; description: string }>('home.features.cards')
  return (
    <div className="bg-paper py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <Timecode editAttrs={c.attrs('home.features.eyebrow')}>{c.text('home.features.eyebrow')}</Timecode>
          <Editable c={c} k="home.features.title" as="h2" className="mt-2 text-3xl text-ink md:text-4xl" />
          <Editable c={c} k="home.features.lead" as="p" className="mx-auto mt-4 max-w-2xl text-ink-soft" />
        </div>

        <div
          className="mt-8 grid grid-cols-1 gap-4 md:mt-12 md:grid-cols-2 md:gap-6 lg:grid-cols-4"
          {...c.listAttrs('home.features.cards')}
        >
          {cards.map((card, index) => {
            const feature = FEATURES.find((f) => f.id === card.id)
            if (!feature) return null
            return (
            <Link
              key={card.id}
              href={feature.href}
              /* Telefonda simge solda, yazı sağda (kısa kart); md+ dikey ve ortalı. */
              className={`card-lift flex items-start gap-4 rounded-3xl bg-white p-5 text-left shadow-sm ring-1 md:block md:p-6 md:text-center ${ACCENTS[index % ACCENTS.length].ring}`}
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white md:mx-auto md:mb-4 md:h-14 md:w-14 ${ACCENTS[index % ACCENTS.length].chip}`}
              >
                {feature.icon}
              </div>
              <div>
                <Editable c={c} k="home.features.cards" path={`${card.id}.title`} value={card.title} as="h3" className="text-lg text-ink" />
                <Editable
                  c={c}
                  k="home.features.cards"
                  path={`${card.id}.description`}
                  value={card.description}
                  as="p"
                  className="mt-2 text-sm leading-relaxed text-ink-soft md:mt-3"
                />
              </div>
            </Link>
            )
          })}
        </div>

        {/* Düğme sayfanın sonundaki forma kaydırır (#randevu); yeni sayfa açmaz. */}
        <div className="mt-12 text-center">
          <Link
            href="#randevu"
            className="inline-block rounded-full bg-grape px-8 py-4 font-semibold text-white shadow-lg shadow-grape/30 hover:bg-ink"
            {...c.attrs('home.features.cta')}
          >
            {c.text('home.features.cta')}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default FeaturesSection
