import Image from 'next/image';
import Timecode from './cine/Timecode';
import TrackedLink from './TrackedLink';
import { SITE, WHATSAPP_URL } from '@/lib/site';
import { MEDIA } from '@/content/media';
import { TESTIMONIALS } from '@/content/testimonials';
import { ROSTER_STATUS, ENGLISH_HOURS_PER_DAY } from '@/content/day';
import { MONTESSORI_DAYS_PER_WEEK } from '@/content/program';

/**
 * Hero — okulun kendi bahçe fotoğrafı zemin, üzerinde bento düzeninde
 * kutular. Bahçe okulun en somut farkı olduğu için ilk ekranda o görünür;
 * kutular sırayla teklifi, mekânı, sınıf künyesini, programın iki sabit
 * rakamını ve bir veli sözünü taşır.
 *
 * Başlık ve giriş metni okulun kendi tanıtım metninden gelir; buradaki
 * cümleler pazarlama için yeniden yazılmadı.
 */

const HERO_QUOTE_ID = 'muge-ilkokul-olsa';

export default function HeroSection() {
  const yearsActive = new Date().getFullYear() - SITE.foundingYear;
  const quote = TESTIMONIALS.find((item) => item.id === HERO_QUOTE_ID && item.ready);
  const photo = MEDIA.candyCorner;

  return (
    <section className="relative">
      <div className="relative overflow-hidden">
        <Image
          src={MEDIA.gardenWide.src}
          alt={MEDIA.gardenWide.alt}
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
                <Timecode>
                  Beykent&apos;in en köklü anaokullarından biri · {SITE.foundingYear}&apos;den beri
                </Timecode>
              </span>

              <h1 className="mt-4 text-3xl text-ink md:mt-5 md:text-5xl lg:text-6xl">
                Çocuğu tanıyan, potansiyelini keşfeden bir okul.
              </h1>

              <p className="mt-4 max-w-xl text-base text-ink-soft md:text-lg">
                Her çocuğun kendine özgü olduğuna inanıyoruz. İki binamız ve
                geniş metrekareye sahip iki büyük bahçemizle çocukların
                özgürce hareket edebildiği, keşfedebildiği bir eğitim ortamı
                sunuyoruz.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <TrackedLink
                  href="/kayit"
                  event="cta_click"
                  payload={{ location: 'hero', target: 'kayit' }}
                  className="rounded-full bg-bubble-deep px-7 py-3.5 text-center font-semibold text-white shadow-lg shadow-bubble-deep/30 hover:bg-ink md:py-4"
                >
                  Ön Görüşme Randevusu Alın
                </TrackedLink>
                <TrackedLink
                  href={WHATSAPP_URL}
                  event="whatsapp_click"
                  payload={{ location: 'hero' }}
                  external
                  className="rounded-full border-2 border-mint-deep px-7 py-3.5 text-center font-semibold text-mint-deep hover:bg-mint-deep hover:text-white md:py-4"
                >
                  WhatsApp&apos;tan Yazın
                </TrackedLink>
              </div>

              <p className="mt-3 text-sm text-ink-soft">
                Size uygun bir saat seçin. Kayıt zorunluluğu yok.
              </p>
            </div>

            {/* 2 — Mekân. Dikey fotoğraf kutusu, sağ rayda. */}
            <div className="relative min-h-56 overflow-hidden rounded-[1.75rem] shadow-2xl shadow-ink/25 md:min-h-0">
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
                <p className="font-display text-xl text-white">Şeker Köşesi</p>
                <p className="mt-1 text-sm text-white/85">
                  İlk gün ve mezuniyet kareleri burada çekiliyor.
                </p>
              </div>
            </div>

            {/* 3 — Künye. Sınıfın iki rakamı tek kutuda. */}
            <div className="rounded-[1.75rem] bg-grape p-6 shadow-xl shadow-grape/30">
              <div className="flex items-end gap-5">
                <div>
                  <p className="font-display text-4xl text-white md:text-5xl">
                    {ROSTER_STATUS.childCount}
                  </p>
                  <p className="mt-1 text-sm text-white/85">sınıfta çocuk</p>
                </div>
                <div className="h-12 w-px bg-white/30" />
                <div>
                  <p className="font-display text-4xl text-white md:text-5xl">
                    {ROSTER_STATUS.teacherCount}
                  </p>
                  <p className="mt-1 text-sm text-white/85">öğretmen</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/85">
                Yönetmelik öğretmen başına {ROSTER_STATUS.limit} çocuğa kadar
                izin veriyor. Sınıflarımızı doğum yılına ve ayına göre
                oluşturuyoruz.
              </p>
            </div>

            {/* 4 — Programın iki sabiti: Montessori ve günlük İngilizce. */}
            <div className="rounded-[1.75rem] bg-mint-deep p-6 shadow-xl shadow-mint-deep/30">
              <div className="flex items-end gap-5">
                <div>
                  <p className="font-display text-4xl text-white md:text-5xl">
                    {MONTESSORI_DAYS_PER_WEEK} gün
                  </p>
                  <p className="mt-1 text-sm text-white/85">Montessori</p>
                </div>
                <div className="h-12 w-px bg-white/30" />
                <div>
                  <p className="font-display text-4xl text-white md:text-5xl">
                    {ENGLISH_HOURS_PER_DAY} saat
                  </p>
                  <p className="mt-1 text-sm text-white/85">her gün İngilizce</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/85">
                Montessori ayrı bir etkinlik saati değil, haftanın her günü
                günün omurgası. {yearsActive} yıldır aynı bahçede çalışıyoruz.
              </p>
            </div>

            {/* 5 — Veli sözü. Google yorumundan, kısaltılmadan. */}
            {quote ? (
              <figure className="rounded-[1.75rem] bg-white/95 p-6 shadow-xl shadow-ink/20 backdrop-blur-md">
                <span aria-hidden="true" className="font-display text-4xl leading-none text-bubble-deep">
                  &ldquo;
                </span>
                <blockquote className="mt-1 text-base leading-relaxed text-ink">
                  {quote.quote}
                </blockquote>
                <figcaption className="mt-3 text-sm text-ink-soft">
                  {quote.author} · {quote.context}
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
