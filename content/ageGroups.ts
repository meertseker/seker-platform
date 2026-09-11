import { ROSTER_STATUS, ENGLISH_HOURS_PER_DAY } from './day';

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
    headline: 'İlk ayrılık en zoru. Bunu biliyoruz.',
    metaTitle: '2-3 Yaş Oyun Grubu — Beykent',
    metaDescription:
      'Beykent Büyükçekmece\'de 2-3 yaş oyun grubu. Sınıfta 13 çocuk, iki öğretmen. Çocuğunuzun ilk okul deneyimi için gelin tanışalım.',
    intro:
      'İki yaş, çocuğun evden ilk kez ayrıldığı yaş. Bu dönemde harf ya da sayı derdimiz yok; çocuğunuzun kendini güvende hissetmesi ve buraya alışması var. Sınıfta iki öğretmenin birden olması bu yaşta tercih değil, mecburiyet: bir çocuk kucağa alınırken diğerlerinin başında birinin durması gerekiyor.',
    focusAreas: [
      { title: 'Alışma dönemi', description: 'Ayrılığı acele ettirmiyoruz. Çocuğunuz hazır olduğu hızda ilerliyor.' },
      { title: 'Kendi işini görme', description: 'Tuvalet eğitimine destek, kendi başına yemek yeme, el yıkama.' },
      { title: 'Dokunarak öğrenme', description: 'Kum, su, hamur. Bu yaşta öğrenmenin yolu ellerden geçiyor.' },
      { title: 'Konuşma', description: 'Şarkı, tekerleme, hikâye. İngilizce öğretmeniyle de ilk tanışma burada oluyor.' },
    ],
    dailyHighlights: ['Karşılama ve serbest oyun', 'Duyusal atölye', 'Bahçe zamanı', 'Öğle uykusu', 'Müzik ve hareket'],
    classSize: CLASS_SIZE,
    image: '/zurafalar-bahce.webp',
  },
  {
    slug: '3-4-yas',
    title: '3-4 Yaş Anaokulu',
    ageLabel: '3-4 yaş',
    headline: 'Her şeyi sorduğu yaş.',
    metaTitle: '3-4 Yaş Anaokulu — Beykent',
    metaDescription:
      'Beykent\'te 3-4 yaş anaokulu. Sınıfta 13 çocuk ve iki öğretmen, her gün 2 saat İngilizce, sanat ve drama atölyeleri.',
    intro:
      'Üç yaş "neden" yaşı. Bu merakı susturmak yerine peşine düşüyoruz. Sınıfta iki öğretmenin olmasının en çok işe yaradığı yaş da bu: çocuğunuz bir şey sorduğunda cevabını o an alıyor, sıraya girmiyor.',
    focusAreas: [
      { title: 'Montessori çalışmaları', description: 'Kendi seçtiği işi, kendi hızında bitiriyor. Öğretmen izliyor, karışmıyor.' },
      { title: 'Arkadaşlık', description: 'Sıra beklemek, paylaşmak, küsüp barışmak. Hepsi öğreniliyor.' },
      { title: 'İngilizce', description: `Her gün ${ENGLISH_HOURS_PER_DAY} saat, anadili İngilizce olan öğretmeniyle.` },
      { title: 'Kendini anlatma', description: 'Seramik, resim, drama. Söyleyemediğini yapıyor.' },
    ],
    dailyHighlights: ['Sabah çemberi', 'Montessori çalışma saati', 'İngilizce', 'Bahçe zamanı', 'Atölye'],
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
      'Beykent\'te 4-5 yaş anaokulu. Robotik kodlama, satranç, bilim atölyesi ve her gün 2 saat İngilizce. Sınıfta 13 çocuk, iki öğretmen.',
    intro:
      'Dört yaşında çocuk artık bir işe başlayıp bitirebiliyor, kurala uyabiliyor ve "sonra ne olacak" diye düşünebiliyor. Program da buna göre değişiyor: daha çok problem çözme, daha çok sırayla düşünme.',
    focusAreas: [
      { title: 'Robotik kodlama', description: '"Önce bu, sonra şu." Sıralı düşünmeyi oyun oynarken öğreniyor.' },
      { title: 'Satranç', description: 'Sırasını beklemek ve bir sonraki hamleyi düşünmek.' },
      { title: 'Sayılarla tanışma', description: 'Sayı, örüntü, ölçme, şekiller.' },
      { title: 'Bilim atölyesi', description: 'Deney yapıyor, ne olduğunu kendi görüyor.' },
    ],
    dailyHighlights: ['Sabah çemberi', 'Bilim veya robotik atölyesi', 'İngilizce', 'Satranç', 'Bahçe zamanı'],
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
      'Beykent\'te 5-6 yaş ilkokula hazırlık. Kalem tutuş ve dikkat çalışmaları, her gün 2 saat İngilizce. Sınıfta 13 çocuk, iki öğretmen.',
    intro:
      'Bu yaşta amacımız okuma yazma öğretmek değil. İlkokulda gerçekten işine yarayacak üç şeyi kurmak: oturup bir işi bitirebilmek, kalemi doğru tutmak ve öğrenmeyi sevmek. Beş yaşında okuma yazma öğretilen çocuk birinci sınıfa sıkılmış başlıyor.',
    focusAreas: [
      { title: 'Yazıya hazırlık', description: 'Sesleri ayırt etme, çizgi çalışmaları, kalemi doğru tutma.' },
      { title: 'Dikkat', description: 'Oturup çalışabildiği süre haftalar içinde kendiliğinden uzuyor.' },
      { title: 'Sorumluluk', description: 'Kendi çantasını toplamak, görev almak, sözünü tutmak.' },
      { title: 'İngilizce', description: `Üç yılın sonunda konuşarak mezun oluyor. Her gün ${ENGLISH_HOURS_PER_DAY} saatin birikmiş hâli.` },
    ],
    dailyHighlights: ['Sabah çemberi', 'Hazırlık çalışması', 'İngilizce', 'Proje saati', 'Bahçe zamanı'],
    classSize: CLASS_SIZE,
    image: '/bahce-atolyeler.webp',
  },
];

export function getAgeGroup(slug: string): AgeGroup | undefined {
  return AGE_GROUPS_CONTENT.find((group) => group.slug === slug);
}
