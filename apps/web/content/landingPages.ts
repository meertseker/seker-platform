import type { MediaKey } from './media';
import { ROSTER_STATUS, ENGLISH_COVERAGE_READY, ENGLISH_HOURS_PER_DAY } from './day';
import { MONTESSORI_DAYS_PER_WEEK } from './program';
import { SITE } from '@/lib/site';

export type LandingPage = {
  slug: string;
  /** Bu LP'yi hedefleyen reklam kampanyası/grubu. */
  campaign: string;
  metaTitle: string;
  metaDescription: string;
  /** Reklamın sabitlenmiş birinci başlığıyla anlamca birebir örtüşür. */
  h1: string;
  subhead: string;
  mediaKey: MediaKey;
  proofPoints: { value: string; label: string }[];
  bodyBlocks: { heading: string; text: string }[];
  faq: { question: string; answer: string }[];
  formHeading: string;
  formIntro: string;
};

/**
 * Rakamların tek kaynağı content/day.ts'deki ROSTER_STATUS'tür; burada
 * ikinci bir sayı yazılmaz. Okul yönetimi sınıf mevcudunu ve günlük
 * İngilizce süresini 1 Ağustos 2026'da doğruladı.
 */
const CHILDREN_PER_TEACHER = Math.round(ROSTER_STATUS.childCount / ROSTER_STATUS.teacherCount);

const AGE_RANGE_POINT = { value: '2-6', label: 'Yaş aralığı' };
const HOURS_POINT = { value: `${SITE.hours.opens}–${SITE.hours.closes}`, label: 'Günlük çalışma saatleri' };
const YEARS_ACTIVE_POINT = { value: '{yilSayisi} yıl', label: "Beykent'te aynı adreste" };

function rosterProof(): { value: string; label: string }[] {
  return [
    { value: String(ROSTER_STATUS.childCount), label: 'Sınıf mevcudu' },
    { value: `1 : ${CHILDREN_PER_TEACHER}`, label: 'Öğretmen başına çocuk' },
  ];
}

/** Gövde metninde sınıf mevcudunu anlatan tek cümle. */
function rosterSentence(): string {
  return `Sınıflarımızda ${ROSTER_STATUS.childCount} çocuk ve ${ROSTER_STATUS.teacherCount} öğretmen bulunur — öğretmen başına ${CHILDREN_PER_TEACHER} çocuk düşer.`;
}

/**
 * İngilizce cümlesi. Öğretmenin anadili ve "mezun olduğunda konuşuyor"
 * türü çıktı iddiaları reklam sayfalarında kullanılmaz; yalnızca günlük
 * süre yazılır (asset dosyası §5.2).
 */
function englishSentence(): string {
  const base =
    'İngilizce bizde ayrı bir ders saati değil; oyunun, sofranın ve geçişlerin içinde kullanılan ikinci dil.';
  return ENGLISH_COVERAGE_READY
    ? `${base} Çocuğunuz her gün ${ENGLISH_HOURS_PER_DAY} saatini İngilizce öğretmeniyle geçirir.`
    : base;
}

const FAQ_AGES = {
  question: 'Hangi yaş gruplarını kabul ediyorsunuz?',
  answer: 'İki yaşından beş yaşının sonuna kadar dört grubumuz var: 2-3, 3-4, 4-5 ve 5-6 yaş.',
};

const FAQ_PRICE = {
  question: 'Ücret bilgisini nasıl alabilirim?',
  answer:
    'Ücreti ön görüşmede yazılı olarak paylaşıyoruz; programa, gün sayısına ve servis ihtiyacına göre değiştiği için sitede tek bir rakam yayımlamıyoruz.',
};

const FAQ_VISIT = {
  question: 'Okulu gezebilir miyim?',
  answer: 'Evet. Ön görüşme randevunuzda ders saatinde gelip sınıfı görebilirsiniz; kayıt zorunluluğu yoktur.',
};

const FORM_INTRO_STANDARD = 'Size uygun bir saat seçin. Kayıt zorunluluğu yok.';

