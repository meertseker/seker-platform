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
 * 🔴 DOĞRULANMADI — doğrulama kuyruğu madde 1 ve 2 (asset dosyası §0.2).
 * Sınıf başına çocuk ve öğretmen sayısı okul tarafından henüz teyit
 * edilmedi. false iken künye (Roster) hiçbir yerde render edilmez ve bu
 * sayılar sayfada iddia olarak geçmez. Sayılar doğrulanınca burası
 * güncellenir ve `ready: true` yapılır — künye otomatik olarak görünür.
 */
export const ROSTER_STATUS: { ready: boolean; childCount: number; teacherCount: number; limit: number } = {
  ready: false,
  childCount: 10,
  teacherCount: 2,
  limit: 20,
};

export const DAY_CHAPTERS: DayChapter[] = [
  {
    id: 'karsilama',
    time: '07:00',
    title: 'Kapı açılıyor',
    lead: 'Gün, çocuğun kendi hızında başlar.',
    body: [
      'İlk gelen çocuk sabahın en sessiz saatini yakalar. Karşılamayı tanıdık bir yüz yapar; ayrılığın en kolay geçtiği an budur.',
      'Sonrasında geçen süre serbesttir. Kimse oyuna zorlanmaz, kimse uyandırılmaz.',
    ],
    mediaKey: 'classroomWide',
    grade: 'dawn',
  },
  {
    id: 'sabah-cemberi',
    time: '09:00',
    title: 'Sabah çemberi',
    lead: 'Herkes bir aradadır. Gün burada planlanır.',
    body: [
      'Sınıfın tamamı bu çemberde toplanır: kim ne yapacak, hangi atölye açık, bahçeye ne zaman çıkılacak burada konuşulur.',
      'Millî Eğitim Bakanlığı okul öncesi yönetmeliği, dört yaş üstü gruplarda öğretmen başına yirmi çocuğa kadar izin verir. Biz bu üst sınırın belirgin biçimde altında kalmayı tercih ediyoruz — kesin sayıyı ön görüşmede paylaşıyoruz.',
    ],
    mediaKey: 'motorSkills',
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
      'Öğretmen araya girmez, gözlemler. Bu yaklaşımın işlemesi, sınıf mevcudunun sınırlı tutulmasına bağlıdır.',
    ],
    mediaKey: 'montessori',
    grade: 'morning',
  },
  {
    id: 'ingilizce',
    time: '11:00',
    title: 'İngilizce',
    lead: 'Ders saati değil, günün dili.',
    body: [
      'İngilizce, ayrı bir ders saati değil; günün içinde kullanılan ikinci dildir. Oyunun, yemeğin ve bahçenin bir parçası olur.',
      'Öğretmenimiz İngilizceyi gün boyunca kullanır. Çocuk dili bir ders olarak değil, günlük iletişimin bir parçası olarak edinir.',
    ],
    mediaKey: 'art',
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
    mediaKey: 'sports',
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
    mediaKey: 'physicalEducation',
    grade: 'midday',
  },
  {
    id: 'dinlenme',
    time: '13:15',
    title: 'Dinlenme',
    lead: 'Küçük gruplar dinlenir, büyükler sessiz çalışır.',
    body: [
      'Küçük yaş gruplarında bu saat uykuya ayrılır; düzen evdekiyle uyumlu olacak şekilde aileyle birlikte planlanır.',
      'Uyumayan gruplar için bu saat sessiz çalışma zamanıdır: kitap, yapboz, bireysel proje.',
    ],
    mediaKey: 'psychologist',
    grade: 'midday',
  },
  {
    id: 'atolye',
    time: '15:00',
    title: 'Atölye',
    lead: 'Robotik, seramik, satranç, müzik, drama.',
    body: [
      'Atölyeler eğlence molası değil, programın parçasıdır. Satranç sırasını beklemeyi ve bir sonraki adımı düşünmeyi çalıştırır; hamur ve kalem işi el kaslarını yazıya hazırlar.',
      'Atölye grupları sınıftan da küçüktür.',
    ],
    mediaKey: 'ceramics',
    grade: 'golden',
  },
  {
    id: 'cikis',
    time: '17:00',
    title: 'Çıkış',
    lead: 'Günün anlatıldığı an.',
    body: [
      'Her çocuk alınırken öğretmeni velisine o günü anlatır: ne yaptı, neyi zor buldu, neye ilk kez cesaret etti.',
      'Bu ayrıntılı paylaşım, sınıf mevcudunun sınırlı tutulmasıyla mümkün olur.',
    ],
    mediaKey: 'dance',
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
    mediaKey: 'summer',
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
