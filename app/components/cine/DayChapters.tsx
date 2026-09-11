import Frame from './Frame';
import Timecode from './Timecode';
import Roster from './Roster';
import { chapterLabel, ROSTER_STATUS, type DayChapter } from '@/content/day';

/**
 * Günün bölüm bölüm anlatısı. `/gunluk-akis` sayfasından ayrık tutulur ki
 * Header/LeadForm gibi router bağımlılığı olan bileşenler olmadan,
 * yalnızca bu anlatının doğrulanmamış saat/sayı sızdırmadığı test edilebilsin.
 */
/** Bölüm şeritleri — günün sırası boyunca dönen aksan renkleri. */
const CHAPTER_STRIPES = ['bg-sunny', 'bg-mint', 'bg-sky', 'bg-bubble', 'bg-grape', 'bg-tangerine'];

export default function DayChapters({ chapters }: { chapters: DayChapter[] }) {
  return (
    <div className="space-y-8">
      {chapters.map((chapter, index) => (
        <section
          key={chapter.id}
          id={chapter.id}
          className="cine-chapter scroll-mt-24 overflow-hidden rounded-3xl bg-white p-6 shadow-sm ring-1 ring-rule md:p-10"
        >
          <span
            aria-hidden="true"
            className={`mb-4 block h-1.5 w-14 rounded-full ${CHAPTER_STRIPES[index % CHAPTER_STRIPES.length]}`}
          />
          <Timecode>{chapterLabel(chapter)}</Timecode>
          <h2 className="mt-3 text-3xl text-ink md:text-4xl">{chapter.title}</h2>
          <p className="mt-3 text-lg text-ink-soft">{chapter.lead}</p>

          <div className="mt-8">
            <Frame mediaKey={chapter.mediaKey} grade={chapter.grade} priority={index === 0} />
          </div>

          <div className="mt-8 max-w-2xl">
            {chapter.body.map((paragraph) => (
              <p key={paragraph.slice(0, 40)} className="mt-4 text-ink-soft">
                {paragraph}
              </p>
            ))}
          </div>

          {chapter.feature === 'roster' && ROSTER_STATUS.ready ? (
            <div className="mt-10 max-w-md">
              <Roster
                childCount={ROSTER_STATUS.childCount}
                teacherCount={ROSTER_STATUS.teacherCount}
                limit={ROSTER_STATUS.limit}
              />
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}
