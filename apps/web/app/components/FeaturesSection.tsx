import Link from 'next/link'
import Timecode from './cine/Timecode'
import { ENGLISH_HOURS_PER_DAY } from '@/content/day'
import { MONTESSORI_DAYS_PER_WEEK } from '@/content/program'

/**
 * Dört kart, okulun kendi tanıtım metninde öne çıkardığı dört uygulamayı
 * taşır: sınıfların doğum ayına göre kurulması, haftanın beş günü Montessori,
 * günlük İngilizce ve okulda görev yapan uzman psikolog. Güvenlik ve
 * beslenme ayrıntıları burada yer almaz; onların kendi sayfaları var.
 */
const FEATURES = [
  {
    href: '/yas-gruplari',
    title: 'Her Çocuğu Tanıyoruz',
    description:
      'Sınıflarımızı doğum yılını ve ayını dikkate alarak oluşturuyor, her çocuğun gelişimini yakından takip ediyoruz.',
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
      </svg>
    ),
  },
  {
    href: '/egitim-yaklasimimiz',
    title: `Haftanın ${MONTESSORI_DAYS_PER_WEEK} Günü Montessori`,
    description:
      'Materyaller çocuğun boyundaki açık raflarda. Ne çalışacağını kendi seçiyor, kendi hızında bitiriyor; öğretmen araya girmeden gözlemliyor.',
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    href: '/egitim-yaklasimimiz',
    title: 'Her Gün İngilizce',
    description: `Haftada birkaç ders değil, her gün ${ENGLISH_HOURS_PER_DAY} saat. Oyun, şarkı ve hikâyeyle başlıyor, günlük iletişimde konuşulmaya devam ediyor.`,
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    href: '/guvenlik',
    title: 'Okulda Uzman Psikolog',
    description:
      'Sosyal ve duygusal gelişimi de takip ediyoruz. İhtiyaç hâlinde randevu oluşturup bireysel görüşme desteği alabiliyorsunuz.',
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

const FeaturesSection = () => {
  return (
    <div className="bg-paper py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <Timecode>Neden burası</Timecode>
          <h2 className="mt-2 text-3xl text-ink md:text-4xl">Neden Şeker Anaokulu?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-ink-soft">
            Bizim için eğitim yalnızca öğretmek değil; çocuğu tanımak, ilgi ve
            yeteneklerini keşfetmesine alan açmak ve gelişimine eşlik etmek.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, index) => (
            <Link
              key={feature.title}
              href={feature.href}
              className={`card-lift rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ${ACCENTS[index % ACCENTS.length].ring}`}
            >
              <div
                className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-white ${ACCENTS[index % ACCENTS.length].chip}`}
              >
                {feature.icon}
              </div>
              <h3 className="text-lg text-ink">{feature.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{feature.description}</p>
            </Link>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/kayit"
            className="inline-block rounded-full bg-grape px-8 py-4 font-semibold text-white shadow-lg shadow-grape/30 hover:bg-ink"
          >
            Ön Görüşme Randevusu Alın
          </Link>
        </div>
      </div>
    </div>
  )
}

export default FeaturesSection
