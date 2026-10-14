import type { MediaKey } from './media';

/**
 * Programın tek kaynağı. Buradaki bütün metinler okulun kendi öğretmenleri
 * tarafından yazılmış tanıtım metinlerinden alınmıştır (11 Eylül 2026'da okul
 * sahibi tarafından gönderildi); web için kısaltılmış, iddia eklenmemiştir.
 *
 * Bir branşın adı, açıklaması veya kazanımı değişecekse yalnızca burası
 * güncellenir — sayfalar ve kartlar bu listeyi okur.
 */

/** Okulun günlük çalışma saatleri. Tek kaynak burasıdır. */
export const PROGRAM_HOURS = {
  full: { opens: '07:30', closes: '18:30' },
  half: { opens: '07:30', closes: '13:00' },
} as const;

export const FULL_DAY_LABEL = `${PROGRAM_HOURS.full.opens}–${PROGRAM_HOURS.full.closes}`;
export const HALF_DAY_LABEL = `${PROGRAM_HOURS.half.opens}–${PROGRAM_HOURS.half.closes}`;

/** Montessori çalışmasının haftalık gün sayısı — metinlerde yazıyla geçer. */
export const MONTESSORI_DAYS_PER_WEEK = 5;

/**
 * İki bina ve iki bahçe okulun en somut ayırt edici özelliği; hero ve
 * bahçe bölümü bu iki sayıyı buradan okur.
 */
export const CAMPUS = {
  buildings: 2,
  gardens: 2,
} as const;

/**
 * Okulun kendi metinlerinde geçen, veliye doğrudan hitap eden iki uygulama:
 * sınıfların doğum yılı ve ayına göre kurulması ve okulda görev yapan uzman
 * psikolog. İkisi de birden çok sayfada anlatıldığı için tek yerde durur.
 */
export const SUPPORT = {
  classPlacement:
    'Sınıflarımızı çocukların doğum yıllarını ve aylarını dikkate alarak oluşturuyor, gelişim dönemlerine uygun bir eğitim süreci planlıyoruz.',
  psychologist:
    'Okulumuzda görev yapan uzman psikoloğumuzla çocuklarımızın sosyal ve duygusal gelişimini de destekliyoruz. İhtiyaç hâlinde velilerimiz randevu oluşturarak uzman psikoloğumuzdan bireysel görüşme desteği alabiliyor.',
  smartBoard:
    'Öğrenme sürecini daha anlaşılır ve etkileşimli hâle getirmek için akıllı tahta uygulamasından yararlanıyoruz. Çocukların derse aktif katılım göstermeleri ve öğrendiklerini görsel ve işitsel materyallerle pekiştirmeleri destekleniyor.',
} as const;

export type Branch = {
  slug: string;
  name: string;
  /** Kart özeti — tek cümle, kısa format için ayrı yazıldı. */
  summary: string;
  /** Sayfa gövdesi. */
  body: string[];
  /** Kartta etiket olarak görünen kazanımlar. */
  gains: string[];
  season: 'yil-boyu' | 'yaz';
  /**
   * Kart ve ayrıntı panosundaki okul çekimi.
   * Atölye içi kare henüz yok; her ders, o çalışmaya en yakın bahçe /
   * atölye karesine bağlanır — stok görsel kullanılmaz.
   */
  mediaKey: MediaKey;
};

