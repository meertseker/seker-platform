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
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Timecode>Bir günümüz</Timecode>
            <h2 className="mt-3 text-3xl text-ink md:text-4xl">
              Çocuğunuz burada bütün gün ne yapıyor?
            </h2>
            <p className="mt-3 max-w-xl text-ink-soft">
              Velilerin bize en çok sorduğu soru bu. Cevabı saat saat aşağıda.
            </p>
          </div>
          <Link href="/gunluk-akis" className="text-ink underline underline-offset-4">
            Günün tamamını görün
          </Link>
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {DAY_PREVIEW_IDS.map((id) => {
            const chapter = DAY_CHAPTERS.find((c) => c.id === id)
            if (!chapter) return null
            return (
              <Link key={chapter.id} href={`/gunluk-akis#${chapter.id}`} className="group block">
                <Frame
                  mediaKey={chapter.mediaKey}
                  grade={chapter.grade}
                  ratio="portrait"
                  sizes="(max-width: 768px) 100vw, 360px"
                />
                <Timecode className="mt-4 block">{chapterLabel(chapter)}</Timecode>
                <h3 className="mt-1 text-xl text-ink group-hover:underline">{chapter.title}</h3>
                <p className="mt-1 text-sm text-ink-soft">{chapter.lead}</p>
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
