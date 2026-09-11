"use client"
import React from 'react'
import Header from '@/app/components/Header'
import PageHero from '@/app/components/PageHero'
import AboutSection from '@/app/components/AboutSection'
import Image from 'next/image'

/** Değer kartları — her biri sitenin şeker paletinden bir ton taşır. */
const VALUES = [
  {
    title: 'Sevgi',
    description: 'Her çocuğa sevgi ile yaklaşır, onların duygusal ihtiyaçlarını karşılarız.',
    chip: 'bg-bubble-deep',
    path: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  },
  {
    title: 'Güven',
    description: 'Ailelerle güven ilişkisi kurarak şeffaf bir eğitim süreci yürütürüz.',
    chip: 'bg-mint-deep',
    path: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    title: 'Yaratıcılık',
    description: 'Çocukların hayal güçlerini geliştiren yaratıcı aktiviteler düzenleriz.',
    chip: 'bg-grape',
    path: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
  {
    title: 'Eğitim',
    description: 'Kaliteli eğitim ile çocukların gelişimini destekleriz.',
    chip: 'bg-tangerine-deep',
    path: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  },
];

const HakkimizdaPage = () => {
  return (
    <div className="min-h-screen bg-paper">
      <Header />

      <PageHero
        eyebrow="2011'den beri Beykent'te"
        title="Hakkımızda"
        lead="Şeker Anaokulu olarak çocuklarınızın mutlu, güvenli ve yaratıcı bir ortamda büyümesi için 2011 yılından beri faaliyetlerimiz devam etmektedir."
        tone="bubble"
      />

      {/* About Content */}
      <div className="py-16">
        <div className="container mx-auto px-4 md:px-6">
          {/* Mission Section */}
          <AboutSection
            title="Misyonumuz"
            description="Çocukların doğal meraklarını körükleyerek, yaratıcılıklarını geliştirmek ve sosyal becerilerini güçlendirmek. Her çocuğun bireysel özelliklerini keşfetmesine yardımcı olarak, onları hayata hazırlamak. Modern eğitim yaklaşımları ile geleneksel değerleri harmanlayarak, çocuklarımızın hem akademik hem de kişisel gelişimlerini desteklemek."
            buttonText="İletişim"
            buttonLink="/iletisim"
            imageSrc="/cocukklar.webp"
            imageAlt="Şeker Anaokulu sınıfında çocuklar"
            imagePosition="right"
            accent="mint"
          />
          
          {/* Center Image */}
          <div className="my-16 text-center md:hidden">
            <Image
              src="/montesori.webp"
              alt="Montessori materyaliyle çalışan çocuk"
              className="mx-auto rounded-3xl shadow-lg shadow-ink/10"
              width={300}
              height={200}
            />
          </div>
          
          <div className="mt-16">
            <AboutSection
              title="Vizyonumuz"
              description="Türkiye'nin en kaliteli okul öncesi eğitim kurumu olmak. Çocukların potansiyellerini en üst düzeyde kullanabilecekleri, özgüven sahibi, yaratıcı, problem çözme becerileri gelişmiş bireyler yetiştirebilmek. Ailelerin güvenle tercih ettiği, çocukların sevgi ile hatırladığı bir eğitim yuva olmak."
              buttonText="Aktivitelerimiz"
              buttonLink="/aktiviteler"
              imageSrc="/art.webp"
              imageAlt="Sanat atölyesinde çalışma"
              imagePosition="left"
              accent="bubble"
            />
          </div>
        </div>
      </div>

      {/* Values Section */}
      <div className="bg-paper-warm py-16">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl text-ink md:text-4xl">
              Değerlerimiz
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((value) => (
              <div
                key={value.title}
                className="card-lift rounded-3xl bg-white p-6 text-center shadow-sm"
              >
                <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${value.chip}`}>
                  <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={value.path} />
                  </svg>
                </div>
                <h3 className="mb-2 font-display text-xl text-ink">{value.title}</h3>
                <p className="text-ink-soft">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default HakkimizdaPage 