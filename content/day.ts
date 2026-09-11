import type { MediaKey } from './media';
import type { Grade } from '@/app/components/cine/Frame';

export type DayChapter = {
  id: string;
  /**
   * HH:MM — yazım sırasında bölümleri kronolojik tutmak için kullanılan
   * dahili referans. Okul tarafından doğrulanmış bir saatlik akış YOK
   * (bkz. asset dosyası §7.6: "Saatlik akış okuldan alınacak" — 🔴).
   * SCHEDULE_READY false iken bu alan hiçbir bileşende render edilmez;
   * yalnızca aşağıdaki dizinin sırasını belirlemek için var.
   */
  time: string;
  title: string;
  lead: string;
  body: string[];
  mediaKey: MediaKey;
  grade: Grade;
  /** Künye yalnızca bir bölümde öne çıkar. */
  feature?: 'roster';
};

/**
 * 🔴 DOĞRULANMADI — doğrulama kuyruğu, asset dosyası §0.2 ve §7.6.
 * Okul, aktivitelerin saatlerini henüz doğrulamadı. Bu bayrak false
 * olduğu sürece hiçbir bölüm gerçek bir saat iddia etmez; bunun yerine
 * sahne sırası ("Sahne 01" vb.) gösterilir. Saatler doğrulanıp bu dosyaya
 * girildiğinde bayrağı true yapmak, sayfanın tamamını gerçek saatlere
 * geçirir — tek noktadan.
 */
export const SCHEDULE_READY = false;

/**
 * ✅ DOĞRULANDI — okul yönetimi, 1 Ağustos 2026.
 * Sınıf mevcudu 13, her sınıfta iki öğretmen. MEB yönetmeliğinin dört yaş
 * üstü gruplar için izin verdiği üst sınır öğretmen başına 20 çocuktur;
 * bizde öğretmen başına 6-7 çocuk düşer. Sayı değişirse tek yer burasıdır.
 */
export const ROSTER_STATUS: { ready: boolean; childCount: number; teacherCount: number; limit: number } = {
  ready: true,
  childCount: 13,
  teacherCount: 2,
  limit: 20,
};

/**
 * ✅ DOĞRULANDI — okul yönetimi, 1 Ağustos 2026.
 * İngilizce öğretmeni anadili İngilizce olan bir öğretmendir ve her çocuk
 * her gün iki saat İngilizce görür. Günlük doz bu kadar yüksek olduğu için
 * mezuniyette konuşma çıktısı sayfalarda iddia edilebiliyor.
 */
export const ENGLISH_COVERAGE_READY = true;

/** Günlük İngilizce süresi (saat). Metinlerde tek kaynak budur. */
export const ENGLISH_HOURS_PER_DAY = 2;

