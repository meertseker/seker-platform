import PageHero from '@/app/components/PageHero';
import JsonLd from '@/app/components/JsonLd';
import LeadForm from '@/app/components/LeadForm';
import { Editable } from '@/app/components/edit/Editable';
import { buildBreadcrumbSchema } from '@/lib/schema';
import { makeReader } from '@/lib/content/reader';
import type { ReaderData } from '@/lib/content/types';

type SafetySection = { id: string; title: string; body: string };

/** Güvenlik kartlarının şerit renkleri — sitenin aksan sırası. */
const SAFETY_STRIPES = ['bg-grape', 'bg-mint', 'bg-sky', 'bg-bubble'];

export default function GuvenlikView({ data }: { data: ReaderData }) {
  const c = makeReader(data);
  const sections = c.list<SafetySection>('guvenlik.sections');
  return (
    <div className="min-h-screen bg-paper">
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Ana Sayfa', path: '/' },
          { name: 'Güvenlik ve Sağlık', path: '/guvenlik' },
        ])}
      />

      <PageHero
        c={c}
        keys={{ eyebrow: 'guvenlik.hero.eyebrow', title: 'guvenlik.hero.title', lead: 'guvenlik.hero.lead' }}
        tone="mint"
        scallopTone="paper-warm"
      />

      <section className="bg-paper-warm py-16">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid gap-6 md:grid-cols-2" {...c.listAttrs('guvenlik.sections')}>
            {sections.map((section, index) => (
              <div
                key={section.id}
                className="card-lift overflow-hidden rounded-3xl bg-white shadow-sm"
              >
                <div className={`h-1.5 ${SAFETY_STRIPES[index % SAFETY_STRIPES.length]}`} />
                <div className="p-8">
                  <Editable c={c} k="guvenlik.sections" path={`${section.id}.title`} value={section.title} as="h2" className="font-display text-xl text-ink" />
                  <Editable c={c} k="guvenlik.sections" path={`${section.id}.body`} value={section.body} as="p" className="mt-3 text-ink-soft" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-2xl px-6">
          <Editable c={c} k="guvenlik.cta.title" as="h2" className="text-center font-display text-3xl text-ink" />
          <Editable c={c} k="guvenlik.cta.lead" as="p" className="mt-4 text-center text-ink-soft" />
          <div className="mt-10 rounded-3xl bg-white p-6 shadow-lg shadow-ink/5 ring-1 ring-rule md:p-8">
            <LeadForm />
          </div>
        </div>
      </section>
    </div>
  );
}
