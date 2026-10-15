import PageHero from '@/app/components/PageHero';
import JsonLd from '@/app/components/JsonLd';
import LeadForm from '@/app/components/LeadForm';
import TrackedLink from '@/app/components/TrackedLink';
import { Editable } from '@/app/components/edit/Editable';
import { buildBreadcrumbSchema } from '@/lib/schema';
import { phoneE164, whatsappUrl } from '@/lib/site';
import { makeReader, pickData } from '@/lib/content/reader';
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
      />

      <section className="bg-paper-warm py-16">
        <div className="mx-auto max-w-2xl px-6">
          <Editable c={c} k="kayit.form.title" as="h2" className="text-center font-display text-3xl text-ink" />
          {/* Geri arama süresi formun kendi alt satırında yazıyor — burada tekrarlanmaz. */}
          <div className="mt-8 rounded-3xl bg-white p-6 shadow-lg shadow-ink/5 md:p-8">
            <LeadForm data={pickData(data, ['form.'])} />
          </div>
        </div>
      </section>

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

      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <Editable c={c} k="kayit.contact.title" as="h2" className="font-display text-3xl text-ink" />
        <Editable c={c} k="kayit.contact.lead" as="p" className="mt-4 text-ink-soft" />
        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <TrackedLink
            href={`tel:${phoneE164(c)}`}
            event="tel_click"
            payload={{ page: 'kayit' }}
            className="rounded-full bg-grape px-8 py-4 font-semibold text-white shadow-lg shadow-grape/30 transition hover:bg-ink"
            editAttrs={c.attrs('site.phone')}
          >
            {c.text('site.phone')}
          </TrackedLink>
          <TrackedLink
            href={whatsappUrl(c)}
            event="whatsapp_click"
            payload={{ page: 'kayit' }}
            external
            className="rounded-full border-2 border-mint-deep px-8 py-4 font-semibold text-ink transition hover:bg-mint/10"
            editAttrs={c.attrs('kayit.contact.ctaWhatsapp')}
          >
            {c.text('kayit.contact.ctaWhatsapp')}
          </TrackedLink>
        </div>
      </section>
    </div>
  );
}
