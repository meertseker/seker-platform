import Image from 'next/image';
import Timecode from './cine/Timecode';
import TrackedLink from './TrackedLink';
import { Editable } from './edit/Editable';
import { whatsappUrl } from '@/lib/site';
import type { Reader } from '@/lib/content/types';

/**
 * Hero — okulun kendi bahçe fotoğrafı zemin, üzerinde bento düzeninde
 * kutular. Bahçe okulun en somut farkı olduğu için ilk ekranda o görünür;
 * kutular sırayla teklifi, mekânı, sınıf künyesini, programın iki sabit
 * rakamını ve bir veli sözünü taşır.
 *
 * Başlık ve giriş metni okulun kendi tanıtım metninden gelir; buradaki
 * cümleler pazarlama için yeniden yazılmadı. Metinlerin varsayılanları
 * lib/content/slots/home.ts'de durur.
 */

const HERO_QUOTE_ID = 'muge-ilkokul-olsa';

type Quote = { id: string; quote: string; author: string; context: string; ready: boolean };

export default function HeroSection({ c }: { c: Reader }) {
  const quote = c.list<Quote>('testimonials.items').find((item) => item.id === HERO_QUOTE_ID && item.ready);
  const wide = c.image('media.gardenWide');
  const photo = c.image('media.candyCorner');

  return (
    <section className="relative">
      <div className="relative overflow-hidden" {...c.attrs('media.gardenWide')}>
        <Image
          src={wide.src}
          alt={wide.alt}
          fill
          priority
          sizes="100vw"
          /* Kadraj sağa kaydırılır: solda kalan bina duvarı yerine çim
             alan, ağaçlar ve oyun yapıları kutuların çevresinde görünür. */
          className="object-cover object-[68%_center]"
        />

        {/* Bahçe olabildiğince açık kalır; kutular kendi zeminlerini
            taşıdığı için fotoğrafa perde çekilmez. Alt kenar yalnızca
            fisto geçişi için hafifçe koyulaşır. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-ink/40 via-ink/5 to-ink/10"
        />

        <div className="relative z-10 mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-20">
          <div className="grid gap-3 md:grid-cols-3 md:gap-4">
            {/* 1 — Teklif. Bento'nun en büyük kutusu. */}
            <div className="rounded-[1.75rem] bg-white/95 p-6 shadow-2xl shadow-ink/25 backdrop-blur-md md:col-span-2 md:p-9">
              <span className="inline-flex w-fit rounded-full bg-paper-warm px-4 py-1.5">
                <Timecode editAttrs={c.attrs('home.hero.badge')}>{c.text('home.hero.badge')}</Timecode>
              </span>

              <Editable
                c={c}
                k="home.hero.title"
                as="h1"
                className="mt-4 text-3xl text-ink md:mt-5 md:text-5xl lg:text-6xl"
              />

              <Editable c={c} k="home.hero.lead" as="p" className="mt-4 max-w-xl text-base text-ink-soft md:text-lg" />

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <TrackedLink
                  href="/kayit"
                  event="cta_click"
                  payload={{ location: 'hero', target: 'kayit' }}
                  className="rounded-full bg-bubble-deep px-7 py-3.5 text-center font-semibold text-white shadow-lg shadow-bubble-deep/30 hover:bg-ink md:py-4"
                  editAttrs={c.attrs('home.hero.ctaPrimary')}
                >
                  {c.text('home.hero.ctaPrimary')}
                </TrackedLink>
                <TrackedLink
                  href={whatsappUrl(c)}
                  event="whatsapp_click"
                  payload={{ location: 'hero' }}
                  external
                  className="rounded-full border-2 border-mint-deep px-7 py-3.5 text-center font-semibold text-mint-deep hover:bg-mint-deep hover:text-white md:py-4"
                  editAttrs={c.attrs('home.hero.ctaWhatsapp')}
                >
                  {c.text('home.hero.ctaWhatsapp')}
                </TrackedLink>
              </div>

              <Editable c={c} k="home.hero.note" as="p" className="mt-3 text-sm text-ink-soft" />
            </div>

            {/* 2 — Mekân. Dikey fotoğraf kutusu, sağ rayda. */}
            <div
              className="relative min-h-56 overflow-hidden rounded-[1.75rem] shadow-2xl shadow-ink/25 md:min-h-0"
              {...c.attrs('media.candyCorner')}
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes="(max-width: 768px) 100vw, 360px"
                className="object-cover object-center"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent"
              />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <Editable c={c} k="home.hero.cornerTitle" as="p" className="font-display text-xl text-white" />
                <Editable c={c} k="home.hero.cornerText" as="p" className="mt-1 text-sm text-white/85" />
              </div>
            </div>

            {/* 3 — Künye. Sınıfın iki rakamı tek kutuda. */}
            <div className="rounded-[1.75rem] bg-grape p-6 shadow-xl shadow-grape/30">
              <div className="flex items-end gap-5">
                <div>
                  <Editable c={c} k="home.hero.rosterChildren" as="p" className="font-display text-4xl text-white md:text-5xl" />
                  <Editable c={c} k="home.hero.rosterChildrenLabel" as="p" className="mt-1 text-sm text-white/85" />
                </div>
                <div className="h-12 w-px bg-white/30" />
                <div>
                  <Editable c={c} k="home.hero.rosterTeachers" as="p" className="font-display text-4xl text-white md:text-5xl" />
                  <Editable c={c} k="home.hero.rosterTeachersLabel" as="p" className="mt-1 text-sm text-white/85" />
                </div>
              </div>
              <Editable c={c} k="home.hero.rosterNote" as="p" className="mt-4 text-sm leading-relaxed text-white/85" />
            </div>

            {/* 4 — Programın iki sabiti: Montessori ve günlük İngilizce. */}
            <div className="rounded-[1.75rem] bg-mint-deep p-6 shadow-xl shadow-mint-deep/30">
              <div className="flex items-end gap-5">
                <div>
                  <Editable c={c} k="home.hero.programMontessori" as="p" className="font-display text-4xl text-white md:text-5xl" />
                  <Editable c={c} k="home.hero.programMontessoriLabel" as="p" className="mt-1 text-sm text-white/85" />
                </div>
                <div className="h-12 w-px bg-white/30" />
                <div>
                  <Editable c={c} k="home.hero.programEnglish" as="p" className="font-display text-4xl text-white md:text-5xl" />
                  <Editable c={c} k="home.hero.programEnglishLabel" as="p" className="mt-1 text-sm text-white/85" />
                </div>
              </div>
              <Editable c={c} k="home.hero.programNote" as="p" className="mt-4 text-sm leading-relaxed text-white/85" />
            </div>

            {/* 5 — Veli sözü. Google yorumundan, kısaltılmadan. */}
            {quote ? (
              <figure className="rounded-[1.75rem] bg-white/95 p-6 shadow-xl shadow-ink/20 backdrop-blur-md">
                <span aria-hidden="true" className="font-display text-4xl leading-none text-bubble-deep">
                  &ldquo;
                </span>
                <blockquote
                  className="mt-1 text-base leading-relaxed text-ink"
                  {...c.attrs('testimonials.items', `${quote.id}.quote`)}
                >
                  {c.fill(quote.quote)}
                </blockquote>
                {/* Yazar ve açıklama tek satırda; ayrı elemanlara bölmek ziyaretçi HTML'ini değiştirirdi, bu yüzden satır içi düzenleme işareti yok (liste panelinden düzenlenir). */}
                <figcaption className="mt-3 text-sm text-ink-soft">
                  {c.fill(quote.author)} · {c.fill(quote.context)}
                </figcaption>
              </figure>
            ) : null}
          </div>
        </div>

        <div aria-hidden="true" className="scallop absolute inset-x-0 bottom-0" />
      </div>
    </section>
  );
}
