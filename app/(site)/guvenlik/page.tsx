import PageHero from '@/app/components/PageHero';
import JsonLd from '@/app/components/JsonLd';
import LeadForm from '@/app/components/LeadForm';
import { buildMetadata } from '@/lib/metadata';
import { buildBreadcrumbSchema } from '@/lib/schema';
import { SITE } from '@/lib/site';
import { SUPPORT } from '@/content/program';

export const metadata = buildMetadata({
  title: 'Güvenlik ve Sağlık',
  description:
    "Kamera sistemi ve veli erişimi, gözetim altındaki iki bahçe, okulun kendi mutfağı ve uzman psikolog desteği. Beykent Büyükçekmece Özel Şeker Anaokulu.",
  path: '/guvenlik',
});

/**
 * Bu sayfa daha önce sekiz adet "TODO: ... eklenecek" kartını doğrudan
 * yayında gösteriyordu. Artık yalnızca okulun doğruladığı uygulamalar
 * yazılıyor; belge gerektiren başlıklar (yangın onayı, deprem raporu,
 * hijyen protokolü, acil durum planı) sayfada iddia olarak yer almaz —
 * bunlar ön görüşmede yerinde gösterilir.
 */
const SAFETY_SECTIONS = [
  {
    id: 'kamera',
    title: 'Kamera sistemi ve veli erişimi',
    body: 'Okulun her yeri kamerayla izleniyor ve velilerimiz bu görüntülere kendileri erişebiliyor. İşten çıkmadan önce telefonu açıp çocuğunuzun ne yaptığına bakabilirsiniz. Bunu bir denetim aracı olarak değil, içiniz rahat etsin diye sunuyoruz.',
  },
  {
    id: 'bahce',
    title: 'Gözetim altındaki iki bahçe',
    body: 'Çocuklar günün büyük bölümünü bahçede geçiriyor. İki bahçemiz de kapalı ve gözetim altında; oyun alanları öğretmenin görebileceği mesafede kurulu. Çocuk kendi oyununu kurar, öğretmen gözler ve gerektiğinde araya girer.',
  },
  {
    id: 'teslim',
    title: 'Günü birlikte kapatıyoruz',
    body: 'Her çocuk alınırken öğretmeni size o günü anlatır: ne yaptı, neyi zor buldu, neye ilk kez cesaret etti. Çocuğunuzu kimin alacağı değişecekse bunu önceden bize bildirmeniz gerekiyor.',
  },
  {
    id: 'mutfak',
    title: 'Okulun kendi mutfağı',
    body: 'Yemeklerimiz okulun kendi mutfağında, her gün taze olarak hazırlanıyor. Aylık yemek listesini velilerimizle önceden paylaşıyoruz. Çocuğunuzun alerjisi ya da özel bir beslenme durumu varsa kayıt sırasında not alıyor ve mutfağa iletiyoruz.',
  },
  {
    id: 'psikolog',
    title: 'Uzman psikolog desteği',
    body: SUPPORT.psychologist,
  },
  {
    id: 'servis',
    title: 'Servis',
    body: `${SITE.areaServed.join(', ')} taraflarına servisimiz var. Güzergâh ve saatler kayıtlı ailelerin adreslerine göre şekillendiği için, adresinizin uygunluğunu ön görüşmede birlikte değerlendiriyoruz.`,
  },
];

/** Güvenlik kartlarının şerit renkleri — sitenin aksan sırası. */
const SAFETY_STRIPES = ['bg-grape', 'bg-mint', 'bg-sky', 'bg-bubble'];

export default function GuvenlikPage() {
  return (
    <div className="min-h-screen bg-paper">
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Ana Sayfa', path: '/' },
          { name: 'Güvenlik ve Sağlık', path: '/guvenlik' },
        ])}
      />

      <PageHero
        eyebrow="Güvenlik ve Sağlık"
        title="Çocuğunuzun güvenliği, tesadüfe bırakılmaz."
        lead="Aşağıda okulumuzda her gün işleyen güvenlik ve sağlık uygulamalarını bulacaksınız. Yangın, deprem ve acil durum belgelerimizi ise ön görüşmede yerinde gösteriyoruz — bir web sayfasında okuduğunuz cümle yerine belgenin kendisini görmeniz daha anlamlı."
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
                  <h2 className="font-display text-xl text-ink">{section.title}</h2>
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
            Ön görüşmede binayı birlikte gezip giriş-çıkış düzenini, bahçeleri ve
            belgelerimizi gözden geçirebiliriz.
          </p>
          <div className="mt-10 rounded-3xl bg-white p-6 shadow-lg shadow-ink/5 ring-1 ring-rule md:p-8">
            <LeadForm />
          </div>
        </div>
      </section>
    </div>
  );
}
