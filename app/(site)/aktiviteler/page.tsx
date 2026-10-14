import PageHero from '@/app/components/PageHero';
import JsonLd from '@/app/components/JsonLd';
import LeadForm from '@/app/components/LeadForm';
import BranchExplorer from './BranchExplorer';
import { buildMetadata } from '@/lib/metadata';
import { buildBreadcrumbSchema } from '@/lib/schema';
import { WEEK_DAYS, YEAR_ROUND_BRANCHES } from '@/content/program';

export const metadata = buildMetadata({
  title: 'Branş Dersleri ve Aktiviteler',
  description:
    'Montessori, seramik, robotik & kodlama, satranç, müzik & ritim, bale & dans, drama, görsel sanatlar ve İngilizce. Beykent Büyükçekmece Özel Şeker Anaokulu branş dersleri.',
  path: '/aktiviteler',
});

export default async function AktivitelerPage({
  searchParams,
}: {
  searchParams: Promise<{ ders?: string }>
}) {
  const { ders } = await searchParams

  return (
    <div className="min-h-screen bg-paper-warm">
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Ana Sayfa', path: '/' },
          { name: 'Branş Dersleri', path: '/aktiviteler' },
        ])}
      />

      <PageHero
        eyebrow={`${YEAR_ROUND_BRANCHES.length} ayrı çalışma alanı`}
        title="Branş Derslerimiz"
        lead="Çocukların farklı ilgi ve yetenek alanlarını denemesi için programımızı çeşitli branş ve çalışmalarla zenginleştiriyoruz. Aşağıda her dersin ne yaptığını ve neyi desteklediğini bulacaksınız."
        tone="grape"
        scallopTone="white"
      />

      <BranchExplorer initialSlug={ders} />

      {/* Haftanın günlerine bağlı ritüeller — derslerle birlikte okunması anlamlı. */}
      <section className="bg-paper-warm py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center font-display text-3xl text-ink">
            Haftalık özel günlerimiz
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-ink-soft">
            Okul yaşamını daha keyifli hâle getirmek için haftanın belirli
            günlerinde özel etkinlikler düzenliyoruz.
          </p>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {WEEK_DAYS.map((item) => (
              <li key={item.day} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-rule">
                <p className="timecode text-grape">{item.day}</p>
                <h3 className="mt-3 font-display text-lg leading-snug text-ink">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{item.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-center font-display text-3xl text-ink">
            Dersleri çalışırken görün
          </h2>
          <p className="mt-4 text-center text-ink-soft">
            Randevunuzu branş dersinin olduğu bir saate alalım; çocukların nasıl
            çalıştığını kendiniz izleyin.
          </p>
          <div className="mt-10 rounded-3xl bg-white p-6 shadow-lg shadow-ink/5 ring-1 ring-rule md:p-8">
            <LeadForm />
          </div>
        </div>
      </section>
    </div>
  );
}
