import Timecode from './cine/Timecode'
import { WEEK_DAYS } from '@/content/program'

/** Haftanın günlerine bağlı ritüeller — velinin sabah çantaya ne koyacağını
 *  bilmesini sağlayan, okulun kendi metninden gelen pratik bilgi. */
const DAY_ACCENTS = ['bg-bubble-deep', 'bg-sunny-deep', 'bg-mint-deep', 'bg-sky-deep', 'bg-grape']

export default function WeekRhythmSection() {
  return (
    <section className="bg-paper py-16">
      <div className="mx-auto max-w-6xl px-6">
        <Timecode>Haftalık ritim</Timecode>
        <h2 className="mt-2 max-w-2xl text-2xl text-ink md:text-4xl">
          Haftanın her günü çocuklar için ayrı bir şey ifade ediyor.
        </h2>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Okul yaşamını daha keyifli hâle getirmek için haftanın belirli
          günlerinde özel etkinlikler düzenliyoruz. Sabah çantaya ne koyacağınızı
          bu takvimden bakabilirsiniz.
        </p>

        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {WEEK_DAYS.map((item, index) => (
            <li
              key={item.day}
              className="card-lift flex flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ring-rule"
            >
              <span
                className={`w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white ${DAY_ACCENTS[index % DAY_ACCENTS.length]}`}
              >
                {item.day}
              </span>
              <h3 className="mt-4 font-display text-lg leading-snug text-ink">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{item.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