export const BRANCHES: Branch[] = [
  {
    slug: 'montessori',
    name: 'Montessori Eğitimi',
    summary:
      'Haftanın beş günü, çocuk kendi seçtiği materyalle kendi hızında çalışır.',
    body: [
      'Okulumuzda haftanın beş günü Montessori eğitimi uygulanır. Montessori yaklaşımı; çocukların kendi hızlarında öğrenmelerini, bağımsızlaşmalarını ve günlük yaşam becerilerini geliştirmelerini destekler.',
      'Derslerde çocuklar; günlük yaşam, duyusal çalışmalar, dil, matematik, dikkat ve konsantrasyon alanlarında özel olarak hazırlanmış Montessori materyalleriyle çalışır.',
      'Çocuğun öğrenme sürecinin aktif bir parçası olmasını önemsiyoruz: kendi seçimini yapması ve çalışmasını kendi hızında sürdürmesi desteklenir.',
      'Bu çalışmalarla özgüven, sorumluluk, el-göz koordinasyonu, problem çözme ve odaklanma becerilerinin gelişimi desteklenir.',
    ],
    gains: ['Özgüven', 'Sorumluluk', 'El-göz koordinasyonu', 'Problem çözme', 'Odaklanma'],
    season: 'yil-boyu',
    mediaKey: 'outdoorClass',
  },
  {
    slug: 'beceri-koordinasyon',
    name: 'Beceri & Koordinasyon',
    summary: 'Denge, hareket ve el becerileri; bedenini tanıyarak ilerleyen bir ders.',
    body: [
      'Beceri & Koordinasyon dersi; çocukların ince ve kaba motor becerilerini, el-göz koordinasyonunu, denge ve beden farkındalığını geliştirmeyi amaçlar.',
      'Derslerde çocuklar; denge, hareket, koordinasyon, dikkat ve el becerilerini destekleyen, yaşlarına uygun etkinlikler gerçekleştirir.',
      'Bu çalışmalarla bedensel farkındalık, özgüven, dikkat ve günlük yaşam becerilerinin gelişimi desteklenir.',
    ],
    gains: ['İnce ve kaba motor', 'Denge', 'Beden farkındalığı', 'Dikkat'],
    season: 'yil-boyu',
    mediaKey: 'giraffes',
  },
  {
    slug: 'gorsel-sanatlar',
    name: 'Görsel Sanatlar',
    summary: 'Çizim, boyama, kolaj, ebru ve cam boyama; farklı malzemeyle üretme.',
    body: [
      'Görsel Sanatlar dersi; çocukların yaratıcılıklarını, estetik bakış açılarını ve kendilerini sanat yoluyla ifade etme becerilerini geliştirmeyi amaçlar.',
      'Derslerde çocuklar; çizim, boyama, kolaj, ebru, cam boyama ve ahşap boyama gibi farklı malzeme ve tekniklerle çalışarak sanatın farklı alanlarını keşfeder.',
      'Bu süreçte ince motor beceriler, dikkat ve odaklanma, hayal gücü ve özgün düşünme desteklenir.',
    ],
    gains: ['Yaratıcılık', 'İnce motor', 'Estetik bakış', 'Özgün düşünme'],
    season: 'yil-boyu',
    mediaKey: 'gardenWorkshops',
  },
  {
    slug: 'seramik',
    name: 'Seramik',
    summary: 'Gerçek seramik çamuru, okulun kendi fırını ve çocuğun elinden çıkan kalıcı bir eser.',
    body: [
      'Seramik dersinde çocuklar, orijinal seramik çamuru kullanarak kendi tasarımlarını oluşturur.',
      'El yordamı ve yaş gruplarına uygun kalıp çalışmalarıyla şekillendirdikleri ürünler, okulumuzun seramik fırınında pişirilerek kalıcı hâle gelir.',
      'Pişirmenin ardından çocuklar çalışmalarını boyama ve süsleme teknikleriyle tamamlar, kendi özgün eserlerini ortaya çıkarır.',
      'Seramik çalışmaları ince motor becerileri, el-göz koordinasyonunu, dikkat ve odaklanmayı destekler. Aynı zamanda çocuğun kendi emeğiyle bir eser ortaya çıkarmanın keyfini yaşamasına fırsat sunar.',
    ],
    gains: ['İnce motor', 'El-göz koordinasyonu', 'Yaratıcılık', 'Odaklanma'],
    season: 'yil-boyu',
    mediaKey: 'mudKitchen',
  },
  {
    slug: 'robotik-kodlama',
    name: 'Robotik & Kodlama',
    summary: 'Manyetik lego setleriyle kendi robotunu kur, sonra hareketini kodla.',
    body: [
      'Robotik & Kodlama dersinde çocuklar, yaş ve gelişim düzeylerine uygun manyetik lego setleri ve tabletler kullanarak kendi robotlarını tasarlar ve oluşturur.',
      'Oluşturdukları robotlara ileri, geri, sağ ve sol gibi temel komutları kodlayarak robotların hareketlerini yönlendirir.',
      'Yaş gruplarına göre çalışmaların zorluk seviyesi artırılır ve daha gelişmiş robotik uygulamalara geçilir.',
      'Bu çalışmalarla algoritmik düşünme, problem çözme, dikkat, el-göz koordinasyonu, yaratıcılık ve teknoloji kullanım becerileri desteklenir.',
    ],
    gains: ['Algoritmik düşünme', 'Problem çözme', 'Dikkat', 'Yaratıcılık'],
    season: 'yil-boyu',
    mediaKey: 'outdoorClass',
  },
  {
    slug: 'ingilizce',
    name: 'İngilizce',
    summary: 'Oyun, şarkı ve hikâyeyle başlar; günün içinde konuşulmaya devam eder.',
    body: [
      'Çocukların erken yaşta yabancı dil ile tanışmasını önemsiyoruz. Şeker Akademi’de İngilizce ve Almanca başta olmak üzere yabancı dil çalışmalarına yer verilir.',
      'İngilizce çalışmaları; çocukların yaş ve gelişim düzeylerine uygun oyun, şarkı, hikâye, etkinlik ve günlük iletişim çalışmalarıyla desteklenir.',
      'Öğrendikleri kelime ve ifadeleri doğal iletişim ortamlarında kullanmaları ve yabancı dil konuşma konusunda özgüven kazanmaları desteklenir.',
    ],
    gains: ['Kelime dağarcığı', 'Dinleme', 'Konuşma özgüveni', 'Günlük iletişim'],
    season: 'yil-boyu',
    mediaKey: 'candyCorner',
  },
  {
    slug: 'muzik-ritim',
    name: 'Müzik & Ritim',
    summary: 'Her hafta başka bir enstrüman; perküsyon ve ritim çalışmaları.',
    body: [
      'Müzik & Ritim dersi; çocukların ritim duygusunu, işitsel algılarını, müzikal farkındalıklarını ve kendilerini müzik yoluyla ifade etme becerilerini geliştirmeyi amaçlar.',
      'Derslerde çocuklar ritim çalışmaları, perküsyon ve farklı müzik enstrümanlarıyla uygulamalar gerçekleştirir.',
      'Her hafta farklı bir enstrümanı tanıyarak sesini, kullanımını ve müzikteki yerini keşfeder.',
      'Bu çalışmalarla dikkat, dinleme, el-göz koordinasyonu, ritim algısı ve grup içinde uyum becerileri desteklenir.',
    ],
    gains: ['Ritim algısı', 'Dinleme', 'Grup içinde uyum', 'Dikkat'],
    season: 'yil-boyu',
    mediaKey: 'gardenWorkshops',
  },
  {
    slug: 'bale-dans',
    name: 'Bale & Dans',
    summary: 'Ritim ve temel dans hareketleri; yıl sonunda sahnede sergilenen koreografiler.',
    body: [
      'Bale & Dans dersi; çocukların ritim duygusunu, beden koordinasyonunu, hareket becerilerini ve kendilerini ifade etme özgüvenlerini geliştirmeyi amaçlar.',
      'Derslerde çocuklar, yaş ve gelişim düzeylerine uygun ritim, temel dans hareketleri ve koreografi çalışmaları gerçekleştirir.',
      'Yıl boyunca farklı müzikler eşliğinde yapılan çalışmalarla beden farkındalığı, müzik ve ritim algısı, koordinasyon ve grup içinde uyum desteklenir.',
      'Çocuklar yıl sonunda hazırlanan dans gösterileriyle öğrendikleri hareket ve koreografileri sergileme fırsatı bulur.',
    ],
    gains: ['Ritim duygusu', 'Beden koordinasyonu', 'Özgüven', 'Grup içinde uyum'],
    season: 'yil-boyu',
    mediaKey: 'giraffesGarden',
  },
  {
    slug: 'drama',
    name: 'Drama',
    summary: 'Farklı karakterleri canlandırarak kendini anlatma ve grup içinde iletişim.',
    body: [
      'Drama çalışmalarında çocuklar, hayal güçlerini kullanarak farklı karakterleri ve durumları canlandırma fırsatı bulur.',
      'Kendilerini ifade etmeleri, grup içinde iletişim kurmaları, özgüven kazanmaları ve sosyal becerilerinin gelişmesi drama etkinlikleriyle desteklenir.',
    ],
    gains: ['Kendini ifade etme', 'İletişim', 'Özgüven', 'Sosyal beceri'],
    season: 'yil-boyu',
    mediaKey: 'mudKitchen',
  },
  {
    slug: 'satranc',
    name: 'Satranç',
    summary: 'Hamleler bahçedeki dev satranç tahtasında öğrenilir; büyük gruplar turnuvaya hazırlanır.',
    body: [
      'Satranç dersi; çocukların stratejik düşünme, problem çözme, dikkat ve odaklanma becerilerini geliştirmeyi amaçlar.',
      'Derslerde çocuklar önce satranç taşlarını ve hareketlerini tanır. Öğrendiklerini pekiştirmek için bahçedeki dev satranç üzerinde hareketleri uygulayarak satrancı daha deneyimsel bir şekilde öğrenir; akıllı tahta destekli çalışmalarla oyun süreci zenginleşir.',
      'Yaş ve gelişim düzeylerine uygun olarak ilerleyen derslerde mantıksal düşünme, planlama, karar verme, sabır ve öngörü becerileri desteklenir.',
      'İlerleyen yaş gruplarında çocuklar turnuva çalışmalarına hazırlanır.',
    ],
    gains: ['Stratejik düşünme', 'Planlama', 'Sabır', 'Karar verme'],
    season: 'yil-boyu',
    mediaKey: 'gardenWide',
  },
  {
    slug: 'matematik-fen',
    name: 'Matematik ve Fen Çalışmaları',
    summary: 'Merak etmek, gözlem yapmak ve öğrendiğini deneyerek görmek.',
    body: [
      'Çocukların ilkokul dönemine hazırlanırken temel akademik becerileri yaşlarına uygun etkinliklerle kazanmalarını hedefliyoruz.',
      'Matematik ve fen çalışmalarında çocukların merak etmeleri, gözlem yapmaları, düşünmeleri ve öğrendiklerini farklı etkinliklerle deneyimlemeleri desteklenir.',
    ],
    gains: ['Merak', 'Gözlem', 'Neden-sonuç', 'İlkokula hazırlık'],
    season: 'yil-boyu',
    mediaKey: 'outdoorClass',
  },
  {
    slug: 'yuzme',
    name: 'Yüzme',
    summary: 'Yaz döneminde suyla tanışma ve temel yüzme çalışmaları.',
    body: [
      'Yaz döneminde çocuklarımız için yüzme çalışmalarına yer verilir.',
      'Suda kendini rahat hissetmek, temel hareketleri öğrenmek ve su güvenliği kurallarını tanımak bu çalışmaların odağındadır.',
    ],
    gains: ['Su güvenliği', 'Temel yüzme hareketleri', 'Beden koordinasyonu', 'Özgüven'],
    season: 'yaz',
    mediaKey: 'gardenWide',
  },
  {
    slug: 'binicilik',
    name: 'Binicilik',
    summary: 'Atla tanışma, duruş ve sorumluluk; yaz programının en çok konuşulanı.',
    body: [
      'Yaz döneminde çocuklarımız binicilik çalışmalarına katılır.',
      'Atla kurulan ilişki; duruş ve denge, hayvan sevgisi ve sorumluluk bilinci açısından çocuklar için farklı bir deneyim alanı oluşturur.',
    ],
    gains: ['Denge ve duruş', 'Hayvan sevgisi', 'Sorumluluk', 'Özgüven'],
    season: 'yaz',
    mediaKey: 'giraffes',
  },
  {
    slug: 'sportif-faaliyetler',
    name: 'Sportif Faaliyetler',
    summary: 'Yaz boyunca bahçede oyun, hareket ve grup etkinlikleri.',
    body: [
      'Yaz döneminde bahçelerimizde gerçekleştirilen sportif faaliyetlerle çocukların hareket ihtiyacını programın bir parçası hâline getiriyoruz.',
      'Grup oyunları ve hareket temelli etkinliklerle koordinasyon, birlikte oynama ve kurala uyma becerileri desteklenir.',
    ],
    gains: ['Koordinasyon', 'Birlikte oynama', 'Kurala uyma', 'Dayanıklılık'],
    season: 'yaz',
    mediaKey: 'giraffesGarden',
  },
];

