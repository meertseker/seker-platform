'use client'

import { useEffect, useState } from 'react'
import Timecode from './Timecode'
import { chapterLabel, type DayChapter } from '@/content/day'

/**
 * Zaman omurgası — indexing. Kaydırmayla ilerleyen kamera konumu,
 * aynı zamanda bölüm navigasyonu.
 *
 * Gösterge her zaman `chapterLabel()` üzerinden okunur — saat doğrulanana
 * kadar bu, gerçek bir saat değil sahne sırasıdır (bkz. content/day.ts).
 */
export default function TimeSpine({ chapters }: { chapters: DayChapter[] }) {
  const [activeId, setActiveId] = useState(chapters[0]?.id ?? '')

  useEffect(() => {
    const nodes = chapters
      .map((chapter) => document.getElementById(chapter.id))
      .filter((node): node is HTMLElement => Boolean(node))
    if (nodes.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const nextId = visible[0]?.target.id
        if (nextId) setActiveId(nextId)
      },
      { rootMargin: '-28% 0px -48% 0px', threshold: [0.2, 0.45, 0.7] },
    )

    for (const node of nodes) observer.observe(node)
    return () => observer.disconnect()
  }, [chapters])

  return (
    <nav
      aria-label="Günün bölümleri"
      className="sticky top-28 hidden h-fit rounded-3xl bg-paper-warm p-5 lg:block"
    >
      <ol className="space-y-1">
        {chapters.map((chapter) => {
          const active = chapter.id === activeId
          return (
            <li key={chapter.id} className="cine-spine-item" data-active={active}>
              <a
                href={`#${chapter.id}`}
                aria-current={active ? 'location' : undefined}
                className={`group block rounded-xl px-3 py-2 transition-colors hover:bg-white ${
                  active ? 'bg-white' : ''
                }`}
              >
                <Timecode className="block">{chapterLabel(chapter)}</Timecode>
                <span className="text-sm font-semibold text-ink group-hover:text-grape">
                  {chapter.title}
                </span>
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
