import Image from 'next/image';
import Header from '@/app/components/Header';
import JsonLd from '@/app/components/JsonLd';
import LeadForm from '@/app/components/LeadForm';
import { TEACHERS } from '@/content/teachers';
import { buildMetadata } from '@/lib/metadata';
import { buildBreadcrumbSchema } from '@/lib/schema';

export const metadata = buildMetadata({
  title: 'Öğretmen Kadromuz',
  description:
    'Özel Şeker Anaokulu öğretmen kadrosu. Okul öncesi öğretmenliği ve çocuk gelişimi mezunu, deneyimli eğitimcilerimizle tanışın.',
  path: '/kadromuz',
});

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]!.toLocaleUpperCase('tr-TR'))
    .slice(0, 2)
    .join('');
}

export default function KadromuzPage() {
  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Ana Sayfa', path: '/' },
          { name: 'Kadromuz', path: '/kadromuz' },
        ])}
      />

      <section className="bg-ink py-20 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-mark">Kadromuz</p>
        <h1 className="mx-auto mt-4 max-w-3xl px-6 font-display text-4xl text-white md:text-5xl">
          10 çocuğa 2 öğretmen: öğretmen başına 5 çocuk.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl px-6 text-paper">
          Bu oran bizim için bir pazarlama cümlesi değil, sınıf düzenimizin temelidir.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-lg text-ink-soft">
          Yüksek gelirli ailelerin bir okulu değerlendirirken en önce sorduğu iki şey öğretmen
          niteliği ve öğretmen başına düşen çocuk sayısıdır. 2011&apos;den beri her sınıfımızda
          iki öğretmen bulunur; kadromuzu aşağıda tanıtıyoruz.
        </p>
      </section>

      <section className="bg-paper py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {TEACHERS.map((person) => (
              <div key={person.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                {person.photo ? (
                  <div className="relative h-64 bg-paper-warm">
                    <Image
                      src={person.photo}
                      alt={person.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="flex h-64 items-center justify-center bg-mark"
                    role="img"
                    aria-label={person.name}
                  >
                    <span className="font-display text-5xl text-ink">
                      {getInitials(person.name)}
                    </span>
                  </div>
                )}
                <div className="p-6">
                  <h2 className="font-display text-xl text-ink">{person.name}</h2>
                  <p className="mt-1 text-sm font-medium uppercase tracking-wide text-ink-soft">
                    {person.role}
                  </p>
                  <p className="mt-4 text-ink-soft">{person.education}</p>
                  <p className="mt-2 text-sm text-ink-soft">{person.experience}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-center font-display text-3xl text-ink">
            Kadromuzla tanışmak için randevu alın
          </h2>
          <p className="mt-4 text-center text-ink-soft">
            Ön görüşmede çocuğunuzun sınıf öğretmenleriyle birebir tanışma imkânı sunuyoruz.
          </p>
          <div className="mt-10">
            <LeadForm variant="compact" />
          </div>
        </div>
      </section>
    </div>
  );
}
