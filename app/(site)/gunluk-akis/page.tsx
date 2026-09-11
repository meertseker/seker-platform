import Header from '@/app/components/Header';
import PageHero from '@/app/components/PageHero';
import JsonLd from '@/app/components/JsonLd';
import LeadForm from '@/app/components/LeadForm';
import TimeSpine from '@/app/components/cine/TimeSpine';
import DayChapters from '@/app/components/cine/DayChapters';
import { DAY_CHAPTERS } from '@/content/day';
import { buildMetadata } from '@/lib/metadata';
import { buildBreadcrumbSchema } from '@/lib/schema';

export const metadata = buildMetadata({
  title: 'Günlük Akış',
  description:
    "Şeker Anaokulu'nda bir gün: karşılamadan çıkışa — sabah çemberi, Montessori çalışma saati, İngilizce, bahçe ve atölyeler. Beykent Büyükçekmece, 2-6 yaş.",
  path: '/gunluk-akis',
});

export default function GunlukAkisPage() {
  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Ana Sayfa', path: '/' },
          { name: 'Günlük Akış', path: '/gunluk-akis' },
        ])}
      />
      <main>
        <PageHero
          eyebrow="Karşılamadan çıkışa"
          title="Bir günümüz"
          lead={'Velilerin bize en çok sorduğu soru: "Çocuğum orada bütün gün ne yapıyor?" Cevabı aşağıda.'}
          tone="sunny"
        />

        <div className="mx-auto grid max-w-6xl gap-10 px-6 pt-14 lg:grid-cols-[180px_1fr]">
          <TimeSpine chapters={DAY_CHAPTERS} />
          <DayChapters chapters={DAY_CHAPTERS} />
        </div>

        <section className="band-grape relative mt-16 overflow-hidden py-16">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <span className="confetti-float absolute -left-8 top-8 h-32 w-32 rounded-full bg-sunny/15" />
            <span className="confetti-float absolute right-[6%] bottom-10 h-24 w-24 rounded-full bg-bubble/20" />
          </div>
          <div className="relative z-10 mx-auto max-w-2xl px-6">
            <h2 className="text-3xl text-white">Bu akışı yerinde görün</h2>
            <p className="mt-4 text-white/85">
              Bu akış yazıldığı gibi işliyor. Emin olmak isterseniz ders
              saatinde gelin — randevunuzu sabaha alalım, çalışırken görün.
            </p>
            <div className="mt-8 rounded-3xl bg-white p-6 shadow-xl shadow-ink/20 md:p-8">
              <LeadForm />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