export const LANDING_PAGES: LandingPage[] = [
  {
    slug: 'beykent-anaokulu',
    campaign: 'K2-A',
    metaTitle: 'Beykent Anaokulu | Özel Şeker Anaokulu',
    metaDescription: `Beykent Cumhuriyet Mahallesi'nde okul öncesi eğitim. Sınıfta ${ROSTER_STATUS.childCount} çocuk, ${ROSTER_STATUS.teacherCount} öğretmen. ${SITE.foundingYear}'den beri aynı adreste; ön görüşmede gelip gezin.`,
    h1: '🌟 Çocuğunuz İçin Beykent’in Merkezinde, Güvenle Büyüyeceği Bir Gelecek! 🌟',
    subhead:
      'Beylikdüzü ve Büyükçekmece bölgesinin en sevilen anaokulunda; uzman kadromuz, güvenli ortamımız ve çocukların potansiyelini keşfeden eğitim modelimizle tanışın! 🎨📚✨\n\n🚌 Evinizden Okula, Güvenli Ulaşım!\nServis planlamasını, ön görüşmemizde birlikte planlıyoruz.\n\nSiz de ailemize katılmak ve okulumuzu yerinde ziyaret etmek için hemen bizimle iletişime geçin!',
    mediaKey: 'gardenWide',
    proofPoints: [...rosterProof(), AGE_RANGE_POINT, HOURS_POINT],
    bodyBlocks: [
      {
        heading: '{yilSayisi} yıldır aynı sokakta',
        text: `Cumhuriyet Mahallesi Uludağ Sokak'ta ${SITE.foundingYear}'den beri buradayız. Süreklilik, okul öncesinde en zor taklit edilen özelliktir.`,
      },
      {
        heading: 'Neden sınıf mevcudunu bu kadar önemsiyoruz',
        text: `Bir öğretmenin gün içinde kaç kez çocuğunuza sıra ayırabileceğini belirleyen şey, o sınıfta kaç çocuk olduğudur. ${rosterSentence()}`,
      },
      {
        heading: 'Branş dersleri programın parçası',
        text: `${englishSentence()} Seramik, müzik, drama, bale, satranç ve robotik kodlama derslerinin her biri alanında uzman bir öğretmenle yürür; bir çocuk çamurla açılır, bir başkası satrançla.`,
      },
    ],
    faq: [
      FAQ_AGES,
      {
        question: 'Sınıf mevcudunuz kaç?',
        answer: rosterSentence(),
      },
      FAQ_PRICE,
      FAQ_VISIT,
    ],
    formHeading: 'Okulu gezin, sonra karar verin',
    formIntro: FORM_INTRO_STANDARD,
  },
  {
    slug: 'beylikduzu-anaokulu',
    campaign: 'K2-C',
    metaTitle: "Beylikdüzü'ne Yakın Anaokulu | Özel Şeker Anaokulu",
    metaDescription:
      "Beykent'te, Beylikdüzü'ne yakın bir anaokulu. Hizmet bölgemiz Beylikdüzü'nü kapsar; servis ihtiyacınızı ön görüşmede birlikte planlıyoruz.",
    h1: '🌟 Çocuğunuz İçin Beykent’in Merkezinde, Güvenle Büyüyeceği Bir Gelecek! 🌟',
    subhead:
      'Beylikdüzü ve Büyükçekmece bölgesinin en sevilen anaokulunda; uzman kadromuz, güvenli ortamımız ve çocukların potansiyelini keşfeden eğitim modelimizle tanışın! 🎨📚✨\n\n🚌 Evinizden Okula, Güvenli Ulaşım!\nGeniş servis ağımız Beylikdüzü ve Büyükçekmece’nin tüm mahallelerini kapsamaktadır. Çocuğunuzun konforu ve güvenliği için servis güzergâhı ile saatlerini adresinize özel olarak, ön görüşmemizde birlikte planlıyoruz.\n\nSiz de ailemize katılmak ve okulumuzu yerinde ziyaret etmek için hemen bizimle iletişime geçin!',
    mediaKey: 'gardenWorkshops',
    proofPoints: [...rosterProof(), AGE_RANGE_POINT, { value: String(SITE.areaServed.length), label: 'Hizmet verdiğimiz bölge sayısı' }],
    bodyBlocks: [
      {
        heading: 'Neden mahalledeki okul değil',
        text: `Okul öncesinde belirleyici olan mesafe değil, öğretmen başına düşen çocuk sayısıdır. ${rosterSentence()}`,
      },
      {
        heading: 'Servis ihtiyacınızı birlikte planlıyoruz',
        text: "Güzergâh ve saatler kayıtlı ailelerin adreslerine göre şekillenir; bu yüzden siteye tek bir hat yazmak yerine, adresinizin uygunluğunu ön görüşmede birlikte değerlendiriyoruz.",
      },
      {
        heading: `Haftanın ${MONTESSORI_DAYS_PER_WEEK} günü Montessori`,
        text: `Montessori çalışması bizde ayrı bir etkinlik saati değil, haftanın ${MONTESSORI_DAYS_PER_WEEK} günü günün omurgasıdır. Materyaller açık raflarda, çocuğun boyunda durur; öğretmen araya girmez, gözlemler. Bu yaklaşımın işlemesi sınıf mevcudunun sınırlı tutulmasına bağlıdır.`,
      },
    ],
    faq: [
      {
        question: "Beylikdüzü'nden servis var mı?",
        answer:
          'Hizmet bölgemiz Beylikdüzü\'nü kapsar. Servis ihtiyacınız varsa güzergâhı ve saatleri adresinize göre ön görüşmede birlikte planlıyoruz.',
      },
      {
        question: 'Yol ne kadar sürüyor?',
        answer: "Beykent, Beylikdüzü'ye komşu bir bölge. Kesin süre adresinize göre değişir; ön görüşmede birlikte bakabiliriz.",
      },
      FAQ_AGES,
      FAQ_PRICE,
    ],
    formHeading: 'Bir kere gelin, farkı görün',
    formIntro: FORM_INTRO_STANDARD,
  },
  {
    slug: 'az-mevcutlu-anaokulu',
    campaign: 'K4-A',
    metaTitle: 'Az Mevcutlu Anaokulu — Sınıfta 13 Çocuk | Özel Şeker Anaokulu',
    metaDescription: `Sınıfımızda ${ROSTER_STATUS.childCount} çocuk ve ${ROSTER_STATUS.teacherCount} öğretmen var; öğretmen başına ${CHILDREN_PER_TEACHER} çocuk düşüyor. Yönetmelik ${ROSTER_STATUS.limit} çocuğa kadar izin veriyor. Beykent Büyükçekmece.`,
    h1: 'Bir çocuğun okulda en çok neye ihtiyacı vardır? Kaliteli ve Birebir İlgiye!',
    subhead:
      'Peki bunu nasıl başarıyoruz?\nSınıf içinde çift öğretmenli destek sistemi\nHer çocuğun potansiyeline odaklanan butik yaklaşım\n\nÇocuklarınızın her anını yakından takip eden, yeteneklerini keşfeden uzman kadromuzla tanışın.\n\nGelin, Kendiniz Görün: Ön görüşmede sınıflarımızı ziyaret edebilirsiniz. Kontenjanlarımız dolmadan yerinizi ayırtın!',
    mediaKey: 'gardenWide',
    proofPoints: [...rosterProof(), AGE_RANGE_POINT, { value: 'Ders saatinde', label: 'Sınıfı ziyaret zamanı' }],
    bodyBlocks: [
      {
        heading: 'Rakamın pratikte anlamı',
        text: `${rosterSentence()} İkinci öğretmenin olması şu demek: bir çocuk ağladığında ya da tuvalete götürülmesi gerektiğinde sınıfın geri kalanı boşta kalmıyor.`,
      },
      {
        heading: 'Çekingen çocuk için belirleyici',
        text: 'Kalabalık bir sınıfta konuşmayan çocuk sorun çıkarmadığı için en son fark edilendir. Bu mevcutta öğretmen, gün içinde kimin söz almadığını görebiliyor.',
      },
      {
        heading: 'Gelip kendiniz sayın',
        text: 'En ikna edici kanıt bir web sitesi rakamı değil, gözünüzle gördüğünüzdür. Ön görüşme randevunuzda ders saatinde gelin, sınıfa girin, çocukları ve öğretmenleri sayın.',
      },
    ],
    faq: [
      {
        question: 'Sınıfınızda kaç çocuk var?',
        answer: rosterSentence(),
      },
      {
        question: 'MEB yönetmeliği kaç çocuğa izin veriyor?',
        answer: `Okul öncesi yönetmeliği öğretmen başına ${ROSTER_STATUS.limit} çocuğa kadar izin veriyor. Bizde öğretmen başına ${CHILDREN_PER_TEACHER} çocuk düşüyor.`,
      },
      FAQ_AGES,
      FAQ_VISIT,
    ],
    formHeading: 'Sınıfı kendiniz görün',
    formIntro: FORM_INTRO_STANDARD,
  },
  {
    slug: 'kres-2-yas',
    campaign: 'K9',
    metaTitle: 'Beykent Kreş ve 2-3 Yaş Grubu | Özel Şeker Anaokulu',
    metaDescription:
      'İki yaşından itibaren kabul. Kreş değil anaokulu: güvenli bağlanma, kademeli uyum ve Montessori temelli program. Beykent Büyükçekmece.',
    h1: '2 Yaş İçin Doğru Başlangıç: Önce Güven, Sonra Keşif!',
    subhead:
      'Çocukların aileden ilk kez ayrıldığı 2 yaş döneminde en büyük ihtiyaç akademiden önce güvenli bağlanmadır. Anaokulumuzda miniklerimizi zorlamadan, kendi doğal tempolarında, şefkatli bir uyum süreciyle geleceğe hazırlıyoruz.\n\n✨ Kreş değil; sevgi, güven ve pedagojik altyapıyla tasarlanmış bir Anaokulu.\n\n📲 Okulumuzu ve Oryantasyon Modelimizi Keşfetmek İçin Ziyaret Edin.',
    mediaKey: 'giraffesGarden',
    proofPoints: [...rosterProof(), { value: '2', label: 'Başlangıç yaşı' }, HOURS_POINT],
    bodyBlocks: [
      {
        heading: 'Uyum, çocuğun temposunda',
        text: 'Uyum sürecinde önceliğimiz, ayrılığın çocuğunuz hazır olduğunda gerçekleşmesidir. Bu süreci sizinle birlikte nasıl yürüteceğimizi ön görüşmede ayrıntılı anlatıyoruz.',
      },
      {
        heading: 'Bakım değil, program',
        text: `İki yaş grubunda da Montessori materyalleriyle çalışılır: duyusal oyun, günlük yaşam becerileri ve tuvalet eğitimi desteği günün parçasıdır. ${englishSentence()}`,
      },
      {
        heading: 'Aileyle birlikte bir plan',
        text: 'Uyku düzeni, tuvalet eğitimi ve kardeş kıskançlığı gibi başlıklarda okul içinde rehberlik desteği alırsınız; evde ve okulda tutarlı bir yaklaşım için birlikte çalışırız.',
      },
    ],
    faq: [
      {
        question: 'İki yaş çok erken değil mi?',
        answer:
          'Erken olup olmadığı çocuğa göre değişir. Ön görüşmede çocuğunuzun hazır olup olmadığını birlikte değerlendiriyoruz; hazır değilse bunu açıkça söylüyoruz.',
      },
      {
        question: 'Tuvalet eğitimi tamamlanmamış olabilir mi?',
        answer: 'Olabilir. İki yaş grubunda tuvalet eğitimi desteği programın parçasıdır ve aileyle ortak bir planla yürütülür.',
      },
      {
        question: 'Uyum süreci nasıl işliyor?',
        answer: 'Süreci aileyle birlikte, çocuğunuzun temposuna göre planlıyoruz. Ayrıntıları ön görüşmede anlatıyoruz.',
      },
      FAQ_PRICE,
    ],
    formHeading: 'Grubu ve öğretmenleri görün',
    formIntro: FORM_INTRO_STANDARD,
  },
  {
    slug: 'anaokulu-ucret',
    campaign: 'K7',
    metaTitle: 'Anaokulu Ücreti — Ön Görüşmede Paylaşıyoruz | Özel Şeker Anaokulu',
    metaDescription:
      'Ücreti belirleyen unsurlar: sınıf modeli, program genişliği, servis ve ödeme planı. Net rakamı ön görüşmede yazılı paylaşıyoruz.',
    h1: '"Eğitimde Kalite Doğru Yatırımla Başlar."',
    subhead:
      'Geleceğinize yaptığınız yatırımın kapsamı, yüzeysel bir fiyat listesine sığmayacak kadar değerlidir. Neye, nasıl bir yatırım yapacağınızı tüm detaylarıyla görmek ve kurumumuza özel avantajlı kayıt koşullarını öğrenmek için ön görüşme randevunuzu hemen oluşturun.\n\nEğitimde Kaliteli Deneyim\nDonanımlı fiziki ortamımızda sunduğumuz nitelikli eğitim anlayışımız, sabit bir rakamın ötesindedir. Sizler için net bütçe planlamasını, kurumumuzu ve eğitim alanlarımızı yakından inceleyeceğiniz ön görüşmemizde paylaşıyoruz.',
    mediaKey: 'mudKitchen',
    proofPoints: [...rosterProof(), AGE_RANGE_POINT, { value: '2026-2027', label: 'Eğitim yılı' }],
    bodyBlocks: [
      {
        heading: 'Bir — sınıf modeli',
        text: `Öğretmen başına düşen çocuk sayısını düşük tutmak yapısal olarak daha maliyetlidir. ${rosterSentence()} Ücretimizin en büyük bileşeni budur.`,
      },
      {
        heading: 'İki — program genişliği',
        text: `Tam gün, yarım gün ve yaz dönemi farklı fiyatlanır. Seramik, müzik, drama, bale, satranç ve robotik kodlama gibi branş dersleri ile okulumuzda görev yapan uzman psikoloğun desteği programa dahildir. ${englishSentence()}`,
      },
      {
        heading: 'Üç — servis ve ödeme planı',
        text: 'Servis ihtiyacınız varsa adresinize göre ayrıca hesaplanır. Ödeme planı, ailenizin ihtiyacına göre ön görüşmede birlikte belirlenir.',
      },
    ],
    faq: [
      {
        question: 'Neden rakamı sitede yazmıyorsunuz?',
        answer:
          'Ücret programa, gün sayısına ve servis ihtiyacına göre değiştiği için tek bir rakam yanıltıcı olur. Ön görüşmede size özel bir hesap paylaşıyoruz.',
      },
      {
        question: 'Ücrete neler dahil?',
        answer:
          'Branş dersleri, günlük İngilizce ve rehberlik desteği programa dahildir; servis ayrıca hesaplanır. Hangi kalemin dahil olduğunu ön görüşmede kalem kalem yazılı paylaşıyoruz.',
      },
      {
        question: 'Ödeme planı seçebiliyor muyum?',
        answer: 'Ödeme planı, ailenizin ihtiyacına göre ön görüşmede sizinle birlikte belirlenir.',
      },
      {
        question: 'Ücret ne zaman netleşiyor?',
        answer: 'Ön görüşmede çocuğunuzun yaş grubuna göre net ücreti yazılı paylaşıyoruz.',
      },
    ],
    formHeading: 'Size özel hesabı konuşalım',
    formIntro: FORM_INTRO_STANDARD,
  },
];

export const LANDING_SLUGS = LANDING_PAGES.map((page) => page.slug);

export function getLandingPage(slug: string): LandingPage | undefined {
  return LANDING_PAGES.find((page) => page.slug === slug);
}
