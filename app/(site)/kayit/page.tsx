import Header from '@/app/components/Header';
import PageHero from '@/app/components/PageHero';
import JsonLd from '@/app/components/JsonLd';
import LeadForm from '@/app/components/LeadForm';
import TrackedLink from '@/app/components/TrackedLink';
import { buildMetadata } from '@/lib/metadata';
import { buildBreadcrumbSchema } from '@/lib/schema';
import { SITE, WHATSAPP_URL } from '@/lib/site';

export const metadata = buildMetadata({
  title: '2026-2027 Kayıtları',
  description:
    'Özel Şeker Anaokulu 2026-2027 ön kayıt. Beykent Büyükçekmece\'de sınırlı kontenjanlı, 2-6 yaş okul öncesi eğitim. Ön görüşme randevusu alın.',
  path: '/kayit',
});

/** Adım rozetlerinin renkleri — üç adım, üç ton. */
const STEP_ACCENTS = ['bg-grape', 'bg-bubble-deep', 'bg-mint-deep'];

const STEPS = [
  {
    title: 'Ön görüşme talebi',
    description:
      'Formu doldurun veya arayın; çocuğunuzun yaş grubunu ve programını birlikte netleştirelim.',
  },
  {
    title: 'Okul ziyareti ve tanışma',
    description:
      'Sınıfları, öğretmenleri ve günün akışını yerinde görün; sorularınızı yüz yüze yanıtlayalım.',
  },
  {
    title: 'Kayıt',
    description:
      'Kontenjan uygunsa evrak ve kayıt işlemlerini tamamlayıp başlangıç tarihini birlikte planlayalım.',
  },
];

export default function KayitPage() {
  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Ana Sayfa', path: '/' },
          { name: 'Kayıt', path: '/kayit' },
        ])}
      />

      <PageHero
        eyebrow="2-6 yaş · Beykent Büyükçekmece"
        title="2026-2027 kayıtlarımız açık"
        lead="Sınıflarımız 10 kişilik ve her sınıfta iki öğretmen görev yapıyor. Bu düzeni korumak için kontenjanımız sınırlı — 2-3 yaş oyun grubundan 5-6 yaş ilkokula hazırlık sınıfına kadar tüm gruplarda yer ayırmak için erken başvurmanızı öneririz."
        tone="bubble"
      />

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center font-display text-3xl text-ink">Kayıt süreci üç adımdan oluşur</h2>
        {/* Numaralandırma burada gerçek bir sıra taşır: adımlar birbirini izler. */}
        <ol className="mt-12 grid gap-8 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="card-lift rounded-3xl bg-white p-8 shadow-sm ring-1 ring-rule">
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-2xl font-display text-2xl text-white ${STEP_ACCENTS[index % STEP_ACCENTS.length]}`}
              >
                {index + 1}
              </span>
              <h3 className="mt-4 font-display text-xl text-ink">{step.title}</h3>
              <p className="mt-3 text-ink-soft">{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-paper-warm py-16">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-center font-display text-3xl text-ink">
            Ön görüşme randevunuzu alın
          </h2>
          {/* Geri arama süresi formun kendi alt satırında yazıyor — burada tekrarlanmaz. */}
          <div className="mt-8 rounded-3xl bg-white p-6 shadow-lg shadow-ink/5 md:p-8">
            <LeadForm />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 className="font-display text-3xl text-ink">Formu doldurmadan da ulaşabilirsiniz</h2>
        <p className="mt-4 text-ink-soft">
          Telefon veya WhatsApp&apos;tan yazdığınızda da aynı 15 dakikalık dönüş taahhüdümüz
          geçerlidir.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <TrackedLink
            href={`tel:${SITE.phone.e164}`}
            event="tel_click"
            payload={{ page: 'kayit' }}
            className="rounded-full bg-grape px-8 py-4 font-semibold text-white shadow-lg shadow-grape/30 transition hover:bg-ink"
          >
            {SITE.phone.display}
          </TrackedLink>
          <TrackedLink
            href={WHATSAPP_URL}
            event="whatsapp_click"
            payload={{ page: 'kayit' }}
            external
            className="rounded-full border-2 border-mint-deep px-8 py-4 font-semibold text-ink transition hover:bg-mint/10"
          >
            WhatsApp&apos;tan Yazın
          </TrackedLink>
        </div>
      </section>
    </div>
  );
}
