import { SITE } from '@/lib/site';

const STATS = [
  { value: '10', label: 'Sınıf mevcudu' },
  { value: '1 : 5', label: 'Öğretmen başına çocuk' },
  { value: `${new Date().getFullYear() - SITE.foundingYear} yıl`, label: 'Beykent\'te kesintisiz' },
  { value: 'Native', label: 'İngilizce öğretmeni' },
];

export default function TrustBar() {
  return (
    <section className="border-y border-rule bg-paper">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-12 md:grid-cols-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="font-display text-3xl text-ink">{stat.value}</p>
            <p className="mt-2 text-sm text-ink-soft">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
