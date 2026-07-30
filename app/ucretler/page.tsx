import Header from '@/app/components/Header';
import JsonLd from '@/app/components/JsonLd';
import LeadForm from '@/app/components/LeadForm';
import { buildMetadata } from '@/lib/metadata';
import { buildFaqSchema } from '@/lib/schema';
import { SITE } from '@/lib/site';
import { FAQ_ITEMS } from '@/content/faq';

export const metadata = buildMetadata({
  title: 'Ücretler ve Ödeme',
  description:
    'Özel Şeker Anaokulu 2026-2027 ücretlendirmesi. 10 kişilik sınıflar, iki öğretmen ve native İngilizce öğretmeni. Ücret ve ödeme planı için ön görüşme randevusu alın.',
  path: '/ucretler',
});

// TODO(okul yönetimi): dahil/hariç listesini doğrulayın. Ücret RAKAMI eklenmez.
const INCLUDED = [
  'Tam gün eğitim programı (07:15 – 19:15)',
  'Native öğretmenle günlük İngilizce',
  'Tüm branş dersleri: müzik, drama, seramik, satranç, robotik kodlama',
  'Rehberlik ve psikolojik danışmanlık desteği',
  'Eğitim materyalleri ve kırtasiye',
  'Dönemlik gelişim raporu ve veli görüşmeleri',
];

const EXCLUDED = [
  'Servis hizmeti (güzergâha göre ayrıca fiyatlanır)',
  'Okul kıyafeti',
  'İsteğe bağlı ekstra atölyeler (binicilik, yüzme)',
];

const FAQ_SUBSET = FAQ_ITEMS.filter((item) =>
  ['sinif-mevcudu', 'servis', 'yemek'].includes(item.id),
);

export default function UcretlerPage() {
  return (
    <div className="min-h-screen bg-ivory">
      <Header />
      <JsonLd data={buildFaqSchema(FAQ_SUBSET)} />

      <section className="bg-navy-900 py-20 text-center">
        <h1 className="px-6 font-display text-4xl text-white md:text-5xl">
          Ücretimiz ve neye karşılık geldiği
        </h1>
        <p className="mx-auto mt-6 max-w-2xl px-6 text-navy-100">
          Ücretimizi web sitesinde yayımlamıyoruz — çünkü bir rakam, tek başına
          neyi kapsadığını anlatmıyor. Okulu gezmeden ve sınıfı görmeden verilen
          bir fiyat, doğru karar vermenize yardımcı olmaz.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="rounded-2xl border border-navy-100 bg-cream p-10 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-navy-600">
            2026-2027 eğitim yılı
          </p>
          <p className="mt-5 font-display text-3xl leading-snug text-navy-900">
            Bölgemizin üst segmentinde konumlanıyoruz.
          </p>
          <p className="mx-auto mt-5 max-w-xl text-navy-700">
            10 kişilik sınıflar, her sınıfta iki öğretmen ve native İngilizce
            öğretmeni bir arada, ancak belirli bir maliyetle mümkün. Bunu saklamak
            yerine, neyin karşılığı olduğunu anlatmayı tercih ediyoruz.
          </p>
          <p className="mt-6 text-sm text-navy-600">
            Ücret, ödeme planı, kardeş ve peşin ödeme koşulları ön görüşmede
            size özel olarak paylaşılır.
          </p>
        </div>
      </section>

      <section className="bg-cream py-16">
        <div className="mx-auto grid max-w-4xl gap-12 px-6 md:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl text-navy-900">Ücrete dahil</h2>
            <ul className="mt-6 space-y-3">
              {INCLUDED.map((item) => (
                <li key={item} className="flex gap-3 text-navy-700">
                  <span className="text-gold-500">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-2xl text-navy-900">Ayrıca fiyatlanır</h2>
            <ul className="mt-6 space-y-3">
              {EXCLUDED.map((item) => (
                <li key={item} className="flex gap-3 text-navy-600">
                  <span className="text-navy-300">—</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="font-display text-3xl text-navy-900">Ücretimizi ne belirliyor?</h2>
        <div className="mt-8 space-y-6 text-navy-700">
          <p>
            <strong>Sınıflarımızda 10 çocuk bulunur ve her sınıfta iki öğretmen görev
            yapar</strong> — öğretmen başına beş çocuk. Millî Eğitim Bakanlığı
            yönetmeliği bu yaş grubunda öğretmen başına 20 çocuğa kadar izin veriyor.
            Biz bu üst sınırın dörtte biriyle çalışıyoruz. Ücretimizin tek en büyük
            bileşeni budur.
          </p>
          <p>
            <strong>Çocuklarımız mezun olduğunda İngilizce konuşuyor.</strong> Bunu
            haftada birkaç saatlik ders ile değil, native İngilizce öğretmenimizin
            günün doğal parçası olmasıyla sağlıyoruz.
          </p>
          <p>
            {new Date().getFullYear() - SITE.foundingYear} yıldır aynı adreste, aynı kadro
            anlayışıyla çalışıyoruz. Çocuğunuz yıl ortasında öğretmen değiştirmez.
          </p>
        </div>
      </section>

      <section className="bg-cream py-16">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-center font-display text-3xl text-navy-900">
            Size özel ödeme planı için görüşelim
          </h2>
          <div className="mt-10">
            <LeadForm variant="full" />
          </div>
        </div>
      </section>
    </div>
  );
}
