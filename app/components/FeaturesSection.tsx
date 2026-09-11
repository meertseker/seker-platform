import Link from 'next/link'

/**
 * Fix round 1/5, Critical 2 — bu bölüm doğrulama kuyruğu #8 ve #9'daki
 * (giriş kontrolü/kayıt cihazları, mutfak/diyetisyen onayı) doğrulanmamış
 * özellik ayrıntılarını kesin iddia olarak taşıyordu ve iki başlığı asset
 * dosyası §2.2'nin klişe kara listesindeki ifadelere neredeyse birebir
 * yakındı. Aşağıdaki dört kart yalnızca doğrulama gerektirmeyen, davranış
 * temelli iddialar taşır — güvenlik ve beslenme özel ayrıntıları,
 * doğrulanana kadar burada yer almaz (bkz. app/guvenlik/page.tsx'teki aynı
 * disiplin).
 */
const FEATURES = [
  {
    title: 'Öğretmeniniz Fark Eder',
    description:
      'Sabah çemberinde her çocuğun konuşma sırası gelir. Öğretmeniniz o gün kimin neye ihtiyacı olduğunu bilir.',
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
      </svg>
    ),
  },
  {
    title: 'Gün Boyu Beceri',
    description:
      'Seramik, satranç, robotik kodlama, müzik ve drama atölyeleriyle elini, bedenini ve dikkatini kullanır.',
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    title: 'Günün Dili İngilizce',
    description:
      'İngilizce, ayrı bir ders saati değil; günün içinde kullanılan ikinci dildir.',
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    title: 'Günü Birlikte Kapatıyoruz',
    description:
      'Her çocuk alınırken öğretmeni velisine o günü anlatır: ne yaptı, neyi zor buldu, neye ilk kez cesaret etti.',
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
          <h2 className="text-3xl text-ink md:text-4xl">Neden Şeker Anaokulu?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-ink-soft">
            Konumlanmamız üç şeye dayanır: öğretmenin ilgisi, günün içinde
            kullanılan beceri çeşitliliği ve dilin gün boyu varlığı.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, index) => (
            <div
              key={feature.title}
              className={`card-lift rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ${ACCENTS[index % ACCENTS.length].ring}`}
            >
              <div
                className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-white ${ACCENTS[index % ACCENTS.length].chip}`}
              >
                {feature.icon}
              </div>
              <h3 className="text-lg text-ink">{feature.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{feature.description}</p>
            </div>
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
