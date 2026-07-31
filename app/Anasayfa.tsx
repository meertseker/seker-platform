import React from 'react'
import Link from 'next/link'
import Header from './components/Header'
import HeroSection from './components/HeroSection'
import TrustBar from './components/TrustBar'
import Frame from './components/cine/Frame'
import Timecode from './components/cine/Timecode'
import FeaturesSection from './components/FeaturesSection'
import ActivitiesSection from './components/ActivitiesSection'
import FAQSection from './components/FAQSection'
import ContactSection from './components/ContactSection'
import { DAY_CHAPTERS, chapterLabel } from '@/content/day'

const DAY_PREVIEW_IDS = ['sabah-cemberi', 'calisma-saati', 'atolye']

const Anasayfa = () => {
  return (
    <div className="min-h-screen bg-paper">
      <Header />

      <HeroSection />
      <TrustBar />

      {/* Günün üç sahnesi — tam anlatı /gunluk-akis sayfasında */}
      <section className="mx-auto max-w-6xl px-6 py-6 md:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Timecode>Bir günümüz</Timecode>
            <h2 className="mt-2 text-xl text-ink md:mt-3 md:text-4xl">
              Çocuğunuz burada bütün gün ne yapıyor?
            </h2>
            {/* Alt metin mobilde gizli — soru başlığı tek başına yeterli;
                form ilk kaydırmadan daha da uzaklaşmasın diye kısaltıldı. */}
            <p className="mt-3 hidden max-w-xl text-ink-soft md:block">
              Velilerin bize en çok sorduğu soru bu. Cevabı saat saat aşağıda.
            </p>
          </div>
          <Link href="/gunluk-akis" className="text-sm text-ink underline underline-offset-4 md:text-base">
            Günün tamamını görün
          </Link>
        </div>

        {/*
          Mobilde (375 px) üç dikey (4:5) çerçeveyi alt alta yığmak formu
          1200 px'in altına gömerdi — "ilk kaydırmada erişilebilir" hedefini
          bozardı. Bunun yerine mobilde tek satır yatay kaydırma (snap), kısa
          (3:2, "wide") bir çerçeve oranı ve daha dar bir kart genişliği;
          md+ genişlikte üç sütunlu grid (aynı 3:2 oranı korunur, 'portrait'
          varyantının masaüstü davranışıyla özdeş).
        */}
        <div className="mt-4 -mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 md:mx-0 md:mt-10 md:grid md:grid-cols-3 md:gap-8 md:overflow-visible md:px-0 md:pb-0">
          {DAY_PREVIEW_IDS.map((id) => {
            const chapter = DAY_CHAPTERS.find((c) => c.id === id)
            if (!chapter) return null
            return (
              <Link
                key={chapter.id}
                href={`/gunluk-akis#${chapter.id}`}
                className="group block w-48 shrink-0 snap-start md:w-auto"
              >
                <Frame
                  mediaKey={chapter.mediaKey}
                  grade={chapter.grade}
                  ratio="wide"
                  sizes="(max-width: 768px) 192px, 360px"
                />
                <Timecode className="mt-2 block md:mt-4">{chapterLabel(chapter)}</Timecode>
                <h3 className="mt-1 text-base text-ink group-hover:underline md:text-xl">{chapter.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{chapter.lead}</p>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Form, günün önizlemesinden hemen sonra — ilk kaydırmada erişilebilir olmalı */}
      <ContactSection />

      <FeaturesSection />
      <ActivitiesSection />
      <FAQSection />
    </div>
  )
}

export default Anasayfa
