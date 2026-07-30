import Header from '@/app/components/Header';
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

      <section className="bg-ink py-20 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-mark">
          2-6 yaş · Beykent Büyükçekmece
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl px-6 font-display text-4xl text-white md:text-5xl">
          2026-2027 kayıtlarımız açık
        </h1>
        <p className="mx-auto mt-6 max-w-2xl px-6 text-paper">
          Sınıflarımız 10 kişilik ve her sınıfta iki öğretmen görev yapıyor. Bu düzeni korumak
          için kontenjanımız sınırlı — 2-3 yaş oyun grubundan 5-6 yaş ilkokula hazırlık sınıfına
          kadar tüm gruplarda yer ayırmak için erken başvurmanızı öneririz.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center font-display text-3xl text-ink">Kayıt süreci üç adımdan oluşur</h2>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <div key={step.title} className="rounded-xl bg-paper p-8">
              <span className="font-display text-3xl text-ink">{index + 1}</span>
              <h3 className="mt-4 font-display text-xl text-ink">{step.title}</h3>
              <p className="mt-3 text-ink-soft">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-paper py-16">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-center font-display text-3xl text-ink">
            Ön görüşme randevunuzu alın
          </h2>
          <p className="mt-4 text-center text-ink-soft">
            Formu gönderdiğinizde okul yönetimimiz ortalama 15 dakika içinde sizi arar.
          </p>
          <div className="mt-10">
            <LeadForm variant="full" />
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
            className="rounded-full bg-ink px-8 py-4 font-medium text-white transition hover:bg-ink-soft"
          >
            {SITE.phone.display}
          </TrackedLink>
          <TrackedLink
            href={WHATSAPP_URL}
            event="whatsapp_click"
            payload={{ page: 'kayit' }}
            external
            className="rounded-full border border-ink px-8 py-4 font-medium text-ink transition hover:bg-paper-warm"
          >
            WhatsApp&apos;tan Yazın
          </TrackedLink>
        </div>
      </section>
    </div>
  );
}
