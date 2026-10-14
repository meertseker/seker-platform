import Image from 'next/image'
import PageHero from '@/app/components/PageHero'
import AboutSection from '@/app/components/AboutSection'
import JsonLd from '@/app/components/JsonLd'
import LeadForm from '@/app/components/LeadForm'
import { buildMetadata } from '@/lib/metadata'
import { buildBreadcrumbSchema } from '@/lib/schema'
import { SITE } from '@/lib/site'
import { ROSTER_STATUS } from '@/content/day'
import { CAMPUS, MONTESSORI_DAYS_PER_WEEK, SUPPORT } from '@/content/program'

export const metadata = buildMetadata({
  title: 'Hakkımızda',
  description: `Beykent bölgesinin en köklü anaokullarından biri. ${SITE.foundingYear}'den beri iki binamız ve iki büyük bahçemizle 2-6 yaş çocuklara Montessori temelli okul öncesi eğitim.`,
  path: '/hakkimizda',
})

/**
 * Değerler, okulun kendi tanıtım metnindeki üçlüden gelir: "sevgi, güven ve
 * aidiyet duygusunu merkeze alan bir okul ortamı". Dördüncüsü, Montessori
 * çalışmasının hedefi olarak aynı metinde geçen bağımsızlık.
 */
const VALUES = [
  {
    title: 'Sevgi',
    description:
      'Çocuğun kendini burada değerli hissetmesi, öğrenmenin ön koşulu. Her şeyden önce bunu kuruyoruz.',
    chip: 'bg-bubble-deep',
    path: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  },
  {
    title: 'Güven',
    description:
      'Çıkışta öğretmeni size günü anlatır, gün içinde merak ettiğinizde bakabilirsiniz. Anlatmadığımız bir şey olmuyor.',
    chip: 'bg-mint-deep',
    path: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    title: 'Aidiyet',
    description:
      'Çocuk kendi sınıfını, kendi öğretmenini ve kendi köşesini tanır. Yıl ortasında öğretmen değiştirmiyoruz.',
    chip: 'bg-grape',
    path: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  {
    title: 'Bağımsızlık',
    description:
      'Montessori çalışmasının hedefi bu: çocuk kendi işini seçsin, kendi hızında bitirsin, yerine kaldırsın.',
    chip: 'bg-tangerine-deep',
    path: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
]

export default function HakkimizdaPage() {
  const yearsActive = new Date().getFullYear() - SITE.foundingYear

  const facts = [
    { value: String(SITE.foundingYear), label: 'Kuruluş yılı' },
    { value: `${yearsActive} yıl`, label: 'Aynı bölgede' },
    { value: String(CAMPUS.buildings), label: 'Ayrı bina' },
    { value: String(CAMPUS.gardens), label: 'Büyük bahçe' },
  ]

  return (
    <div className="min-h-screen bg-paper">
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Ana Sayfa', path: '/' },
          { name: 'Hakkımızda', path: '/hakkimizda' },
        ])}
      />

      <PageHero
        eyebrow={`${SITE.foundingYear}'den beri Beykent'te`}
        title="Beykent'in en köklü anaokullarından biriyiz."
        lead="Yıllara dayanan eğitim deneyimimizi, çocukları tanıyan ve her çocuğun kendini değerli hissettiği bir okul anlayışıyla sürdürüyoruz. Çocukların akademik gelişiminin yanı sıra sosyal, duygusal ve bilişsel gelişimlerini de destekliyoruz."
        tone="bubble"
      />

      {/* Doğrulanabilir künye — okulun yaşı ve fiziksel alanı. */}
      <section className="py-12">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {facts.map((fact, index) => (
              <div key={fact.label} className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-rule">
                <p
                  className={`font-display text-3xl ${
                    index % 2 === 0 ? 'text-grape' : 'text-bubble-deep'
                  }`}
                >
                  {fact.value}
                </p>
                <p className="mt-1 text-sm text-ink-soft">{fact.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="pb-16">
        <div className="container mx-auto px-4 md:px-6">
          <AboutSection
            title="İki binamız, iki büyük bahçemiz var"
            description="Geniş metrekareye sahip iki bahçemizle çocukların özgürce hareket edebildiği, keşfedebildiği ve doğayla iç içe vakit geçirebildiği ferah bir eğitim ortamı sunuyoruz. Bahçeleri yıllar içinde kendimiz kurduk: ahşap oyun mutfağı, açık hava sınıfı, denge yolu, dev satranç tahtası ve ağacın etrafındaki oturma bankı. Çocuklar günün büyük bölümünü burada geçiriyor."
            buttonText="Bir günümüzü görün"
            buttonLink="/gunluk-akis"
            imageSrc="/bahce-genis.webp"
            imageAlt="Şeker Anaokulu bahçesi: çim alan, ağaçlar, ahşap oyun evi ve piknik masası"
            imagePosition="right"
            accent="mint"
          />

          <div className="my-16 text-center md:hidden">
            <Image
              src="/mutfak-atolyesi.webp"
              alt="Bahçedeki ahşap oyun mutfağı: tencereler, kepçeler ve kara tahta"
              className="mx-auto rounded-3xl shadow-lg shadow-ink/10"
              width={300}
              height={200}
            />
          </div>

          <div className="mt-16">
            <AboutSection
              title="Kadromuz ve sınıflarımız"
              description={`Kendi alanında deneyimli ve uzman bir eğitim kadrosuyla her çocuğun bireysel gelişimini yakından takip ediyoruz. ${SUPPORT.classPlacement} Sınıflarımızda ${ROSTER_STATUS.childCount} çocuk ve iki öğretmen bulunuyor; branş derslerinin her biri alanında uzman bir öğretmenle yürüyor.`}
              buttonText="Branş derslerimiz"
              buttonLink="/aktiviteler"
              imageSrc="/bahce-atolyeler.webp"
              imageAlt="Bahçedeki ahşap mutfak atölyesi, açık hava sınıfı ve ağacı çevreleyen oturma bankı"
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
              <h2 className="font-display text-2xl text-ink md:text-3xl">
                Okulumuzda uzman psikolog görev yapıyor
              </h2>
              <p className="mt-5 text-lg text-ink">{SUPPORT.psychologist}</p>
              <p className="mt-4 text-ink-soft">
                Uyum dönemi, kardeş kıskançlığı, tuvalet eğitimi ya da uyku düzeni
                gibi başlıklarda evde ve okulda tutarlı bir yaklaşım kurmak için
                sizinle birlikte çalışıyoruz.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mb-12 text-center">
            <h2 className="font-display text-3xl text-ink md:text-4xl">Değerlerimiz</h2>
            <p className="mx-auto mt-4 max-w-2xl text-ink-soft">
              Sevgi, güven ve aidiyet duygusunu merkeze alan bir okul ortamı
              kurmaya çalışıyoruz. Montessori yaklaşımımız ve branş derslerimizle
              çocukların özgüvenlerini, yeteneklerini ve bağımsızlıklarını
              destekliyoruz.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((value) => (
              <div
                key={value.title}
                className="card-lift rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-rule"
              >
                <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${value.chip}`}>
                  <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={value.path} />
                  </svg>
                </div>
                <h3 className="mb-2 font-display text-xl text-ink">{value.title}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-paper-warm py-16">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-center font-display text-3xl text-ink">
            Okulu gezmeye gelin
          </h2>
          <p className="mt-4 text-center text-ink-soft">
            Haftanın {MONTESSORI_DAYS_PER_WEEK} günü Montessori çalışıyoruz.
            Randevunuzu çalışma saatine alalım, sınıfı iş üstünde görün.
          </p>
          <div className="mt-10 rounded-3xl bg-white p-6 shadow-lg shadow-ink/5 md:p-8">
            <LeadForm />
          </div>
        </div>
      </section>
    </div>
  )
}
