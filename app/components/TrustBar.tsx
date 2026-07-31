import { SITE } from '@/lib/site';
import { ROSTER_STATUS } from '@/content/day';

/**
 * Sınıf mevcudu ve öğretmen oranı yalnızca ROSTER_STATUS.ready true iken
 * gösterilir (doğrulama kuyruğu #1, #2 — asset dosyası §0.2). Rakamlar
 * burada asla hardcode edilmez; tek kaynak content/day.ts'dir. Kapı
 * kapalıyken şerit, doğrulama gerektirmeyen iki kalemle çalışır.
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
    <section className="border-y border-rule bg-paper">
      <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-12 gap-y-8 px-6 py-12">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="font-display text-3xl text-ink">{stat.value}</p>
            <p className="mt-2 text-sm text-ink-soft">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
