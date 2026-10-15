import { ROSTER_STATUS } from '@/content/day';
import { Editable } from '@/app/components/edit/Editable';
import { makeReader } from '@/lib/content/reader';
import type { ReaderData } from '@/lib/content/types';

/**
 * Sınıf mevcudu ve öğretmen oranı yalnızca ROSTER_STATUS.ready true iken
 * gösterilir (doğrulama kuyruğu #1, #2 — asset dosyası §0.2). Rakamlar
 * burada asla hardcode edilmez; tek kaynak content/day.ts'dir. Kapı
 * kapalıyken şerit, doğrulama gerektirmeyen iki kalemle çalışır.
 *
 * Fix round 1/5, Important 4 — 375 px'te bu şerit, formu ilk kaydırmanın
 * dışına iten katmanlardan biriydi. Kuruluş yılı zaten hero'nun üst
 * etiketinde geçtiği için (bkz. HeroSection), bu ikincil güven şeridi
 * mobilde gizlenir; md+ genişlikte (yan yana iki sütunlu hero'nun altında,
 * alan sıkışık olmadığında) tekrar görünür.
 *
 * Etiketler `trust.*` alanlarından gelir; yıl sayısı `{yilSayisi}` belirtecidir.
 * Sınıf/öğretmen rakamları kodda kalır (düzenlenmez).
 */
type Stat = { value: string; valueKey?: string; label: string; labelKey: string };

export default function TrustBar({ data }: { data: ReaderData }) {
  const c = makeReader(data);

  const stats: Stat[] = [
    ...(ROSTER_STATUS.ready
      ? [
          { value: String(ROSTER_STATUS.childCount), label: c.text('trust.children.label'), labelKey: 'trust.children.label' },
          {
            value: String(ROSTER_STATUS.teacherCount),
            label: c.text('trust.teachers.label'),
            labelKey: 'trust.teachers.label',
          },
        ]
      : []),
    { value: c.text('trust.english.value'), valueKey: 'trust.english.value', label: c.text('trust.english.label'), labelKey: 'trust.english.label' },
    { value: c.text('trust.years.value'), valueKey: 'trust.years.value', label: c.text('trust.years.label'), labelKey: 'trust.years.label' },
  ];

  return (
    <section className="hidden px-6 pb-4 md:block">
      <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-4 rounded-3xl bg-paper-warm px-6 py-8">
        {stats.map((stat, index) => {
          const valueClass = `font-display text-2xl md:text-3xl ${index % 2 === 0 ? 'text-grape' : 'text-bubble-deep'}`;
          return (
            <div
              key={stat.labelKey}
              className="min-w-48 flex-1 rounded-2xl bg-white px-6 py-5 text-center shadow-sm"
            >
              {stat.valueKey ? (
                <Editable c={c} k={stat.valueKey} as="p" className={valueClass} />
              ) : (
                <p className={valueClass}>{stat.value}</p>
              )}
              <Editable c={c} k={stat.labelKey} as="p" className="mt-1 text-xs text-ink-soft md:mt-2 md:text-sm" />
            </div>
          );
        })}
      </div>
    </section>
  );
}
