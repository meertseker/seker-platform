import PageHero from '@/app/components/PageHero';
import JsonLd from '@/app/components/JsonLd';
import FormSection from '@/app/components/FormSection';
import { Editable } from '@/app/components/edit/Editable';
import { buildBreadcrumbSchema } from '@/lib/schema';
import { makeReader } from '@/lib/content/reader';
import type { ReaderData } from '@/lib/content/types';

/** Adım rozetlerinin renkleri — üç adım, üç ton. */
const STEP_ACCENTS = ['bg-grape', 'bg-bubble-deep', 'bg-mint-deep'];

type Step = { id: string; title: string; description: string };

export default function KayitView({ data }: { data: ReaderData }) {
  const c = makeReader(data);
  const steps = c.list<Step>('kayit.steps');
  return (
    <div className="min-h-screen bg-paper">
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Ana Sayfa', path: '/' },
          { name: 'Kayıt', path: '/kayit' },
        ])}
      />

      <PageHero
        c={c}
        keys={{ eyebrow: 'kayit.hero.eyebrow', title: 'kayit.hero.title', lead: 'kayit.hero.lead' }}
        tone="bubble"
        scallopTone="paper-warm"
      />

      {/* Form en üstte: bu sayfa randevu düğmelerinin hedefi. Geri arama süresi formun kendi alt satırında yazıyor. */}
      <FormSection c={c} data={data} keys={{ title: 'kayit.form.title' }} />

      <section className="mx-auto max-w-5xl px-6 py-16">
        <Editable c={c} k="kayit.steps.title" as="h2" className="text-center font-display text-3xl text-ink" />
        {/* Numaralandırma burada gerçek bir sıra taşır: adımlar birbirini izler. */}
        <ol className="mt-12 grid gap-8 md:grid-cols-3" {...c.listAttrs('kayit.steps')}>
          {steps.map((step, index) => (
            <li key={step.id} className="card-lift rounded-3xl bg-white p-8 shadow-sm ring-1 ring-rule">
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-2xl font-display text-2xl text-white ${STEP_ACCENTS[index % STEP_ACCENTS.length]}`}
              >
                {index + 1}
              </span>
              <Editable c={c} k="kayit.steps" path={`${step.id}.title`} value={step.title} as="h3" className="mt-4 font-display text-xl text-ink" />
              <Editable c={c} k="kayit.steps" path={`${step.id}.description`} value={step.description} as="p" className="mt-3 text-ink-soft" />
            </li>
          ))}
        </ol>
      </section>

    </div>
  );
}
