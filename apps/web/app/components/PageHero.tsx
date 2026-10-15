import React from 'react';
import Image from 'next/image';
import type { Reader } from '@/lib/content/types';

export type BandTone = 'grape' | 'bubble' | 'mint' | 'sunny' | 'sky';

export type PageHeroMedia = {
  src: string;
  alt: string;
  transitionName?: string;
};

/**
 * Sayfa bandı — sitenin imza öğesi. Okulun adından (şeker) türeyen mor
 * gradyan, üzerinde yüzen konfeti şekilleri ve alt kenarda şeker ambalajı
 * fistosu. Her iç sayfa aynı bantla açılır; ton, sayfanın konusuna göre
 * değişir ama yapı sabittir.
 *
 * `scallopTone`, bandın hemen altındaki bölümün zeminini bildirir — fisto
 * o rengi kullanır, aksi hâlde kenar sayfaya oturmaz.
 */
export default function PageHero({
  eyebrow,
  title,
  lead,
  tone = 'grape',
  scallopTone = 'paper',
  media,
  children,
  c,
  keys,
  editAttrs,
}: {
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  lead?: React.ReactNode;
  tone?: BandTone;
  scallopTone?: 'paper' | 'paper-warm' | 'white';
  media?: PageHeroMedia;
  children?: React.ReactNode;
  /** Düzenlenebilir sayfalar: okuyucu ve metin anahtarları; verilirse eyebrow/title/lead buradan basılır. */
  c?: Reader;
  keys?: { eyebrow?: string; title?: string; lead?: string };
  /** Liste öğesi alanlarından basılan eyebrow/title/lead için hazır `c.attrs(key, path)` çıktıları (ziyaretçiye boş gelir). */
  editAttrs?: { eyebrow?: Record<string, string>; title?: Record<string, string>; lead?: Record<string, string> };
}) {
  const eyebrowNode = c && keys?.eyebrow ? c.text(keys.eyebrow) : eyebrow;
  const titleNode = c && keys?.title ? c.text(keys.title) : title;
  const leadNode = c && keys?.lead ? c.text(keys.lead) : lead;
  const scallopClass =
    scallopTone === 'paper-warm' ? 'scallop scallop-warm'
    : scallopTone === 'white' ? 'scallop scallop-white'
    : 'scallop';

  return (
    <section className={`band-${tone} relative overflow-hidden pb-16 pt-14 md:pb-20 md:pt-20`}>
      <Confetti />

      <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
        {eyebrowNode ? (
          <p className="timecode text-white/70" {...(c && keys?.eyebrow ? c.attrs(keys.eyebrow) : editAttrs?.eyebrow)}>{eyebrowNode}</p>
        ) : null}
        <h1 className="mt-4 font-display text-3xl text-white md:text-5xl" {...(c && keys?.title ? c.attrs(keys.title) : editAttrs?.title)}>{titleNode}</h1>
        {leadNode ? (
          <p className="mx-auto mt-5 max-w-2xl text-base text-white/85 md:text-lg" {...(c && keys?.lead ? c.attrs(keys.lead) : editAttrs?.lead)}>{leadNode}</p>
        ) : null}
        {media ? (
          <div
            className="relative mx-auto mt-8 aspect-[16/10] w-full max-w-xl overflow-hidden rounded-3xl ring-1 ring-white/20"
            style={media.transitionName ? { viewTransitionName: media.transitionName } : undefined}
          >
            <Image
              src={media.src}
              alt={media.alt}
              fill
              sizes="(max-width: 768px) 100vw, 576px"
              className="object-cover"
              priority
            />
          </div>
        ) : null}
        {children ? <div className="mt-8">{children}</div> : null}
      </div>

      <div aria-hidden="true" className={`absolute inset-x-0 bottom-0 ${scallopClass}`} />
    </section>
  );
}

/** Bantta yüzen dekoratif şekiller. Tamamen dekoratif — okuyucuya sunulmaz. */
function Confetti() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <span className="confetti-float absolute left-[6%] top-8 h-16 w-16 rounded-full bg-sunny/25" />
      <span className="confetti-float absolute right-[8%] top-6 h-24 w-24 rounded-full bg-bubble/20" />
      <span className="confetti-float absolute right-[22%] bottom-12 h-10 w-10 rotate-12 rounded-xl bg-mint/25" />
      <span className="confetti-float absolute left-[18%] bottom-10 h-8 w-8 rotate-45 rounded-md bg-sky/25" />
      <span className="confetti-float absolute left-[46%] top-4 h-6 w-6 rounded-full bg-white/20" />
    </div>
  );
}
