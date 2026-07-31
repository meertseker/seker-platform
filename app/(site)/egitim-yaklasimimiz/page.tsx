import Header from '@/app/components/Header';
import JsonLd from '@/app/components/JsonLd';
import LeadForm from '@/app/components/LeadForm';
import { buildMetadata } from '@/lib/metadata';
import { buildBreadcrumbSchema, buildFaqSchema } from '@/lib/schema';
import { SITE } from '@/lib/site';
import { PUBLISHED_FAQ } from '@/content/faq';

export const metadata = buildMetadata({
  title: 'Eğitim Yaklaşımımız',
  description:
    'Montessori, High Scope ve Çoklu Zeka temelli okul öncesi eğitim programımız. Beykent Büyükçekmece\'de oyun temelli öğrenme yaklaşımı.',
  path: '/egitim-yaklasimimiz',
});

const FAQ_SUBSET = PUBLISHED_FAQ.filter((item) =>
  ['egitim-programi', 'ingilizce', 'yas-araligi', 'sinif-mevcudu'].includes(item.id),
);

const SECTIONS = [
  {
    question: 'Montessori yaklaşımı nedir ve biz nasıl uyguluyoruz?',
    answer: [
      'Montessori yaklaşımı, çocuğun hazırlanmış bir ortamda kendi hızında ve kendi seçimiyle öğrenmesidir; bunu 2-3 yaş oyun grubundan 5-6 yaş sınıfına kadar tüm gruplarımızda uyguluyoruz.',
      'Sınıflarımızda 10 çocuk ve 2 öğretmen bulunur — öğretmen başına 5 çocuk. Bu oran, her çocuğun Montessori materyalleriyle bireysel çalışmasını gerçek anlamda gözlemleyip yönlendirebilmemizi sağlar; kalabalık bir sınıfta bu yaklaşım sözde kalır.',
      '2-3 yaş oyun grubunda duyusal materyallerle başlayan çalışmalar, 5-6 yaşta okuma yazmaya hazırlık materyallerine kadar kademeli olarak ilerler.',
    ],
  },
  {
    question: 'High Scope programı çocuğa ne kazandırır?',
    answer: [
      'High Scope programı çocuğa "planla-yap-değerlendir" döngüsüyle karar verme, sorumluluk alma ve kendi öğrenmesini yönetme becerisini kazandırır.',
      'Çocuk günün başında ne yapacağını seçer, seçtiği etkinliği gerçekleştirir ve gün sonunda öğretmenle birlikte bunu değerlendirir. Bu döngü 3-4, 4-5 ve 5-6 yaş sınıflarımızda her gün tekrarlanır ve yaş büyüdükçe planlama süresi ve karmaşıklığı artar.',
      'Sonuç, yönergeyle değil kendi kararıyla harekete geçen bir çocuktur — bu da ilkokula geçişte önemli bir avantajdır.',
    ],
  },
  {
    question: 'Çoklu zeka kuramını günlük programda nasıl kullanıyoruz?',
    answer: [
      'Çoklu zeka kuramını, her çocuğun güçlü olduğu alanı günlük etkinlik çeşitliliğiyle ortaya çıkarmak için kullanıyoruz; tek bir "doğru" öğrenme yolu olduğunu varsaymayız.',
      'Müzik, drama, seramik, satranç ve robotik kodlama gibi branş derslerimiz sözel-dilsel, mantıksal-matematiksel, görsel-uzamsal, bedensel-kinestetik, müziksel, sosyal ve içsel zeka alanlarının her birine haftalık olarak temas eder.',
      'Bir çocuk satrançta güçlüyken bir başkası dramada parlayabilir; programımız ikisine de eşit görünürlük verir.',
    ],
  },
  {
    question: 'Oyun temelli öğrenme neden akademik hazırlıktan önce gelir?',
    answer: [
      'Oyun temelli öğrenme akademik hazırlıktan önce gelir çünkü 2-6 yaş arasında dil, motor ve sosyal-duygusal gelişimin büyük kısmı oyun yoluyla gerçekleşir — masa başı çalışma bu gelişimin yerini tutamaz.',
      '2-3 yaş oyun grubunda duyusal ve serbest oyun ağırlıktayken, 4-5 ve 5-6 yaşta oyun; bilim, matematik ve okuma yazmaya hazırlık çalışmalarıyla iç içe geçer. Akademik beceriler oyunun yerine değil, oyunun üzerine inşa edilir.',
      'Bu sıralama bir tercih değil, çocuk gelişimi literatürünün gerekliliğidir.',
    ],
  },
  {
    question: 'Çocuklar mezun olduğunda İngilizce konuşabiliyor mu?',
    answer: [
      'Evet — çocuklarımız mezun olduğunda İngilizce konuşuyor.',
      'Bunu haftada birkaç saatlik ders ile değil, native İngilizce öğretmenimizin günün doğal ve sürekli bir parçası olmasıyla sağlıyoruz. Çocuk İngilizceyi bir ders olarak değil, günlük iletişimin bir parçası olarak edinir; bu da 2-3 yaştan 5-6 yaşa kadar süren dört yıllık bir süreçte kalıcı akıcılık kazandırır.',
    ],
  },
];

