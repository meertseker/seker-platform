import Image from 'next/image';
import Link from 'next/link';
import Timecode from './cine/Timecode';
import { MEDIA, type MediaKey } from '@/content/media';

/**
 * Bahçe bölümü — okulun kendi fotoğraflarıyla. Anaokulu seçen velinin
 * telefonda soramadığı tek şey mekânın nasıl bir yer olduğudur; bu bölüm
 * onu gösterir. Kareler hafifçe eğik duran polaroidler gibi dizilir.
 */

type Shot = {
  mediaKey: MediaKey;
  title: string;
  note: string;
  /** Kartın duruşu — hepsi aynı açıyla dizilirse desen makineleşir. */
  tilt: string;
  tape: string;
};

const SHOTS: Shot[] = [
  {
    mediaKey: 'mudKitchen',
    title: 'Küçük Şeflerin Mutfağı',
    note: 'Gerçek tencere, gerçek kepçe, gerçek çamur. Bulaşığı da kendileri topluyor.',
    tilt: '-rotate-2',
    tape: 'bg-bubble',
  },
  {
    mediaKey: 'outdoorClass',
    title: 'Açık Hava Sınıfı',
    note: 'Hava elverdiği sürece ders içeride değil, bu çardağın altında yapılıyor.',
    tilt: 'rotate-1',
    tape: 'bg-sunny',
  },
  {
    mediaKey: 'giraffes',
    title: 'Zürafalar',
    note: 'Okulun iki sakini. Yeni gelen her çocuk ilk gün onlarla tanışıyor.',
    tilt: 'rotate-2',
    tape: 'bg-mint',
  },
  {
    mediaKey: 'candyCorner',
    title: 'Şeker Köşesi',
    note: 'Doğum günleri, ilk gün fotoğrafları ve mezuniyet kareleri burada çekiliyor.',
    tilt: '-rotate-1',
    tape: 'bg-sky',
  },
];

function Polaroid({ shot, sizes }: { shot: Shot; sizes: string }) {
  const asset = MEDIA[shot.mediaKey];

  return (
    <figure
      className={`card-lift relative w-64 shrink-0 snap-start rounded-3xl bg-white p-3 pb-4 shadow-xl shadow-ink/10 md:w-auto ${shot.tilt} hover:rotate-0`}
    >
      {/* Ambalaj bandı — kartı panoya tutturulmuş gibi gösterir. */}
      <span
        aria-hidden="true"
        className={`absolute -top-2 left-1/2 h-4 w-20 -translate-x-1/2 rounded-full ${shot.tape} opacity-80`}
      />
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-paper-warm">
        <Image src={asset.src} alt={asset.alt} fill sizes={sizes} className="object-cover" />
      </div>
      <figcaption className="px-1 pt-3">
        <h3 className="font-display text-lg text-ink">{shot.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">{shot.note}</p>
      </figcaption>
    </figure>
  );
}

export default function GardenSection() {
  const hero = MEDIA.gardenWorkshops;

  return (
    <section className="relative overflow-hidden bg-paper-warm py-14 md:py-20">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <span className="confetti-float absolute -left-16 top-24 h-48 w-48 rounded-full bg-grape/10" />
        <span className="confetti-float absolute -right-12 bottom-10 h-40 w-40 rounded-full bg-tangerine/10" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <Timecode>Bahçemiz</Timecode>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <h2 className="max-w-2xl text-2xl text-ink md:text-4xl">
            En büyük sınıfımız çatının altında değil.
          </h2>
          <Link
            href="/gunluk-akis"
            className="text-sm text-ink underline underline-offset-4 md:text-base"
          >
            Bir günümüzü görün
          </Link>
        </div>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Bahçeyi yıllar içinde kendimiz kurduk: ahşap mutfak, tamir köşesi, denge
          yolu, ağacın etrafındaki bank. Çocuklar günün büyük bölümünü burada
          geçiriyor.
        </p>

        {/* Geniş bahçe karesi — bölümün çapası. */}
        <div className="relative mt-8 overflow-hidden rounded-[2rem] shadow-2xl shadow-ink/15 md:mt-10">
          <div className="relative aspect-[4/3] md:aspect-[16/7]">
            <Image
              src={hero.src}
              alt={hero.alt}
              fill
              sizes="(max-width: 768px) 100vw, 1100px"
              className="object-cover object-center"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent"
            />
          </div>
          <p className="absolute bottom-0 left-0 right-0 p-5 text-base text-white md:p-8 md:text-lg">
            Ağacın etrafındaki bank, denge yolu ve açık hava sınıfı — hepsi aynı
            bahçede, birbirini görecek mesafede.
          </p>
        </div>

        {/* Polaroid şerit — mobilde yatay kaydırma, md+ dört sütun. */}
        <div className="mt-8 -mx-6 flex snap-x gap-5 overflow-x-auto px-6 pb-4 pt-4 md:mx-0 md:mt-12 md:grid md:grid-cols-4 md:gap-6 md:overflow-visible md:px-0">
          {SHOTS.map((shot) => (
            <Polaroid
              key={shot.mediaKey}
              shot={shot}
              sizes="(max-width: 768px) 256px, 280px"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
