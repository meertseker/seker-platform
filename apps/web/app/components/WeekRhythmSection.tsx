import Timecode from './cine/Timecode'
import { Editable } from './edit/Editable'
import type { Reader } from '@/lib/content/types'

/** Haftanın günlerine bağlı ritüeller — velinin sabah çantaya ne koyacağını
 *  bilmesini sağlayan, okulun kendi metninden gelen pratik bilgi. */
const DAY_ACCENTS = ['bg-bubble-deep', 'bg-sunny-deep', 'bg-mint-deep', 'bg-sky-deep', 'bg-grape']

export default function WeekRhythmSection({ c }: { c: Reader }) {
  const days = c.list<{ id: string; day: string; title: string; description: string }>('program.weekDays')
  return (
    <section className="bg-paper py-16">
      <div className="mx-auto max-w-6xl px-6">
        <Timecode editAttrs={c.attrs('home.week.eyebrow')}>{c.text('home.week.eyebrow')}</Timecode>
        <Editable c={c} k="home.week.title" as="h2" className="mt-2 max-w-2xl text-2xl text-ink md:text-4xl" />
        <Editable c={c} k="home.week.lead" as="p" className="mt-3 max-w-2xl text-ink-soft" />

        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5" {...c.listAttrs('program.weekDays')}>
          {days.map((item, index) => (
            <li
              key={item.id}
              className="card-lift flex flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ring-rule"
            >
              <Editable
                c={c}
                k="program.weekDays"
                path={`${item.id}.day`}
                value={item.day}
                className={`w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white ${DAY_ACCENTS[index % DAY_ACCENTS.length]}`}
              />
              <Editable
                c={c}
                k="program.weekDays"
                path={`${item.id}.title`}
                value={item.title}
                as="h3"
                className="mt-4 font-display text-lg leading-snug text-ink"
              />
              <Editable
                c={c}
                k="program.weekDays"
                path={`${item.id}.description`}
                value={item.description}
                as="p"
                className="mt-3 text-sm leading-relaxed text-ink-soft"
              />
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
