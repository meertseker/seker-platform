import type { ReactNode } from 'react';
import LeadForm from './LeadForm';
import Timecode from './cine/Timecode';
import { Editable } from './edit/Editable';
import { pickData } from '@/lib/content/reader';
import type { Reader, ReaderData } from '@/lib/content/types';

/**
 * Randevu formu bloğu — her sayfanın sonunda aynı kalıp:
 * (üst etiket) / başlık / kısa açıklama / form. Çapa `#randevu`; sayfa içi
 * düğmeler ("Ön Görüşme Randevusu Alın") buraya kaydırır.
 *
 * Metinler sayfanın kendi alanlarından gelir (`keys`); başlık liste alanından
 * türetiliyorsa (yaş grubu alt sayfası) `title` ile hazır düğüm verilir.
 * `data` yalnızca forma gider (`form.*`); başka alan taşımaz.
 */
export default function FormSection({
  c,
  data,
  keys,
  title,
  tone = 'warm',
  id = 'randevu',
  children,
}: {
  c: Reader;
  data: ReaderData;
  keys?: { eyebrow?: string; title?: string; lead?: string };
  /** `keys.title` yerine hazır başlık (birleşik metinler için). */
  title?: ReactNode;
  tone?: 'warm' | 'paper' | 'white';
  id?: string;
  /** Formun altına eklenen içerik (ör. iletişim kartları). */
  children?: ReactNode;
}) {
  const bg = tone === 'warm' ? 'bg-paper-warm' : tone === 'white' ? 'bg-white' : 'bg-paper';
  const card = tone === 'white' ? 'ring-1 ring-rule' : '';
  return (
    <section id={id} className={`${bg} relative scroll-mt-24 overflow-hidden py-14 md:py-20`}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <span className="confetti-float absolute -right-12 top-10 h-40 w-40 rounded-full bg-grape/10" />
        <span className="confetti-float absolute -left-10 bottom-16 h-32 w-32 rounded-full bg-sunny/15" />
      </div>
      <div className="relative z-10 mx-auto max-w-2xl px-4 md:px-6">
        <div className="text-center">
          {keys?.eyebrow ? <Timecode editAttrs={c.attrs(keys.eyebrow)}>{c.text(keys.eyebrow)}</Timecode> : null}
          {keys?.title ? (
            <Editable c={c} k={keys.title} as="h2" className="mt-2 font-display text-2xl text-ink md:text-3xl" />
          ) : (
            <h2 className="mt-2 font-display text-2xl text-ink md:text-3xl">{title}</h2>
          )}
          {keys?.lead ? <Editable c={c} k={keys.lead} as="p" className="mx-auto mt-3 max-w-xl text-ink-soft" /> : null}
        </div>
        <div className={`mt-8 rounded-3xl bg-white p-5 shadow-lg shadow-ink/5 md:p-8 ${card}`}>
          <LeadForm data={pickData(data, ['form.'])} />
        </div>
        {children ? <div className="mt-12">{children}</div> : null}
      </div>
    </section>
  );
}
