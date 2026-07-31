import type { MediaKey } from './media';
import { ROSTER_STATUS, ENGLISH_COVERAGE_READY } from './day';
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
 * Doğrulama kuyruğu #1, #2 (asset dosyası §0.2) — sınıf mevcudu ve öğretmen
 * sayısı okul tarafından henüz doğrulanmadı. Tek kaynak content/day.ts'deki
 * ROSTER_STATUS'tür; burada ikinci bir kapı icat edilmez (aynı desen:
 * app/components/TrustBar.tsx, app/components/HeroSection.tsx). Kuruluş
 * yılı (⚠️ madde #4) ise SITE.foundingYear üzerinden sitede zaten ungated
 * kullanılıyor (bkz. lib/site.ts, HeroSection, TrustBar) — burada da aynı
 * ölçüde güvenli kabul edilir.
 */
const YEARS_ACTIVE = new Date().getFullYear() - SITE.foundingYear;

const AGE_RANGE_POINT = { value: '2-6', label: 'Yaş aralığı' };
const HOURS_POINT = { value: `${SITE.hours.opens}–${SITE.hours.closes}`, label: 'Günlük çalışma saatleri' };
const YEARS_ACTIVE_POINT = { value: `${YEARS_ACTIVE} yıl`, label: "Beykent'te aynı adreste" };
/** MEB yönetmeliğinin üst sınırı — okulun kendi rakamı değil, kamuya açık bir düzenleme. Her zaman güvenle yazılabilir. */
const MEB_LIMIT_POINT = { value: `1 : ${ROSTER_STATUS.limit}`, label: 'MEB üst sınırı (öğretmen başına)' };

/**
 * ROSTER_STATUS.ready true olana kadar bu iki kanıt rakamının yerini,
 * okulun kendi sayısını iddia etmeyen iki nötr gerçek alır: yönetmeliğin
 * üst sınırı ve kuruluştan beri geçen süre. Kapı açıldığında (okul sayıyı
 * doğruladığında) gerçek sınıf mevcudu ve oran otomatik olarak buraya
 * girer — tek noktadan.
 */
function rosterProof(): { value: string; label: string }[] {
  return ROSTER_STATUS.ready
    ? [
        { value: String(ROSTER_STATUS.childCount), label: 'Sınıf mevcudu' },
        {
          value: `1 : ${Math.round(ROSTER_STATUS.childCount / ROSTER_STATUS.teacherCount)}`,
          label: 'Öğretmen başına çocuk',
        },
      ]
    : [MEB_LIMIT_POINT, YEARS_ACTIVE_POINT];
}

/**
 * Gövde metninde sınıf mevcudunu anlatan tek cümle. Doğrulanana kadar kesin
 * rakam iddia etmez; yönetmeliğin üst sınırının belirgin altında kalma
 * tercihini anlatır ve doğrulamayı ziyarete devreder — content/day.ts'nin
 * 'sabah-cemberi' bölümüyle ve HeroSection'ın kapalı-kapı metniyle aynı
 * desen. Bu, "az-mevcutlu-anaokulu" sayfasının kurduğu gerilimi çözen
 * cümledir: rakamı gizlemez, rakamı doğrulanmadan iddia etmemeyi tercih
 * ettiğini açıkça söyler ve ziyarete davet eder.
 */
function rosterSentence(): string {
  return ROSTER_STATUS.ready
    ? `Sınıflarımızda ${ROSTER_STATUS.childCount} çocuk ve ${ROSTER_STATUS.teacherCount} öğretmen bulunur — öğretmen başına ${Math.round(
        ROSTER_STATUS.childCount / ROSTER_STATUS.teacherCount,
      )} çocuk düşer.`
    : `Millî Eğitim Bakanlığı okul öncesi yönetmeliği öğretmen başına ${ROSTER_STATUS.limit} çocuğa kadar izin veriyor. Biz kuruluşumuzdan beri bu üst sınırın belirgin biçimde altında kalmayı tercih ediyoruz — kesin sayıyı sitede yazılı bir iddia olarak değil, ön görüşmede sınıfa girip kendiniz sayarak öğrenirsiniz.`;
}

/**
 * İngilizce cümlesi. Asset dosyası §5.2'nin yasakladığı "native" ve
 * "mezun olduğunda konuşuyor" iddialarını hiç içermez (doğrulama kuyruğu
 * #3). Kapsam/süre iddiası yalnızca ENGLISH_COVERAGE_READY açıkken eklenir
 * — content/day.ts'nin 'ingilizce' bölümüyle aynı desen.
 */
function englishSentence(): string {
  const base =
    'İngilizce bizde ayrı bir ders saati değil; oyunun, sofranın ve geçişlerin içinde kullanılan ikinci dil.';
  return ENGLISH_COVERAGE_READY ? `${base} Öğretmenimiz İngilizceyi gün boyunca kullanır.` : base;
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
    metaDescription:
      "Beykent Cumhuriyet Mahallesi'nde okul öncesi eğitim. Öğretmen çocuğunuzu tanır; MEB üst sınırının belirgin altında kalan sınıflarımızı ön görüşmede gezin.",
    h1: "Beykent'te, çocuğunuz kalabalıkta kaybolmaz.",
    subhead: `Bu yaşta gelişimi en çok belirleyen şey, çocuğunuzun öğretmeniyle kurduğu karşılıklı ilişkidir. ${
      ROSTER_STATUS.ready
        ? `Sınıflarımızda ${ROSTER_STATUS.childCount} çocuk var.`
        : 'Biz okulu buna göre kurduk: sınıf mevcudunu yönetmeliğin üst sınırının belirgin altında tutuyoruz.'
    } Beykent'te ${SITE.foundingYear}'den beri, aynı adreste.`,
    mediaKey: 'classroomWide',
    proofPoints: [...rosterProof(), AGE_RANGE_POINT, HOURS_POINT],
    bodyBlocks: [
      {
        heading: `${YEARS_ACTIVE} yıldır aynı sokakta`,
        text: `Cumhuriyet Mahallesi Uludağ Sokak'ta ${SITE.foundingYear}'den beri buradayız. Süreklilik, okul öncesinde en zor taklit edilen özelliktir.`,
      },
      {
        heading: 'Neden sınıf mevcudunu bu kadar önemsiyoruz',
        text: `Bir öğretmenin gün içinde kaç kez çocuğunuza sıra ayırabileceğini belirleyen şey, o sınıfta kaç çocuk olduğudur. ${rosterSentence()}`,
      },
      {
        heading: 'Atölyeler programın parçası',
        text: `${englishSentence()} Seramik, müzik, drama, dans, satranç ve robotik kodlama gibi atölyeler de günün doğal bir parçası; bir çocuk hamurla açılır, bir başkası satrançla.`,
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
    h1: "Beylikdüzü'ne yakın, Beykent'te bir anaokulu.",
    subhead: `Hizmet bölgemiz Beylikdüzü'nü de kapsar. Servis ihtiyacınız varsa güzergâhı ve saatleri adresinize göre ön görüşmede birlikte planlıyoruz.`,
    mediaKey: 'sports',
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
        heading: 'Montessori ve High Scope',
        text: "Günün bir bölümü bireysel Montessori çalışmasına, bir bölümü High Scope grup planlamasına ayrılır. Materyaller açık raflarda, çocuğun boyunda durur; öğretmen araya girmez, gözlemler. Bu yaklaşımın işlemesi, sınıf mevcudunun sınırlı tutulmasına bağlıdır.",
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
    metaTitle: 'Az Mevcutlu Anaokulu | Özel Şeker Anaokulu',
    metaDescription:
      'MEB yönetmeliği öğretmen başına 20 çocuğa kadar izin veriyor. Biz belirgin şekilde altında kaldık — rakamı sitede değil, ön görüşmede sizin sayabileceğiniz şekilde paylaşıyoruz.',
    h1: 'Yönetmelik öğretmen başına 20 çocuğa izin veriyor. Biz belirgin şekilde altında kaldık.',
    subhead:
      'Kesin sayıyı burada, doğrulanmamış bir iddia olarak yazmıyoruz. Bunun yerine sizi davet ediyoruz: ön görüşmede sınıfa girin, çocukları ve öğretmenleri kendiniz sayın.',
    mediaKey: 'classroomWide',
    proofPoints: [...rosterProof(), AGE_RANGE_POINT, { value: 'Ders saatinde', label: 'Sınıfı ziyaret zamanı' }],
    bodyBlocks: [
      {
        heading: 'Bu rakamı neden burada yazmıyoruz',
        text: `Sitede tek bir rakam yazıp doğrulanmamış bir sayıyı iddia olarak sunmak istemiyoruz. Bunun yerine yönetmeliğin üst sınırını ve kendi tercihimizi anlatıyoruz: ${rosterSentence()}`,
      },
      {
        heading: 'Çekingen çocuk için belirleyici',
        text: 'Kalabalık bir sınıfta konuşmayan çocuk sorun çıkarmadığı için en son fark edilendir. Küçük tuttuğumuz gruplarda amacımız, katılımın şansa değil güne bağlı doğal bir sonuca dönüşmesidir.',
      },
      {
        heading: 'Sizi sayılara değil, sınıfa davet ediyoruz',
        text: 'En ikna edici kanıt bir web sitesi rakamı değil, gözünüzle gördüğünüzdür. Ön görüşme randevunuzda ders saatinde gelin, sınıfa girin, çocukları ve öğretmenleri kendiniz sayın. Gördüğünüz rakam bizim söylediğimiz değil, sizin saydığınız olsun.',
      },
    ],
    faq: [
      {
        question: 'Sınıf mevcudunuzu neden sitede yazmıyorsunuz?',
        answer:
          'Doğrulanmamış bir sayıyı iddia olarak yazmak istemiyoruz. Bunun yerine ön görüşmede sınıfa girip kendiniz saymanızı öneriyoruz; gördüğünüz rakam gerçek olur.',
      },
      {
        question: 'MEB yönetmeliği kaç çocuğa izin veriyor?',
        answer: `Okul öncesi yönetmeliği öğretmen başına ${ROSTER_STATUS.limit} çocuğa kadar izin veriyor. Biz kuruluşumuzdan beri bu üst sınırın belirgin biçimde altında kalmayı tercih ediyoruz.`,
      },
      FAQ_AGES,
      FAQ_VISIT,
    ],
    formHeading: 'Sınıfı kendiniz sayın',
    formIntro: FORM_INTRO_STANDARD,
  },
  {
    slug: 'kres-2-yas',
    campaign: 'K9',
    metaTitle: 'Beykent Kreş ve 2-3 Yaş Grubu | Özel Şeker Anaokulu',
    metaDescription:
      'İki yaşından itibaren kabul. Kreş değil anaokulu: güvenli bağlanma, kademeli uyum ve Montessori temelli program. Beykent Büyükçekmece.',
    h1: 'Kreş değil, anaokulu. İki yaşından itibaren.',
    subhead:
      'İki yaş, çocuğun aileden ilk kez ayrıldığı dönemdir. Bu yaşta önceliğimiz akademik kazanım değil, güvenli bağlanma ve çocuğunuzun kendi temposunda uyum sağlamasıdır.',
    mediaKey: 'motorSkills',
    proofPoints: [...rosterProof(), { value: '2', label: 'Başlangıç yaşı' }, HOURS_POINT],
    bodyBlocks: [
      {
        heading: 'Uyum, çocuğun temposunda',
        text: 'Uyum sürecinde önceliğimiz, ayrılığın çocuğunuz hazır olduğunda gerçekleşmesidir. Bu süreci sizinle birlikte nasıl yürüteceğimizi ön görüşmede ayrıntılı anlatıyoruz.',
      },
      {
        heading: 'Bakım değil, program',
        text: `İki yaş grubunda da Montessori materyalleri ve High Scope günlük planlaması kullanılır: duyusal oyun, öz bakım becerileri ve tuvalet eğitimi desteği günün parçasıdır. ${englishSentence()}`,
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
    h1: 'Ücreti belirleyen unsurlar',
    subhead:
      'Ücreti sitede yayımlamıyoruz; sebebi saklamak değil, bir rakamın tek başına neyin karşılığı olduğunu anlatamamasıdır. Aşağıda neyin neyi belirlediğini anlatıyoruz; net rakamı ön görüşmede paylaşıyoruz.',
    mediaKey: 'montessori',
    proofPoints: [...rosterProof(), AGE_RANGE_POINT, { value: '2026-2027', label: 'Eğitim yılı' }],
    bodyBlocks: [
      {
        heading: 'Bir — sınıf modeli',
        text: `Öğretmen başına düşen çocuk sayısını düşük tutmak yapısal olarak daha maliyetlidir. ${rosterSentence()} Ücretimizin en büyük bileşeni budur.`,
      },
      {
        heading: 'İki — program genişliği',
        text: `Tam gün, yarım gün ve yaz dönemi farklı fiyatlanır. Seramik, müzik, drama, dans, satranç ve robotik kodlama gibi branş dersleri ile rehberlik desteği programa dahildir. ${englishSentence()}`,
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
