import Link from 'next/link';
import PageHero from '@/app/components/PageHero';
import JsonLd from '@/app/components/JsonLd';
import LeadForm from '@/app/components/LeadForm';
import { buildMetadata } from '@/lib/metadata';
import { buildBreadcrumbSchema, buildFaqSchema } from '@/lib/schema';
import { SITE } from '@/lib/site';
import { currentYear } from '@/lib/time';
import { PUBLISHED_FAQ } from '@/content/faq';
import { ROSTER_STATUS, ENGLISH_HOURS_PER_DAY } from '@/content/day';
import {
  ENGLISH_TRACKS,
  FULL_DAY_LABEL,
  HALF_DAY_LABEL,
  MONTESSORI_DAYS_PER_WEEK,
  SUPPORT,
  YEAR_ROUND_BRANCHES,
} from '@/content/program';

export const metadata = buildMetadata({
  title: 'Eğitim Yaklaşımımız',
  description: `Haftanın ${MONTESSORI_DAYS_PER_WEEK} günü Montessori, alanında uzman öğretmenlerle branş dersleri ve her gün İngilizce. Beykent Büyükçekmece'de 2-6 yaş okul öncesi eğitim.`,
  path: '/egitim-yaklasimimiz',
});

const FAQ_SUBSET = PUBLISHED_FAQ.filter((item) =>
  ['egitim-programi', 'ingilizce', 'yas-araligi', 'sinif-mevcudu'].includes(item.id),
);

/** Bölüm kartlarının şerit renkleri — sitenin aksan sırası. */
const SECTION_STRIPES = ['bg-grape', 'bg-bubble', 'bg-sunny', 'bg-mint', 'bg-sky'];

const BRANCH_NAMES = YEAR_ROUND_BRANCHES.map((branch) => branch.name).join(', ');

const SECTIONS = [
  {
    question: `Montessori yaklaşımını nasıl uyguluyoruz?`,
    answer: [
      `Montessori eğitimi okulumuzda haftanın ${MONTESSORI_DAYS_PER_WEEK} günü uygulanıyor. Ayrı bir etkinlik saati değil; günün omurgası bu.`,
      'Materyaller çocuğun boyundaki açık raflarda duruyor. Çocuk günlük yaşam, duyusal çalışmalar, dil, matematik, dikkat ve konsantrasyon alanlarında özel olarak hazırlanmış materyallerle çalışıyor. Bir işi seçmek, bitirmek ve yerine kaldırmak onun sorumluluğunda.',
      `Sınıflarımızda ${ROSTER_STATUS.childCount} çocuk ve iki öğretmen bulunuyor. Bu yaklaşımın gerçekten işlemesi buna bağlı: öğretmenin her çocuğun neyle ne kadar çalıştığını gözlemleyebilmesi gerekiyor. Kalabalık bir sınıfta Montessori sözde kalır.`,
      'Bu çalışmalarla özgüven, sorumluluk, el-göz koordinasyonu, problem çözme ve odaklanma becerilerinin gelişimini destekliyoruz.',
    ],
  },
  {
    question: 'Çocuk günü kendisi planlayabiliyor mu?',
    answer: [
      'Evet. Gün, sabah çemberinde birlikte planlanır: kim ne çalışacak, hangi branş dersi var, bahçeye ne zaman çıkılacak.',
      'High Scope programının "planla-yap-değerlendir" döngüsünü bu noktada kullanıyoruz. Çocuk günün başında ne yapacağını seçiyor, seçtiği işi gerçekleştiriyor ve gün sonunda öğretmeniyle birlikte değerlendiriyor. Yaş büyüdükçe planlama süresi ve karmaşıklığı artıyor.',
      'Sonuç, yönergeyle değil kendi kararıyla harekete geçen bir çocuk. İlkokula geçişte en çok işe yarayan alışkanlıklardan biri bu.',
    ],
  },
  {
    question: 'Branş dersleri programın neresinde duruyor?',
    answer: [
      'Branş dersleri eğlence molası değil, programın parçası. Her biri alanında uzman bir öğretmen tarafından yürütülüyor.',
      `Programımızda şu çalışmalar yer alıyor: ${BRANCH_NAMES}.`,
      'Bu genişliği bilerek koruyoruz. Bir çocuk satrançta açılırken bir başkası seramikte ya da dramada parlıyor; hangi çocuğun neyle açılacağını önceden bilemiyorsunuz. Programımız her birine eşit görünürlük veriyor.',
      'Bu çalışmalarla yaratıcılık, özgüven, iletişim, sosyal beceri, problem çözme, motor gelişim ve kendini ifade etme becerilerini destekliyoruz.',
    ],
  },
  {
    question: 'Yabancı dil eğitimi nasıl işliyor?',
    answer: [
      `Çocukların erken yaşta yabancı dil ile tanışmasını önemsiyoruz. Çocuğunuz her gün ${ENGLISH_HOURS_PER_DAY} saatini İngilizce öğretmeniyle geçiriyor — haftada birkaç ders değil, her gün aynı saatte.`,
      'İngilizce çalışmaları oyun, şarkı, hikâye, etkinlik ve günlük iletişimin içinden yürüyor. Çocuk önce anlıyor, sonra tek kelimelerle karşılık veriyor, en sonunda cümle kuruyor. Aceleye getirmiyoruz.',
      'İngilizcenin yanında Almanca çalışmalarına da yer veriyoruz.',
    ],
  },
  {
    question: 'Teknoloji eğitim sürecine nasıl giriyor?',
    answer: [
      SUPPORT.smartBoard,
      'Teknolojiyi yaş grubuna uygun ölçüde ve öğretmenin yönlendirmesiyle kullanıyoruz. Robotik & Kodlama dersinde çocuklar manyetik lego setleri ve tabletlerle kendi robotlarını kuruyor, sonra hareketlerini kodluyor.',
      'Amacımız ekran süresi eklemek değil; çocuğun neden-sonuç ilişkisi kurmasını, planlama yapmasını ve çözüm üretmesini desteklemek.',
    ],
  },
  {
    question: 'Sosyal ve duygusal gelişimi kim takip ediyor?',
    answer: [
      SUPPORT.psychologist,
      'Uyum dönemi, kardeş kıskançlığı, tuvalet eğitimi ya da uyku düzeni gibi başlıklarda evde ve okulda tutarlı bir yaklaşım kurmak için sizinle birlikte çalışıyoruz.',
      'Sevgi, güven ve aidiyet duygusunu merkeze alan bir okul ortamı kurmaya çalışıyoruz. Çocuğun kendini burada değerli hissetmesi, öğrenmenin ön koşulu.',
    ],
  },
];