export default function EgitimYaklasimimizPage() {
  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Ana Sayfa', path: '/' },
          { name: 'Eğitim Yaklaşımımız', path: '/egitim-yaklasimimiz' },
        ])}
      />
      <JsonLd data={buildFaqSchema(FAQ_SUBSET)} />

      <section className="bg-ink py-20 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-paper/70">
          Montessori · High Scope · Çoklu Zeka
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl px-6 font-display text-4xl text-white md:text-5xl">
          Eğitim Yaklaşımımız
        </h1>
        <p className="mx-auto mt-6 max-w-2xl px-6 text-paper">
          Beykent Büyükçekmece&apos;de 2-6 yaş arası çocuklar için Montessori, High Scope ve
          Çoklu Zeka kuramlarını temel alan, oyun temelli bir program uyguluyoruz.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="space-y-16">
          {SECTIONS.map((section) => (
            <div key={section.question}>
              <h2 className="font-display text-2xl text-ink md:text-3xl">
                {section.question}
              </h2>
              <div className="mt-5 space-y-4 text-ink-soft">
                {section.answer.map((paragraph, index) => (
                  <p key={index} className={index === 0 ? 'text-lg text-ink' : undefined}>
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-paper py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center font-display text-3xl text-ink">
            Yaş grubuna göre program
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: '2-3 yaş', name: 'Oyun Grubu' },
              { label: '3-4 yaş', name: 'Anaokulu' },
              { label: '4-5 yaş', name: 'Anaokulu' },
              { label: '5-6 yaş', name: 'İlkokula Hazırlık' },
            ].map((group) => (
              <div key={group.label} className="rounded-xl bg-white p-6 text-center">
                <p className="font-display text-xl text-ink">{group.label}</p>
                <p className="mt-2 text-sm text-ink-soft">{group.name}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-ink-soft">
            {SITE.foundingYear}&apos;den beri, {new Date().getFullYear() - SITE.foundingYear} yıldır
            aynı yaklaşımla {SITE.areaServed.slice(0, 3).join(', ')} ve çevresindeki ailelere
            hizmet veriyoruz.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-6 py-16">
        <h2 className="text-center font-display text-3xl text-ink">
          Programı yerinde görmek ister misiniz?
        </h2>
        <p className="mt-4 text-center text-ink-soft">
          Sınıflarımızı ziyaret edip öğretmenlerimizle tanışmak için ön görüşme randevusu alın.
        </p>
        <div className="mt-10">
          <LeadForm variant="compact" />
        </div>
      </section>
    </div>
  );
}
