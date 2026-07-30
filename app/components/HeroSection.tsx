import Image from 'next/image';
import { SITE, WHATSAPP_URL } from '@/lib/site';
import TrackedLink from './TrackedLink';

export default function HeroSection() {
  const yearsActive = new Date().getFullYear() - SITE.foundingYear;

  return (
    <section className="relative isolate overflow-hidden bg-navy-900">
      <Image
        src="/cocukklar.jpg"
        alt="Şeker Anaokulu'nda etkinlik sırasındaki çocuklar"
        fill
        priority
        sizes="100vw"
        className="object-cover object-[center_30%] opacity-35"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-navy-900/85 via-navy-900/70 to-navy-900/90" />

      <div className="relative mx-auto max-w-4xl px-6 py-28 text-center md:py-36">
        <p className="mb-6 text-sm uppercase tracking-[0.2em] text-gold-400">
          Beykent · Büyükçekmece · {SITE.foundingYear}&apos;den beri
        </p>

        <h1 className="font-display text-4xl leading-tight text-white md:text-6xl">
          Bir sınıfta 10 çocuk.
          <br />
          İki öğretmen.
        </h1>

        <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-navy-100">
          2-6 yaş için Montessori ve High Scope temelli okul öncesi eğitim.
          Native öğretmenimizle çocuklarımız mezun olduğunda İngilizce konuşuyor.
          {' '}{yearsActive} yıldır Beykent&apos;te, aynı çatı altında.
        </p>

        <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <TrackedLink
            href="/kayit"
            event="cta_click"
            payload={{ location: 'hero', target: 'kayit' }}
            className="w-full rounded-full bg-gold-500 px-10 py-4 font-medium text-navy-900 hover:bg-gold-400 sm:w-auto"
          >
            Ön Görüşme Randevusu
          </TrackedLink>
          <TrackedLink
            href={WHATSAPP_URL}
            event="whatsapp_click"
            payload={{ location: 'hero' }}
            external
            className="w-full rounded-full border border-white/40 px-10 py-4 font-medium text-white hover:bg-white/10 sm:w-auto"
          >
            WhatsApp&apos;tan Yazın
          </TrackedLink>
        </div>
      </div>
    </section>
  );
}
