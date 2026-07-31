import Header from '../components/Header';
import JsonLd from '../components/JsonLd';
import LeadForm from '../components/LeadForm';
import TimeSpine from '../components/cine/TimeSpine';
import DayChapters from '../components/cine/DayChapters';
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
        <section className="mx-auto max-w-3xl px-6 pt-20 pb-14">
          <h1 className="text-5xl text-ink md:text-6xl">Bir günümüz</h1>
          <p className="mt-6 text-lg text-ink-soft">
            Velilerin bize en çok sorduğu soru: &quot;Çocuğum orada bütün gün ne
            yapıyor?&quot; Cevabı aşağıda.
          </p>
        </section>

        <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[180px_1fr]">
          <TimeSpine chapters={DAY_CHAPTERS} />
          <DayChapters chapters={DAY_CHAPTERS} />
        </div>

        <section className="mt-16 bg-ink py-16">
          <div className="mx-auto max-w-2xl px-6">
            <h2 className="text-3xl text-paper">Bu akışı yerinde görün</h2>
            <p className="mt-4 text-paper/80">
              Bu akış yazıldığı gibi işliyor. Emin olmak isterseniz ders
              saatinde gelin — randevunuzu sabaha alalım, çalışırken görün.
            </p>
            <div className="mt-8 rounded-2xl bg-paper p-6 md:p-8">
              <LeadForm variant="compact" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