export const DAY_CHAPTERS: DayChapter[] = [
  {
    id: 'karsilama',
    time: '07:00',
    title: 'Kapı açılıyor',
    lead: 'Gün, çocuğun kendi hızında başlar.',
    body: [
      'İlk gelen çocuk sabahın en sessiz saatini yakalar; ayrılık bu saatte en kolay geçer.',
      'Sonrasında geçen süre serbesttir. Kimse oyuna zorlanmaz, kimse uyandırılmaz.',
    ],
    mediaKey: 'giraffesGarden',
    grade: 'dawn',
  },
  {
    id: 'sabah-cemberi',
    time: '09:00',
    title: 'Sabah çemberi',
    lead: 'Herkes bir aradadır. Gün burada planlanır.',
    body: [
      'Sınıfın tamamı bu çemberde toplanır: kim ne yapacak, hangi atölye açık, bahçeye ne zaman çıkılacak burada konuşulur.',
      'Sınıfta on üç çocuk var ve iki öğretmen birden. Yani çemberde söz sırası herkese geliyor — kimse konuşmadan güne başlamıyor.',
    ],
    mediaKey: 'outdoorClass',
    grade: 'morning',
    feature: 'roster',
  },
  {
    id: 'calisma-saati',
    time: '10:00',
    title: 'Çalışma saati',
    lead: 'Montessori: çocuk seçer, öğretmen gözler.',
    body: [
      'Materyaller açık raflarda, çocuğun boyunda durur. Bir çalışmayı seçmek, bitirmek ve yerine kaldırmak çocuğun sorumluluğundadır.',
      'Öğretmen araya girmiyor, izliyor. Bir çocuk takıldığında yanına gidebiliyor — çünkü sınıfta ikinci bir öğretmen daha var.',
    ],
    mediaKey: 'gardenWorkshops',
    grade: 'morning',
  },
  {
    id: 'ingilizce',
    time: '11:00',
    title: 'İngilizce',
    lead: 'Her gün iki saat, anadili İngilizce olan bir öğretmenle.',
    body: [
      'Çocuğunuz her gün iki saatini anadili İngilizce olan öğretmeniyle geçiriyor. Haftada bir iki ders değil; her gün, aynı saatte, aynı öğretmenle.',
      'Bu saatlerde Türkçeye dönülmüyor. Çocuk önce anlıyor, sonra tek kelimelerle karşılık veriyor, en sonunda cümle kuruyor. Aceleye getirilmiyor.',
      'Mezun olan çocuklarımız İngilizce konuşuyor. Bunun sihirli bir yöntemi yok — günde iki saatin üç yıl boyunca birikmesi.',
    ],
    mediaKey: 'outdoorClass',
    grade: 'morning',
  },
  {
    id: 'bahce',
    time: '11:45',
    title: 'Bahçe',
    lead: 'Hava ne olursa olsun, dışarı çıkılır.',
    body: [
      'Bahçe zamanı programın en az müdahale edilen bölümüdür. Çocuklar kendi oyununu kurar; öğretmen gözler, gerektiğinde araya girer.',
      'Bahçe kapalı ve gözetim altındadır.',
    ],
    mediaKey: 'gardenWide',
    grade: 'midday',
  },
  {
    id: 'ogle',
    time: '12:30',
    title: 'Öğle',
    lead: 'Sofra da bir çalışma alanıdır.',
    body: [
      'Çocuklar kendi tabağını taşır, kendi suyunu koyar, sofrayı birlikte toplar. Öz bakım becerileri ayrı bir ders değil, günün doğal bir parçasıdır.',
    ],
    mediaKey: 'mudKitchen',
    grade: 'midday',
  },
  {
    id: 'dinlenme',
    time: '13:15',
    title: 'Dinlenme',
    lead: 'Küçük gruplar dinlenir, büyükler sessiz çalışır.',
    body: [
      'Küçük yaş gruplarında bu saat dinlenmeye ayrılır.',
      'Uyumayan gruplar için bu saat sessiz çalışma zamanıdır: kitap, yapboz, bireysel proje.',
    ],
    mediaKey: 'gardenWorkshops',
    grade: 'midday',
  },
  {
    id: 'atolye',
    time: '15:00',
    title: 'Atölye',
    lead: 'Robotik, seramik, satranç, müzik, drama.',
    body: [
      'Atölyeler eğlence molası değil, programın parçasıdır. Satranç sırasını beklemeyi ve bir sonraki adımı düşünmeyi çalıştırır; hamur ve kalem işi el kaslarını yazıya hazırlar.',
    ],
    mediaKey: 'mudKitchen',
    grade: 'golden',
  },
  {
    id: 'cikis',
    time: '17:00',
    title: 'Çıkış',
    lead: 'Günün anlatıldığı an.',
    body: [
      'Her çocuk alınırken öğretmeni size o günü anlatır: ne yaptı, neyi zor buldu, neye ilk kez cesaret etti.',
      'Zaten gün içinde merak ettiyseniz kameradan bakmışsınızdır. Çıkışta konuştuğumuz şey, gördüğünüzün arkasındaki hikâye oluyor.',
    ],
    mediaKey: 'candyCorner',
    grade: 'dusk',
  },
  {
    id: 'kapanis',
    time: '19:00',
    title: 'Kapanış',
    lead: 'Son çocuk da alındığında gün biter.',
    body: [
      'Geç kalan veliler için telaş yoktur; çalışan ailelerin gerçeğine göre planlanmış bir gündür.',
    ],
    mediaKey: 'giraffes',
    grade: 'dusk',
  },
];

export function getChapter(id: string): DayChapter | undefined {
  return DAY_CHAPTERS.find((chapter) => chapter.id === id);
}

/**
 * Bir bölüm için sayfada gösterilecek TEK zaman göstergesi budur.
 * SCHEDULE_READY false iken gerçek saat asla dönmez; bunun yerine
 * kronolojik sahne sırası döner. TimeSpine ve sayfa yalnızca bunu okur.
 */
export function chapterLabel(chapter: DayChapter): string {
  if (SCHEDULE_READY) return chapter.time;
  const index = DAY_CHAPTERS.findIndex((c) => c.id === chapter.id);
  return `Sahne ${String(index + 1).padStart(2, '0')}`;
}
