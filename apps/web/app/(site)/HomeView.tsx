import React from 'react'
import Link from 'next/link'
import HeroSection from '@/app/components/HeroSection'
import TestimonialsSection from '@/app/components/TestimonialsSection'
import GardenSection from '@/app/components/GardenSection'
import Frame from '@/app/components/cine/Frame'
import Timecode from '@/app/components/cine/Timecode'
import FeaturesSection from '@/app/components/FeaturesSection'
import ActivitiesSection from '@/app/components/ActivitiesSection'
import HomeFaqSection from '@/app/components/HomeFaqSection'
import AnnouncementsSection from '@/app/components/AnnouncementsSection'
import ContactSection from '@/app/components/ContactSection'
import { Editable } from '@/app/components/edit/Editable'
import { makeReader, pickData } from '@/lib/content/reader'
import type { ReaderData } from '@/lib/content/types'
import type { PublicAnnouncement } from '@/lib/content/getContent'
import { chapterLabel, type DayChapter } from '@/content/day'

const DAY_PREVIEW_IDS = ['sabah-cemberi', 'calisma-saati', 'atolye']

type ChapterItem = Pick<DayChapter, 'id' | 'time' | 'title' | 'lead' | 'mediaKey' | 'grade'>

/**
 * Ana sayfa — ikna akışı sırasıyla:
 *   dikkat (hero) → güven/kanıt (veli yorumları) → nasıl bir gün (günün
 *   sahneleri, bahçe) → neden biz (dört kart, branş dersleri) → itirazlar
 *   (merak edilenler) → harekete geçir (randevu formu, #randevu).
 * Duyurular okul yayımladığında hero'nun hemen altında görünür.
 * Telefonda alt çubuk (Ara · WhatsApp · Randevu) her ekranda durur; form bu
 * yüzden sayfanın sonunda, bütün kanıtlardan sonra gelir.
 */
const HomeView = ({ data, announcements = [] }: { data: ReaderData; announcements?: PublicAnnouncement[] }) => {
  const c = makeReader(data)
  const chapters = c.list<ChapterItem>('day.chapters')
  // "Sahne 01" gibi birleşik etiket: ön ek günlük akış sayfasıyla ortak alandan gelir (sayfa ayarlarında düzenlenir).
  const scenePrefix = c.text('gunlukakis.scene.prefix')
  return (
    <div className="min-h-screen bg-paper">
      {/* 1 — Dikkat */}
      <HeroSection c={c} />

      {/* Okulun aktif duyuruları — yoksa bölüm hiç basılmaz */}
      <AnnouncementsSection c={c} items={announcements} />

      {/* 2 — Güven: Google'daki gerçek veli yorumları */}
      <TestimonialsSection c={c} />

      {/* 3 — Nasıl bir gün: günün üç sahnesi; tam anlatı /gunluk-akis sayfasında */}
      <section className="bg-paper-warm py-12 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Timecode editAttrs={c.attrs('home.day.eyebrow')}>{c.text('home.day.eyebrow')}</Timecode>
              <Editable c={c} k="home.day.title" as="h2" className="mt-2 text-2xl text-ink md:mt-3 md:text-4xl" />
              <Editable c={c} k="home.day.lead" as="p" className="mt-3 max-w-xl text-ink-soft" />
            </div>
            <Link
              href="/gunluk-akis"
              className="text-sm text-ink underline underline-offset-4 md:text-base"
              {...c.attrs('home.day.link')}
            >
              {c.text('home.day.link')}
            </Link>
          </div>

          {/* Telefonda tek sıra yatay kaydırma (3:2 çerçeve); md+ üç sütun. */}
          <div
            className="mt-6 -mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 md:mx-0 md:mt-10 md:grid md:grid-cols-3 md:gap-8 md:overflow-visible md:px-0 md:pb-0"
            {...c.listAttrs('day.chapters')}
          >
            {DAY_PREVIEW_IDS.map((id) => {
              const chapter = chapters.find((item) => item.id === id)
              if (!chapter) return null
              return (
                <Link
                  key={chapter.id}
                  href={`/gunluk-akis#${chapter.id}`}
                  className="group block w-56 shrink-0 snap-start md:w-auto"
                >
                  <Frame
                    image={c.image(`media.${chapter.mediaKey}`)}
                    editAttrs={c.attrs(`media.${chapter.mediaKey}`)}
                    grade={chapter.grade}
                    ratio="wide"
                    sizes="(max-width: 768px) 224px, 360px"
                    transitionName={`day-${chapter.id}`}
                  />
                  <Timecode className="mt-2 block md:mt-4">{chapterLabel(chapter, scenePrefix)}</Timecode>
                  <Editable
                    c={c}
                    k="day.chapters"
                    path={`${chapter.id}.title`}
                    value={chapter.title}
                    as="h3"
                    className="mt-1 text-base text-ink group-hover:underline md:text-xl"
                  />
                  <Editable
                    c={c}
                    k="day.chapters"
                    path={`${chapter.id}.lead`}
                    value={chapter.lead}
                    as="p"
                    className="mt-1 line-clamp-2 text-sm text-ink-soft"
                  />
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* 3 (devam) — Günün geçtiği yer: okulun kendi bahçe kareleri */}
      <GardenSection c={c} />

      {/* 4 — Neden biz */}
      <FeaturesSection c={c} />
      <ActivitiesSection c={c} />

      {/* 5 — İtirazlar: okulun ana sayfaya seçtiği sorular, kapalı */}
      <HomeFaqSection c={c} />

      {/* 6 — Harekete geçir: randevu formu ve iletişim kartları (#randevu) */}
      <ContactSection data={pickData(data, ['home.contact.', 'chrome.contact.', 'site.', 'form.'])} />
    </div>
  )
}

export default HomeView
