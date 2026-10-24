import Image from 'next/image';
import Timecode from './cine/Timecode';
import { Editable } from './edit/Editable';
import type { Reader } from '@/lib/content/types';

/**
 * Bahçe bölümü — okulun kendi fotoğraflarıyla. Anaokulu seçen velinin
 * telefonda soramadığı tek şey mekânın nasıl bir yer olduğudur; bu bölüm
 * onu gösterir. Kareler hafifçe eğik duran polaroidler gibi dizilir.
 */

type Shot = { id: string; title: string; note: string };

/** Kartın duruşu ve bandı (kare kimliği = fotoğraf anahtarı) — hepsi aynı açıyla dizilirse desen makineleşir. */
const LOOK: Record<string, { tilt: string; tape: string }> = {
  mudKitchen: { tilt: '-rotate-2', tape: 'bg-bubble' },
  outdoorClass: { tilt: 'rotate-1', tape: 'bg-sunny' },
  giraffes: { tilt: 'rotate-2', tape: 'bg-mint' },
  candyCorner: { tilt: '-rotate-1', tape: 'bg-sky' },
};

function Polaroid({ c, shot, sizes }: { c: Reader; shot: Shot; sizes: string }) {
  const asset = c.image(`media.${shot.id}`);
  const look = LOOK[shot.id];

  return (
    <figure
      className={`card-lift relative w-64 shrink-0 snap-start rounded-3xl bg-white p-3 pb-4 shadow-xl shadow-ink/10 md:w-auto ${look.tilt} hover:rotate-0`}
    >
      {/* Ambalaj bandı — kartı panoya tutturulmuş gibi gösterir. */}
      <span
        aria-hidden="true"
        className={`absolute -top-2 left-1/2 h-4 w-20 -translate-x-1/2 rounded-full ${look.tape} opacity-80`}
      />
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-paper-warm" {...c.attrs(`media.${shot.id}`)}>
        <Image src={asset.src} alt={asset.alt} fill sizes={sizes} className="object-cover" />
      </div>
      <figcaption className="px-1 pt-3">
        <Editable
          c={c}
          k="home.garden.shots"
          path={`${shot.id}.title`}
          value={shot.title}
          as="h3"
          className="font-display text-lg text-ink"
        />
        <Editable
          c={c}
          k="home.garden.shots"
          path={`${shot.id}.note`}
          value={shot.note}
          as="p"
          className="mt-1 text-sm leading-relaxed text-ink-soft"
        />
      </figcaption>
    </figure>
  );
}

export default function GardenSection({ c }: { c: Reader }) {
  const hero = c.image('media.gardenWorkshops');
  const shots = c.list<Shot>('home.garden.shots');

  return (
    <section className="relative overflow-hidden bg-paper-warm py-14 md:py-20">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <span className="confetti-float absolute -left-16 top-24 h-48 w-48 rounded-full bg-grape/10" />
        <span className="confetti-float absolute -right-12 bottom-10 h-40 w-40 rounded-full bg-tangerine/10" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <Timecode editAttrs={c.attrs('home.garden.eyebrow')}>{c.text('home.garden.eyebrow')}</Timecode>
        <Editable c={c} k="home.garden.title" as="h2" className="mt-2 max-w-2xl text-2xl text-ink md:text-4xl" />
        <Editable c={c} k="home.garden.lead" as="p" className="mt-3 max-w-2xl text-ink-soft" />

        {/* Geniş bahçe karesi — bölümün çapası. */}
        <div
          className="relative mt-8 overflow-hidden rounded-[2rem] shadow-2xl shadow-ink/15 md:mt-10"
          {...c.attrs('media.gardenWorkshops')}
        >
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
          <Editable
            c={c}
            k="home.garden.caption"
            as="p"
            className="absolute bottom-0 left-0 right-0 p-5 text-base text-white md:p-8 md:text-lg"
          />
        </div>

        {/* Polaroid şerit — mobilde yatay kaydırma, md+ dört sütun. */}
        <div
          className="mt-8 -mx-6 flex snap-x gap-5 overflow-x-auto px-6 pb-4 pt-4 md:mx-0 md:mt-12 md:grid md:grid-cols-4 md:gap-6 md:overflow-visible md:px-0"
          {...c.listAttrs('home.garden.shots')}
        >
          {shots.map((shot) => (
            <Polaroid key={shot.id} c={c} shot={shot} sizes="(max-width: 768px) 256px, 280px" />
          ))}
        </div>
      </div>
    </section>
  );
}
