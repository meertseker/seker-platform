import { SITE } from '@/lib/site';
import { ROSTER_STATUS, ENGLISH_HOURS_PER_DAY } from '@/content/day';

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
          { value: String(ROSTER_STATUS.childCount), label: 'Sınıfta çocuk' },
          {
            value: String(ROSTER_STATUS.teacherCount),
            label: 'Her sınıfta öğretmen',
          },
        ]
      : []),
    { value: `${ENGLISH_HOURS_PER_DAY} saat`, label: 'Her gün İngilizce' },
    { value: `${yearsActive} yıl`, label: "Beykent'te aynı adreste" },
  ];

  return (
    <section className="hidden px-6 pb-4 md:block">
      <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-4 rounded-3xl bg-paper-warm px-6 py-8">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className="min-w-48 flex-1 rounded-2xl bg-white px-6 py-5 text-center shadow-sm"
          >
            <p
              className={`font-display text-2xl md:text-3xl ${
                index % 2 === 0 ? 'text-grape' : 'text-bubble-deep'
              }`}
            >
              {stat.value}
            </p>
            <p className="mt-1 text-xs text-ink-soft md:mt-2 md:text-sm">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