export default async function EgitimYaklasimimizPage() {
  const yearsActive = (await currentYear()) - SITE.foundingYear;
  return (
    <div className="min-h-screen bg-paper">
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Ana Sayfa', path: '/' },
          { name: 'Eğitim Yaklaşımımız', path: '/egitim-yaklasimimiz' },
        ])}
      />
      <JsonLd data={buildFaqSchema(FAQ_SUBSET)} />

      <PageHero
        eyebrow={`Montessori · Branş dersleri · ${ENGLISH_HOURS_PER_DAY} saat İngilizce`}
        title="Eğitim Yaklaşımımız"
        lead="Çocukların bireysel farklılıklarını ve ilgi alanlarını dikkate alan bir eğitim yaklaşımı benimsiyoruz. Programımız; zihinsel, sosyal, duygusal, fiziksel ve sanatsal gelişimi bir bütün olarak destekleyecek şekilde planlanıyor."
        tone="grape"
      />

      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="space-y-8">
          {SECTIONS.map((section, sectionIndex) => (
            <div
              key={section.question}
              className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-rule"
            >
              <div className={`h-1.5 ${SECTION_STRIPES[sectionIndex % SECTION_STRIPES.length]}`} />
              <div className="p-8 md:p-10">
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
            </div>
          ))}
        </div>
      </section>

      {/* İngilizce programının içindeki üç ayrı çalışma. */}
      <section className="bg-paper-warm py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center font-display text-3xl text-ink">
            İngilizce günün içinde nasıl görünüyor?
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {ENGLISH_TRACKS.map((track) => (
              <div key={track.name} className="card-lift rounded-3xl bg-white p-6 shadow-sm">
                <h3 className="font-display text-xl text-ink">{track.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{track.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="text-center font-display text-3xl text-ink">
          Yaş grubuna göre program
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: '2-3 yaş', name: 'Oyun Grubu', accent: 'text-bubble-deep', href: '/yas-gruplari/2-3-yas' },
            { label: '3-4 yaş', name: 'Anaokulu', accent: 'text-sunny-deep', href: '/yas-gruplari/3-4-yas' },
            { label: '4-5 yaş', name: 'Anaokulu', accent: 'text-mint-deep', href: '/yas-gruplari/4-5-yas' },
            { label: '5-6 yaş', name: 'İlkokula Hazırlık', accent: 'text-sky-deep', href: '/yas-gruplari/5-6-yas' },
          ].map((group) => (
            <Link key={group.label} href={group.href} className="card-lift rounded-3xl bg-white p-6 text-center shadow-sm">
              <p className={`font-display text-2xl ${group.accent}`}>{group.label}</p>
              <p className="mt-2 text-sm text-ink-soft">{group.name}</p>
            </Link>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-ink-soft">
          Tam gün {FULL_DAY_LABEL}, yarım gün {HALF_DAY_LABEL}. {SITE.foundingYear}
          &apos;den beri, {yearsActive} yıldır aynı
          yaklaşımla {SITE.areaServed.slice(0, 3).join(', ')} ve çevresindeki ailelere
          hizmet veriyoruz.
        </p>
      </section>

      <section className="mx-auto max-w-2xl px-6 pb-16">
        <h2 className="text-center font-display text-3xl text-ink">
          Programı yerinde görmek ister misiniz?
        </h2>
        <p className="mt-4 text-center text-ink-soft">
          Ders saatinde gelin; sınıfları gezip öğretmenlerimizle tanışın.
        </p>
        <div className="mt-10 rounded-3xl bg-white p-6 shadow-lg shadow-ink/5 ring-1 ring-rule md:p-8">
          <LeadForm />
        </div>
      </section>
    </div>
  );
}
