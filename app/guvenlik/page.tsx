import Header from '@/app/components/Header';
import JsonLd from '@/app/components/JsonLd';
import LeadForm from '@/app/components/LeadForm';
import { buildMetadata } from '@/lib/metadata';
import { buildBreadcrumbSchema } from '@/lib/schema';

export const metadata = buildMetadata({
  title: 'Güvenlik ve Sağlık',
  description:
    'Kamera sistemi, kontrollü giriş-çıkış, yangın güvenliği ve hijyen protokolleriyle Beykent\'te güvenli anaokulu ortamı.',
  path: '/guvenlik',
});

type SafetySection = {
  id: string;
  title: string;
  /** true while the fact is unverified — do not fabricate specifics. */
  todo: boolean;
  body: string;
};

// TODO: Her bölüm okuldan doğrulanmış bilgiyle güncellenmeli. Gerçek belge/sertifika
// numaraları ve tarihleri olmadan spesifik iddia yazılmamalı.
const SAFETY_SECTIONS: SafetySection[] = [
  {
    id: 'kamera',
    title: 'Kamera sistemi',
    todo: true,
    body: 'TODO: Kamera kapsamı (giriş, koridor, bahçe, sınıflar mı?), kayıt süresi ve kimlerin erişebildiği bilgisi eklenecek.',
  },
  {
    id: 'giris-cikis',
    title: 'Kontrollü giriş-çıkış',
    todo: true,
    body: 'TODO: Kapı/turnike sistemi, veli teslim-alım protokolü ve yetkisiz giriş önlemleri açıklanacak.',
  },
  {
    id: 'yangin',
    title: 'Yangın güvenliği',
    todo: true,
    body: 'TODO: Yangın alarm sistemi, söndürme tüpleri, tatbikat sıklığı ve itfaiye onay belgesi bilgisi eklenecek.',
  },
  {
    id: 'deprem',
    title: 'Deprem dayanıklılık belgesi',
    todo: true,
    body: 'TODO: Bina deprem dayanıklılık raporu, yapı yılı ve ilgili mühendislik belgesi eklenecek.',
  },
  {
    id: 'hijyen',
    title: 'Hijyen protokolü',
    todo: true,
    body: 'TODO: Temizlik sıklığı, dezenfeksiyon rutini ve gıda hijyeni protokolü eklenecek.',
  },
  {
    id: 'saglik-personeli',
    title: 'Sağlık personeli',
    todo: true,
    body: 'TODO: İlk yardım sertifikalı personel sayısı, hemşire/doktor varlığı ve acil sağlık protokolü eklenecek.',
  },
  {
    id: 'servis',
    title: 'Servis güvenliği',
    todo: true,
    body: 'TODO: Servis araçlarının güvenlik donanımı, şoför/rehber personel kontrolü ve güzergâh bilgisi eklenecek.',
  },
  {
    id: 'acil-durum',
    title: 'Acil durum planı',
    todo: true,
    body: 'TODO: Tahliye planı, acil durum iletişim zinciri ve veli bilgilendirme süreci eklenecek.',
  },
];

export default function GuvenlikPage() {
  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Ana Sayfa', path: '/' },
          { name: 'Güvenlik ve Sağlık', path: '/guvenlik' },
        ])}
      />

      <section className="bg-ink py-20 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-paper/70">Güvenlik ve Sağlık</p>
        <h1 className="mx-auto mt-4 max-w-3xl px-6 font-display text-4xl text-white md:text-5xl">
          Çocuğunuzun güvenliği, tesadüfe bırakılmaz.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl px-6 text-paper">
          Aşağıdaki başlıklar okulumuzun güvenlik ve sağlık uygulamalarını özetler. İşaretli
          bölümler, doğrulanmış belge ve rakamlarla yakında güncellenecektir.
        </p>
      </section>

      <section className="bg-paper py-16">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid gap-6 md:grid-cols-2">
            {SAFETY_SECTIONS.map((section) => (
              <div key={section.id} className="rounded-xl bg-white p-8">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-xl text-ink">{section.title}</h2>
                  {section.todo && (
                    <span className="shrink-0 rounded-full border border-rule bg-paper-warm px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink">
                      Doğrulanacak
                    </span>
                  )}
                </div>
                <p className="mt-3 text-ink-soft">{section.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-center font-display text-3xl text-ink">
            Güvenlik uygulamalarımızı yerinde inceleyin
          </h2>
          <p className="mt-4 text-center text-ink-soft">
            Ön görüşme sırasında bina güvenlik önlemlerini birlikte gözden geçirebiliriz.
          </p>
          <div className="mt-10">
            <LeadForm variant="compact" />
          </div>
        </div>
      </section>
    </div>
  );
}
