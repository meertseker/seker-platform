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
 * ✅ DOĞRULANDI — okul yönetimi, 1 Ağustos 2026; mevcut Ekim 2026'da okulun
 * kendi düzenlemesiyle 15'e çıktı ("Sınıf mevcutlarımızı 15 öğrenciyle sınırlıyoruz").
 * Her sınıfta iki öğretmen. MEB yönetmeliğinin dört yaş üstü gruplar için izin
 * verdiği üst sınır öğretmen başına 20 çocuktur. Metinlerde "öğretmen başına N
 * çocuk" hesabı yazılmaz; "sınıfta iki öğretmen" anlatılır. Sayı değişirse tek
 * yer burasıdır.
 */
export const ROSTER_STATUS: { ready: boolean; childCount: number; teacherCount: number; limit: number } = {
  ready: true,
  childCount: 15,
  teacherCount: 2,
  limit: 20,
};

/**
 * ✅ DOĞRULANDI — okul yönetimi, 1 Ağustos 2026.
 * Her çocuk her gün İngilizce görür. Süre (saat) artık metinlerde yazılmaz;
 * okul Ekim 2026'da "3 kişilik uzman İngilizce kadromuzla yabancı dili her
 * güne yayıyoruz" çizgisine geçti.
 */
export const ENGLISH_COVERAGE_READY = true;

/**
 * Günlük İngilizce süresi (saat). ⚠️ Okul Ekim 2026'da "her gün 2 saat" ifadesini
 * sitedeki metinlerinden kaldırdı ("5 gün / İngilizce", "3 kişilik uzman İngilizce
 * kadromuzla yabancı dili her güne yayıyoruz"). Yeni metinde kullanılmaz; yalnızca
 * prod'da okulun üzerine yazdığı eski varsayılanlarda duruyor.
 */
export const ENGLISH_HOURS_PER_DAY = 2;

/** İngilizce kadrosundaki uzman eğitmen sayısı (okulun kendi metni, Ekim 2026). */
export const ENGLISH_TEACHER_COUNT = 3;

export const DAY_CHAPTERS: DayChapter[] = [
  {
    id: 'karsilama',
    time: '07:30',
    title: 'Karşılama',
    lead: 'Gün, her çocuğun kendi temposunda başlar.',
    body: [
      'Kapı sabah erken açılır. İlk gelen çocuk günün en sessiz saatini yakalar; ayrılık bu saatte en kolay geçer.',
      'Sonrasında geçen süre serbesttir. Kimse oyuna zorlanmaz, kimse acele ettirilmez.',
    ],
    mediaKey: 'giraffesGarden',
    grade: 'dawn',
  },
  {
    id: 'sabah-cemberi',
    time: '09:00',
    title: 'Sabah çemberi',
    lead: 'Sınıf bir araya gelir, gün birlikte planlanır.',
    body: [
      'Kim ne çalışacak, hangi branş dersi var, bahçeye ne zaman çıkılacak — hepsi bu çemberde konuşulur.',
      'Sınıf mevcudumuz sınırlı ve her sınıfta iki öğretmen birden görev yapıyor. Bu yüzden çemberde söz sırası herkese geliyor; hiçbir çocuk konuşmadan güne başlamıyor.',
    ],
    mediaKey: 'outdoorClass',
    grade: 'morning',
    feature: 'roster',
  },
  {
    id: 'calisma-saati',
    time: '10:00',
    title: 'Montessori çalışma saati',
    lead: 'Çocuk seçer, kendi hızında çalışır; öğretmen gözler.',
    body: [
      'Montessori çalışması haftanın beş günü programda. Materyaller açık raflarda, çocuğun boyunda durur: günlük yaşam, duyusal çalışmalar, dil, matematik, dikkat ve konsantrasyon.',
      'Bir çalışmayı seçmek, bitirmek ve yerine kaldırmak çocuğun sorumluluğundadır. Öğretmen araya girmez, izler; bir çocuk takıldığında yanına gider.',
    ],
    mediaKey: 'gardenWorkshops',
    grade: 'morning',
  },
  {
    id: 'ingilizce',
    time: '11:00',
    title: 'İngilizce',
    lead: 'Haftada birkaç ders değil, her gün aynı saatte.',
    body: [
      'İngilizce çalışmaları oyun, şarkı, hikâye ve günlük iletişimin içinden yürür. Çocuk önce anlar, sonra tek kelimelerle karşılık verir, en sonunda cümle kurar.',
      'English Play Time ve English Kids Club etkinliklerinde dil ders masasından çıkar; Speaking çalışmalarında öğrendiği ifadeleri konuşurken kullanır.',
    ],
    mediaKey: 'outdoorClass',
    grade: 'morning',
  },
  {
    id: 'bahce',
    time: '11:45',
    title: 'Bahçe',
    lead: 'İki bahçemiz var; hava elverdiği sürece dışarıdayız.',
    body: [
      'Bahçe zamanı programın en az müdahale edilen bölümüdür. Çocuklar kendi oyununu kurar, öğretmen gözler ve gerektiğinde araya girer.',
      'Geniş metrekare şunu değiştiriyor: koşmak isteyen çocuk için sıra beklemek gerekmiyor. Bahçeler kapalı ve gözetim altında.',
    ],
    mediaKey: 'gardenWide',
    grade: 'midday',
  },
  {
    id: 'ogle',
    time: '12:30',
    title: 'Öğle',
    lead: 'Sofra da bir çalışma alanı.',
    body: [
      'Çocuklar kendi tabağını taşır, kendi suyunu koyar, sofrayı birlikte toplar.',
      'Günlük yaşam becerileri ayrı bir ders değil; Montessori çalışmasının sofrada devam eden hâli.',
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
      'Küçük yaş gruplarında bu saat dinlenmeye ayrılır. Yarım gün programını seçen çocuklar bu saatte okuldan ayrılır.',
      'Uyumayan gruplar için bu saat sessiz çalışma zamanı: kitap, yapboz, bireysel proje.',
    ],
    mediaKey: 'gardenWorkshops',
    grade: 'midday',
  },
  {
    id: 'atolye',
    time: '15:00',
    title: 'Branş dersleri',
    lead: 'Seramik, robotik, satranç, müzik, dans, drama.',
    body: [
      'Branş dersleri eğlence molası değil, programın parçası. Her biri alanında uzman bir öğretmenle yürüyor.',
      'Satranç sırasını beklemeyi ve bir sonraki hamleyi düşünmeyi çalıştırır. Seramik çamuru ve kalem işi el kaslarını yazıya hazırlar. Robotikte çocuk kendi kurduğu robota komut yazar.',
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
      'Gün içinde merak ettiyseniz kameradan bakmışsınızdır. Çıkışta konuştuğumuz şey, gördüğünüzün arkasındaki hikâye oluyor.',
    ],
    mediaKey: 'candyCorner',
    grade: 'dusk',
  },
  {
    id: 'kapanis',
    time: '18:30',
    title: 'Kapanış',
    lead: 'Son çocuk da alındığında gün biter.',
    body: [
      'Geç kalan veliler için telaş yoktur; gün, çalışan ailelerin gerçeğine göre planlanmıştır.',
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
export function chapterLabel(chapter: Pick<DayChapter, 'id' | 'time'>, scenePrefix = 'Sahne'): string {
  if (SCHEDULE_READY) return chapter.time;
  const index = DAY_CHAPTERS.findIndex((c) => c.id === chapter.id);
  return `${scenePrefix} ${String(index + 1).padStart(2, '0')}`;
}
