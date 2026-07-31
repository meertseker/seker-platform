import { SITE } from '@/lib/site';
import { ROSTER_STATUS } from '@/content/day';

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
 */
export default function TrustBar() {
  const yearsActive = new Date().getFullYear() - SITE.foundingYear;

  const stats = [
    ...(ROSTER_STATUS.ready
      ? [
          { value: String(ROSTER_STATUS.childCount), label: 'Sınıf mevcudu' },
          {
            value: `1 : ${Math.round(ROSTER_STATUS.childCount / ROSTER_STATUS.teacherCount)}`,
            label: 'Öğretmen başına çocuk',
          },
        ]
      : []),
    { value: `${yearsActive} yıl`, label: "Beykent'te aynı adreste" },
    { value: '2-6', label: 'Yaş grubu' },
  ];

  return (
    <section className="hidden border-y border-rule bg-paper md:block">
      <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-12 gap-y-8 px-6 py-12">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="font-display text-2xl text-ink md:text-3xl">{stat.value}</p>
            <p className="mt-1 text-xs text-ink-soft md:mt-2 md:text-sm">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
