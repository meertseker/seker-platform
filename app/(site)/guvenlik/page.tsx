import Header from '@/app/components/Header';
import PageHero from '@/app/components/PageHero';
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

/** Güvenlik kartlarının şerit renkleri — sitenin aksan sırası. */
const SAFETY_STRIPES = ['bg-grape', 'bg-mint', 'bg-sky', 'bg-bubble'];

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

      <PageHero
        eyebrow="Güvenlik ve Sağlık"
        title="Çocuğunuzun güvenliği, tesadüfe bırakılmaz."
        lead="Aşağıdaki başlıklar okulumuzun güvenlik ve sağlık uygulamalarını özetler. İşaretli bölümler, doğrulanmış belge ve rakamlarla yakında güncellenecektir."
        tone="mint"
        scallopTone="paper-warm"
      />

      <section className="bg-paper-warm py-16">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid gap-6 md:grid-cols-2">
            {SAFETY_SECTIONS.map((section, index) => (
              <div
                key={section.id}
                className="card-lift overflow-hidden rounded-3xl bg-white shadow-sm"
              >
                <div className={`h-1.5 ${SAFETY_STRIPES[index % SAFETY_STRIPES.length]}`} />
                <div className="p-8">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-display text-xl text-ink">{section.title}</h2>
                    {section.todo && (
                      <span className="shrink-0 rounded-full bg-tangerine/12 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-tangerine-deep">
                        Doğrulanacak
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-ink-soft">{section.body}</p>
                </div>
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
          <div className="mt-10 rounded-3xl bg-white p-6 shadow-lg shadow-ink/5 ring-1 ring-rule md:p-8">
            <LeadForm />
          </div>
        </div>
      </section>
    </div>
  );
}
