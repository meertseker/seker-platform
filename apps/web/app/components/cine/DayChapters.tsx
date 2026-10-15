import Frame, { type Grade } from './Frame';
import Timecode from './Timecode';
import Roster from './Roster';
import { Editable } from '@/app/components/edit/Editable';
import { chapterLabel, ROSTER_STATUS } from '@/content/day';
import type { MediaKey } from '@/content/media';
import type { Reader } from '@/lib/content/types';

export type DayChapterItem = {
  id: string;
  time: string;
  title: string;
  lead: string;
  body1: string;
  body2: string;
  mediaKey: MediaKey;
  grade: Grade;
  feature?: 'roster';
};

/**
 * Günün bölüm bölüm anlatısı. `/gunluk-akis` sayfasından ayrık tutulur ki
 * Header/LeadForm gibi router bağımlılığı olan bileşenler olmadan,
 * yalnızca bu anlatının doğrulanmamış saat/sayı sızdırmadığı test edilebilsin.
 */
/** Bölüm şeritleri — günün sırası boyunca dönen aksan renkleri. */
const CHAPTER_STRIPES = ['bg-sunny', 'bg-mint', 'bg-sky', 'bg-bubble', 'bg-grape', 'bg-tangerine'];

const BODY_FIELDS = ['body1', 'body2'] as const;

export default function DayChapters({ c }: { c: Reader }) {
  const chapters = c.list<DayChapterItem>('day.chapters');
  const scenePrefix = c.text('gunlukakis.scene.prefix');
  const rosterCount = c
    .text('gunlukakis.roster.count')
    .replace('{cocuk}', String(ROSTER_STATUS.childCount))
    .replace('{ogretmen}', String(ROSTER_STATUS.teacherCount));
  const rosterLimit = c.text('gunlukakis.roster.limit').replace('{limit}', String(ROSTER_STATUS.limit));

  return (
    <div className="space-y-8" {...c.listAttrs('day.chapters')}>
      {chapters.map((chapter, index) => (
        <section
          key={chapter.id}
          id={chapter.id}
          className="cine-chapter scroll-mt-32 overflow-hidden rounded-3xl bg-white p-6 shadow-sm ring-1 ring-rule md:p-10"
        >
          <span
            aria-hidden="true"
            className={`mb-4 block h-1.5 w-14 rounded-full ${CHAPTER_STRIPES[index % CHAPTER_STRIPES.length]}`}
          />
          <Timecode>{chapterLabel(chapter, scenePrefix)}</Timecode>
          <Editable c={c} k="day.chapters" path={`${chapter.id}.title`} value={chapter.title} as="h2" className="mt-3 text-3xl text-ink md:text-4xl" />
          <Editable c={c} k="day.chapters" path={`${chapter.id}.lead`} value={chapter.lead} as="p" className="mt-3 text-lg text-ink-soft" />

          <div className="mt-8">
            <Frame
              image={c.image(`media.${chapter.mediaKey}`)}
              editAttrs={c.attrs(`media.${chapter.mediaKey}`)}
              grade={chapter.grade}
              priority={index === 0}
              transitionName={`day-${chapter.id}`}
            />
          </div>

          <div className="mt-8 max-w-2xl">
            {BODY_FIELDS.filter((field) => chapter[field]).map((field) => (
              <Editable
                key={field}
                c={c}
                k="day.chapters"
                path={`${chapter.id}.${field}`}
                value={chapter[field]}
                as="p"
                className="mt-4 text-ink-soft"
              />
            ))}
          </div>

          {chapter.feature === 'roster' && ROSTER_STATUS.ready ? (
            <div className="mt-10 max-w-md">
              <Roster
                childCount={ROSTER_STATUS.childCount}
                teacherCount={ROSTER_STATUS.teacherCount}
                limit={ROSTER_STATUS.limit}
                countLabel={rosterCount}
                limitLabel={rosterLimit}
              />
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}
