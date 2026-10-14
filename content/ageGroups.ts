import { ROSTER_STATUS, ENGLISH_HOURS_PER_DAY } from './day';
import { MONTESSORI_DAYS_PER_WEEK } from './program';

export type AgeGroup = {
  slug: string;
  title: string;
  ageLabel: string;
  headline: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  focusAreas: { title: string; description: string }[];
  dailyHighlights: string[];
  classSize: string;
  image: string;
};

/**
 * Okulun hizmet verdiği yaş bantları. AGE_GROUPS_CONTENT'ten bağımsız
 * tutulur: her bandın karşılığında bir sayfa bulunduğunu doğrulayan test
 * (app/__tests__/adTargets.test.ts) iki listeyi karşılaştırır.
 */
export const AGE_GROUPS = ['2-3', '3-4', '4-5', '5-6'] as const;

const CLASS_SIZE = `${ROSTER_STATUS.childCount} çocuk, ${ROSTER_STATUS.teacherCount} öğretmen`;

export const AGE_GROUPS_CONTENT: AgeGroup[] = [
  {
    slug: '2-3-yas',
    title: '2-3 Yaş Oyun Grubu',
    ageLabel: '2-3 yaş',
    headline: 'İlk ayrılık en zoru. Acele ettirmiyoruz.',
    metaTitle: '2-3 Yaş Oyun Grubu — Beykent',
    metaDescription:
      "Beykent Büyükçekmece'de 2-3 yaş oyun grubu. Sınıfta iki öğretmen, Montessori duyusal çalışmalar ve iki büyük bahçe. Gelin tanışalım.",
    intro:
      'İki yaş, çocuğun evden ilk kez ayrıldığı dönem. Bu yaşta önceliğimiz harf ya da sayı değil; çocuğun kendini güvende hissetmesi ve buraya alışması. Sınıfta iki öğretmenin birden olması bu yaşta bir tercih değil, gereklilik: bir çocuk kucağa alınırken diğerlerinin başında birinin durması gerekiyor.',
    focusAreas: [
      {
        title: 'Alışma dönemi',
        description:
          'Ayrılığı acele ettirmiyoruz; çocuğunuz hazır olduğu hızda ilerliyor. Uzman psikoloğumuz bu süreçte hem çocuğun hem sizin yanınızda.',
      },
      {
        title: 'Günlük yaşam becerileri',
        description:
          'Tuvalet eğitimine destek, kendi başına yemek yeme, el yıkama. Montessori günlük yaşam çalışmalarının ilk basamağı.',
      },
      {
        title: 'Duyusal çalışmalar',
        description: 'Kum, su, hamur. Bu yaşta öğrenmenin yolu elden geçiyor.',
      },
      {
        title: 'Dil',
        description: 'Şarkı, tekerleme, hikâye. İngilizce ile ilk tanışma da bu grupta oluyor.',
      },
    ],
    dailyHighlights: [
      'Karşılama ve serbest oyun',
      'Montessori duyusal çalışmalar',
      'Bahçe zamanı',
      'Öğle uykusu',
      'Müzik & Ritim',
    ],
    classSize: CLASS_SIZE,
    image: '/zurafalar-bahce.webp',
  },
  {
    slug: '3-4-yas',
    title: '3-4 Yaş Anaokulu',
    ageLabel: '3-4 yaş',
    headline: 'Her şeyi sorduğu yaş.',
    metaTitle: '3-4 Yaş Anaokulu — Beykent',
    metaDescription: `Beykent'te 3-4 yaş anaokulu. Haftanın ${MONTESSORI_DAYS_PER_WEEK} günü Montessori, her gün İngilizce, seramik ve drama. Sınıfta iki öğretmen.`,
    intro:
      'Üç yaş "neden" yaşı. Bu merakı susturmak yerine peşine düşüyoruz. Sınıfta iki öğretmenin olmasının en çok işe yaradığı yaş da bu: çocuğunuz bir şey sorduğunda cevabını o an alıyor, sıraya girmiyor.',
    focusAreas: [
      {
        title: 'Montessori çalışması',
        description: `Haftanın ${MONTESSORI_DAYS_PER_WEEK} günü. Kendi seçtiği işi kendi hızında bitiriyor; öğretmen gözlemliyor, araya girmiyor.`,
      },
      {
        title: 'Arkadaşlık',
        description:
          'Sıra beklemek, paylaşmak, küsüp barışmak. Pazartesi oyuncak paylaşım günü tam bu yaşa göre kurulmuş bir alışkanlık.',
      },
      {
        title: 'İngilizce',
        description: `Her gün ${ENGLISH_HOURS_PER_DAY} saat; oyun, şarkı ve hikâyenin içinden.`,
      },
      {
        title: 'Kendini anlatma',
        description: 'Seramik, görsel sanatlar, drama. Söyleyemediğini yapıyor.',
      },
    ],
    dailyHighlights: [
      'Sabah çemberi',
      'Montessori çalışma saati',
      'İngilizce',
      'Bahçe zamanı',
      'Branş dersi',
    ],
    classSize: CLASS_SIZE,
    image: '/mutfak-atolyesi.webp',
  },
  {
    slug: '4-5-yas',
    title: '4-5 Yaş Anaokulu',
    ageLabel: '4-5 yaş',
    headline: 'Bir işe oturup bitirebildiği yıl.',
    metaTitle: '4-5 Yaş Anaokulu — Beykent',
    metaDescription:
      "Beykent'te 4-5 yaş anaokulu. Robotik & kodlama, satranç, seramik, matematik ve fen çalışmaları; her gün İngilizce. Sınıfta iki öğretmen.",
    intro:
      'Dört yaşında çocuk artık bir işe başlayıp bitirebiliyor, kurala uyabiliyor ve "sonra ne olacak" diye düşünebiliyor. Program da buna göre değişiyor: daha çok problem çözme, daha çok sırayla düşünme.',
    focusAreas: [
      {
        title: 'Robotik & Kodlama',
        description:
          'Manyetik lego setleriyle kurduğu robota ileri, geri, sağ ve sol komutlarını kendisi yazıyor.',
      },
      {
        title: 'Satranç',
        description:
          'Taşları ve hamleleri bahçedeki dev satranç tahtasında tanıyor. Sırasını beklemek ve bir sonraki hamleyi düşünmek.',
      },
      {
        title: 'Matematik ve fen',
        description: 'Merak etmek, gözlem yapmak ve öğrendiğini deneyerek görmek.',
      },
      {
        title: 'Seramik',
        description:
          'Kendi tasarımını çamurdan şekillendiriyor; okulun fırınında pişen eser elinde kalıyor.',
      },
    ],
    dailyHighlights: [
      'Sabah çemberi',
      'Montessori çalışma saati',
      'İngilizce',
      'Robotik & Kodlama veya Satranç',
      'Bahçe zamanı',
    ],
    classSize: CLASS_SIZE,
    image: '/acik-hava-sinifi.webp',
  },
  {
    slug: '5-6-yas',
    title: '5-6 Yaş İlkokula Hazırlık',
    ageLabel: '5-6 yaş',
    headline: 'İlkokula hazır. Ama hâlâ çocuk.',
    metaTitle: '5-6 Yaş İlkokula Hazırlık Sınıfı — Beykent',
    metaDescription:
      "Beykent'te 5-6 yaş ilkokula hazırlık. Kalem tutuş ve dikkat çalışmaları, satranç turnuva hazırlığı, her gün İngilizce. Sınıfta iki öğretmen.",
    intro:
      'Bu yaşta amacımız okuma yazma öğretmek değil. İlkokulda gerçekten işine yarayacak üç şeyi kurmak: oturup bir işi bitirebilmek, kalemi doğru tutmak ve öğrenmeyi sevmek. Beş yaşında okuma yazma öğretilen çocuk birinci sınıfa sıkılmış başlıyor.',
    focusAreas: [
      {
        title: 'Yazıya hazırlık',
        description:
          'Sesleri ayırt etme, çizgi çalışmaları, kalemi doğru tutma. Seramik ve kalem işi el kaslarını yazıya hazırlıyor.',
      },
      {
        title: 'Dikkat',
        description:
          'Montessori çalışmasında oturup çalışabildiği süre haftalar içinde kendiliğinden uzuyor.',
      },
      {
        title: 'Sorumluluk',
        description: 'Kendi çantasını toplamak, görev almak, sözünü tutmak.',
      },
      {
        title: 'Satranç turnuvası',
        description:
          'Bu yaş grubunda çocuklar turnuva çalışmalarına hazırlanıyor; planlamak ve öngörmek oyunun içinde öğreniliyor.',
      },
    ],
    dailyHighlights: [
      'Sabah çemberi',
      'İlkokula hazırlık çalışması',
      'İngilizce',
      'Matematik ve fen',
      'Bahçe zamanı',
    ],
    classSize: CLASS_SIZE,
    image: '/bahce-atolyeler.webp',
  },
];

export function getAgeGroup(slug: string): AgeGroup | undefined {
  return AGE_GROUPS_CONTENT.find((group) => group.slug === slug);
}
