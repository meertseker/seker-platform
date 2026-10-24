import React from 'react'
import Link from 'next/link'
import HeroSection from '@/app/components/HeroSection'
import GardenSection from '@/app/components/GardenSection'
import Frame from '@/app/components/cine/Frame'
import Timecode from '@/app/components/cine/Timecode'
import FeaturesSection from '@/app/components/FeaturesSection'
import ActivitiesSection from '@/app/components/ActivitiesSection'
import WeekRhythmSection from '@/app/components/WeekRhythmSection'
import AnnouncementsSection from '@/app/components/AnnouncementsSection'
import ContactSection from '@/app/components/ContactSection'
import { Editable } from '@/app/components/edit/Editable'
import { makeReader, pickData } from '@/lib/content/reader'
import type { ReaderData } from '@/lib/content/types'
import type { PublicAnnouncement } from '@/lib/content/getContent'
import { chapterLabel, type DayChapter } from '@/content/day'

const DAY_PREVIEW_IDS = ['sabah-cemberi', 'calisma-saati', 'atolye']

type ChapterItem = Pick<DayChapter, 'id' | 'time' | 'title' | 'lead' | 'mediaKey' | 'grade'>

const HomeView = ({ data, announcements = [] }: { data: ReaderData; announcements?: PublicAnnouncement[] }) => {
  const c = makeReader(data)
  const chapters = c.list<ChapterItem>('day.chapters')
  // "Sahne 01" gibi birleşik etiket: ön ek günlük akış sayfasıyla ortak alandan gelir (sayfa ayarlarında düzenlenir).
  const scenePrefix = c.text('gunlukakis.scene.prefix')
  return (
    <div className="min-h-screen bg-paper">
      <HeroSection c={c} />

      {/* Okulun aktif duyuruları — yoksa bölüm hiç basılmaz */}
      <AnnouncementsSection c={c} items={announcements} />

      {/* Günün üç sahnesi — tam anlatı /gunluk-akis sayfasında */}
      <section className="mx-auto max-w-6xl px-6 py-8 md:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Timecode editAttrs={c.attrs('home.day.eyebrow')}>{c.text('home.day.eyebrow')}</Timecode>
            <Editable c={c} k="home.day.title" as="h2" className="mt-2 text-xl text-ink md:mt-3 md:text-4xl" />
            {/* Alt metin mobilde gizli — soru başlığı tek başına yeterli;
                form ilk kaydırmadan daha da uzaklaşmasın diye kısaltıldı. */}
            <Editable c={c} k="home.day.lead" as="p" className="mt-3 hidden max-w-xl text-ink-soft md:block" />
          </div>
          <Link
            href="/gunluk-akis"
            className="text-sm text-ink underline underline-offset-4 md:text-base"
            {...c.attrs('home.day.link')}
          >
            {c.text('home.day.link')}
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
        <div
          className="mt-4 -mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 md:mx-0 md:mt-10 md:grid md:grid-cols-3 md:gap-8 md:overflow-visible md:px-0 md:pb-0"
          {...c.listAttrs('day.chapters')}
        >
          {DAY_PREVIEW_IDS.map((id) => {
            const chapter = chapters.find((item) => item.id === id)
            if (!chapter) return null
            return (
              <Link
                key={chapter.id}
                href={`/gunluk-akis#${chapter.id}`}
                className="group block w-48 shrink-0 snap-start md:w-auto"
              >
                <Frame
                  image={c.image(`media.${chapter.mediaKey}`)}
                  editAttrs={c.attrs(`media.${chapter.mediaKey}`)}
                  grade={chapter.grade}
                  ratio="wide"
                  sizes="(max-width: 768px) 192px, 360px"
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
      </section>

      {/* Form, günün önizlemesinden hemen sonra — ilk kaydırmada erişilebilir olmalı */}
      <ContactSection data={pickData(data, ['home.contact.', 'chrome.contact.', 'site.', 'form.'])} />

      {/* Okulun kendi bahçe ve atölye kareleri — formu geçenler için derin kanıt */}
      <GardenSection c={c} />

      <FeaturesSection c={c} />
      <ActivitiesSection c={c} />
      <WeekRhythmSection c={c} />

      {/* SSS ana sayfada tekrarlanmaz; soruların tamamı /sss sayfasında */}
      <div className="bg-paper px-6 pb-16 text-center">
        <Link
          href="/sss"
          className="inline-block rounded-full border-2 border-grape px-8 py-3 font-semibold text-grape hover:bg-grape hover:text-white"
        >
          <span {...c.attrs('home.faqLink.label')}>{c.text('home.faqLink.label')}</span>
          <span aria-hidden="true"> →</span>
        </Link>
      </div>
    </div>
  )
}

export default HomeView