export const YEAR_ROUND_BRANCHES = BRANCHES.filter((b) => b.season === 'yil-boyu');
export const SUMMER_BRANCHES = BRANCHES.filter((b) => b.season === 'yaz');

export function getBranch(slug: string): Branch | undefined {
  return BRANCHES.find((branch) => branch.slug === slug);
}

/** İngilizce programının içindeki üç ayrı çalışma. */
export const ENGLISH_TRACKS = [
  {
    name: 'English Play Time',
    description:
      'Çocuklar İngilizceyi yalnızca ders ortamında değil, oyun ve eğlence aracılığıyla da deneyimler. Oyun temelli çalışmalarla günlük kelime ve ifadeler pekişir.',
  },
  {
    name: 'English Kids Club',
    description:
      'Şarkılar, oyunlar, hikâyeler ve farklı iletişim çalışmalarıyla çocukların İngilizceye olan ilgisini artırmayı amaçlayan etkinliklerden oluşur.',
  },
  {
    name: 'Speaking',
    description:
      'Öğrendikleri kelime ve ifadeleri günlük iletişim içinde kullanmaları desteklenir; konuşma konusunda özgüven kazanmaları hedeflenir.',
  },
] as const;

/** Haftanın günlerine bağlı okul ritüelleri — veliye pratik bilgi taşır. */
export const WEEK_DAYS = [
  {
    day: 'Pazartesi',
    title: 'Oyuncak Paylaşım Günü',
    description:
      'Çocuklarımız sevdikleri bir oyuncağı okula getirip arkadaşlarıyla paylaşabilir. Paylaşma, iletişim ve sosyal etkileşim becerilerini desteklemeyi amaçlıyoruz.',
  },
  {
    day: 'Salı',
    title: 'Eğitim ve Etkinlik Günü',
    description:
      'Günlük eğitim programımız kapsamında çocuklarımız farklı etkinliklerle öğrenmeye devam eder.',
  },
  {
    day: 'Çarşamba',
    title: 'Kitap Okuma Günü',
    description:
      'Kitap sevgisini ve okuma alışkanlığını desteklemek için çocuklarımızın çantalarında bir kitap getirmelerini rica ediyoruz.',
  },
  {
    day: 'Perşembe',
    title: 'Beceri & Koordinasyon Günü',
    description:
      'Beceri & Koordinasyon derslerinde ve okul gezilerinde öğrencilerimizin Şeker Akademi eşofmanlarını giymelerini rica ediyoruz.',
  },
  {
    day: 'Cuma',
    title: 'Parti Günü',
    description:
      'Haftanın son gününü daha eğlenceli hâle getirmek için parti etkinlikleri düzenliyoruz. Öğrencilerimiz cuma günleri diledikleri özenli ve eğlenceli kıyafetlerle okula gelebilir.',
  },
] as const;
