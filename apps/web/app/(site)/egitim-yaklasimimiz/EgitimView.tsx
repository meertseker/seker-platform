import Link from 'next/link';
import PageHero from '@/app/components/PageHero';
import JsonLd from '@/app/components/JsonLd';
import FormSection from '@/app/components/FormSection';
import { Editable } from '@/app/components/edit/Editable';
import { buildBreadcrumbSchema, buildFaqSchema } from '@/lib/schema';
import { makeReader } from '@/lib/content/reader';
import type { ReaderData } from '@/lib/content/types';
import type { FaqItem } from '@/content/faq';

type Section = { id: string; question: string; p1: string; p2: string; p3: string; p4: string };
type Track = { id: string; name: string; description: string };
type Age = { id: string; ageLabel: string; groupName: string };
type Branch = { id: string; name: string; season: string };

const FAQ_IDS = ['egitim-programi', 'ingilizce', 'yas-araligi', 'sinif-mevcudu'];

/** Bölüm kartlarının şerit renkleri — sitenin aksan sırası. */
const SECTION_STRIPES = ['bg-grape', 'bg-bubble', 'bg-sunny', 'bg-mint', 'bg-sky'];

/** Yaş kartlarının adresi ve vurgu rengi (id ile eşlenir); etiketler `ageGroups.items` listesinden gelir. */
const AGE_LOOK: Record<string, { accent: string; href: string }> = {
  '2-3-yas': { accent: 'text-bubble-deep', href: '/yas-gruplari/2-3-yas' },
  '3-4-yas': { accent: 'text-sunny-deep', href: '/yas-gruplari/3-4-yas' },
  '4-5-yas': { accent: 'text-mint-deep', href: '/yas-gruplari/4-5-yas' },
  '5-6-yas': { accent: 'text-sky-deep', href: '/yas-gruplari/5-6-yas' },
};

const PARAGRAPHS = ['p1', 'p2', 'p3', 'p4'] as const;

export default function EgitimView({ data }: { data: ReaderData }) {
  const c = makeReader(data);
  const sections = c.list<Section>('egitim.sections');
  const tracks = c.list<Track>('egitim.english.tracks');
  const ages = c.list<Age>('ageGroups.items');
  const branchNames = c
    .list<Branch>('program.branches')
    .filter((branch) => branch.season === 'yil-boyu')
    .map((branch) => c.fill(branch.name))
    .join(', ');
  const faqSubset = c
    .list<FaqItem>('faq.items')
    .filter((item) => item.ready && FAQ_IDS.includes(item.id))
    .map((item) => ({ ...item, question: c.fill(item.question), answer: c.fill(item.answer) }));

  return (
    <div className="min-h-screen bg-paper">
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Ana Sayfa', path: '/' },
          { name: 'Eğitim Yaklaşımımız', path: '/egitim-yaklasimimiz' },
        ])}
      />
      <JsonLd data={buildFaqSchema(faqSubset)} />

      <PageHero
        c={c}
        keys={{ eyebrow: 'egitim.hero.eyebrow', title: 'egitim.hero.title', lead: 'egitim.hero.lead' }}
        tone="grape"
      />

      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="space-y-8" {...c.listAttrs('egitim.sections')}>
          {sections.map((section, sectionIndex) => (
            <div
              key={section.id}
              className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-rule"
            >
              <div className={`h-1.5 ${SECTION_STRIPES[sectionIndex % SECTION_STRIPES.length]}`} />
              <div className="p-8 md:p-10">
                <Editable
                  c={c}
                  k="egitim.sections"
                  path={`${section.id}.question`}
                  value={section.question}
                  as="h2"
                  className="font-display text-2xl text-ink md:text-3xl"
                />
                <div className="mt-5 space-y-4 text-ink-soft">
                  {/* Boş paragraf ziyaretçiye basılmaz; düzenlemede yeniden yazılabilsin diye boş hâliyle görünür. */}
                  {PARAGRAPHS.filter((field) => section[field] || c.editing).map((field, index) =>
                    section.id === 'brans' && field === 'p2' ? (
                      // Giriş cümlesi düzenlenir; branş adları program.branches listesinden türetilip arkasına eklenir.
                      // Ziyaretçi HTML'i değişmesin diye işaretli <span> yalnızca düzenleme modunda basılır.
                      c.editing ? (
                        <p key={field}>
                          <Editable c={c} k="egitim.sections" path={`${section.id}.${field}`} value={section[field]} />
                          {` ${branchNames}.`}
                        </p>
                      ) : (
                        <p key={field}>{`${c.fill(section[field])} ${branchNames}.`}</p>
                      )
                    ) : (
                      <Editable
                        key={field}
                        c={c}
                        k="egitim.sections"
                        path={`${section.id}.${field}`}
                        value={section[field]}
                        as="p"
                        className={index === 0 ? 'text-lg text-ink' : undefined}
                      />
                    ),
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* İngilizce programının içindeki üç ayrı çalışma. */}
      <section className="bg-paper-warm py-16">
        <div className="mx-auto max-w-4xl px-6">
          <Editable c={c} k="egitim.english.title" as="h2" className="text-center font-display text-3xl text-ink" />
          <div className="mt-10 grid gap-6 md:grid-cols-3" {...c.listAttrs('egitim.english.tracks')}>
            {tracks.map((track) => (
              <div key={track.id} className="card-lift rounded-3xl bg-white p-6 shadow-sm">
                <Editable c={c} k="egitim.english.tracks" path={`${track.id}.name`} value={track.name} as="h3" className="font-display text-xl text-ink" />
                <Editable c={c} k="egitim.english.tracks" path={`${track.id}.description`} value={track.description} as="p" className="mt-3 text-sm leading-relaxed text-ink-soft" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <Editable c={c} k="egitim.ages.title" as="h2" className="text-center font-display text-3xl text-ink" />
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4" {...c.listAttrs('ageGroups.items')}>
          {ages.map((group) => (
            <Link key={group.id} href={AGE_LOOK[group.id].href} className="card-lift rounded-3xl bg-white p-6 text-center shadow-sm">
              <Editable c={c} k="ageGroups.items" path={`${group.id}.ageLabel`} value={group.ageLabel} as="p" className={`font-display text-2xl ${AGE_LOOK[group.id].accent}`} />
              <Editable c={c} k="ageGroups.items" path={`${group.id}.groupName`} value={group.groupName} as="p" className="mt-2 text-sm text-ink-soft" />
            </Link>
          ))}
        </div>
        <Editable c={c} k="egitim.ages.note" as="p" className="mx-auto mt-8 max-w-2xl text-center text-ink-soft" />
      </section>

      <FormSection c={c} data={data} keys={{ title: 'egitim.cta.title', lead: 'egitim.cta.lead' }} />
    </div>
  );
}
