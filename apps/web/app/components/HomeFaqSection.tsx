import Link from 'next/link';
import Timecode from './cine/Timecode';
import { Editable } from './edit/Editable';
import type { FaqItem } from '@/content/faq';
import type { Reader } from '@/lib/content/types';

/**
 * Ana sayfadaki "Merak edilenler" — formdan hemen önce, velinin itirazlarına
 * kısa cevap. Yalnızca okulun "Ana sayfada göster" işaretlediği sorular
 * (`featured`), kapalı <details> olarak; JavaScript gerekmez.
 *
 * FAQPage şeması bilerek yok: soruların tamamı ve şema /sss sayfasında
 * (sadeleştirme kararı, 24.10). Bu bölüm o sayfanın kısa bir ön izlemesi.
 */
export default function HomeFaqSection({ c }: { c: Reader }) {
  const items = c.list<FaqItem>('faq.items').filter((item) => item.ready && item.featured);

  return (
    <section className="bg-paper-warm py-14 md:py-20">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <Timecode editAttrs={c.attrs('home.faq.eyebrow')}>{c.text('home.faq.eyebrow')}</Timecode>
          <Editable c={c} k="home.faq.title" as="h2" className="mt-2 text-2xl text-ink md:text-4xl" />
        </div>

        {items.length ? (
          <div className="mt-8 grid gap-3 md:mt-10" {...c.listAttrs('faq.items')}>
            {items.map((item) => (
              <details key={item.id} className="group rounded-2xl bg-white shadow-sm ring-1 ring-rule open:shadow-md">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-ink marker:content-none [&::-webkit-details-marker]:hidden">
                  <Editable c={c} k="faq.items" path={`${item.id}.question`} value={item.question} as="span" />
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-grape text-xl leading-none text-white transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <Editable
                  c={c}
                  k="faq.items"
                  path={`${item.id}.answer`}
                  value={item.answer}
                  as="p"
                  className="border-t border-rule px-5 pb-5 pt-3 leading-relaxed text-ink-soft"
                />
              </details>
            ))}
          </div>
        ) : null}

        <div className="mt-8 text-center">
          <Link
            href="/sss"
            className="inline-block rounded-full border-2 border-grape px-8 py-3 font-semibold text-grape hover:bg-grape hover:text-white"
          >
            <span {...c.attrs('home.faqLink.label')}>{c.text('home.faqLink.label')}</span>
            <span aria-hidden="true"> →</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
