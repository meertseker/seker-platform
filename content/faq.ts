import { ROSTER_STATUS, ENGLISH_COVERAGE_READY } from './day';

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  featured: boolean;
  /** false ise cevap henüz okul tarafından doldurulmamıştır; hiçbir yerde render edilmez. */
  ready: boolean;
};

/**
 * 🔴 Doğrulama kuyruğu #3 (asset dosyası §0.2, §5.2) — öğretmenin İngilizceyi
 * gün boyunca kullandığı iddiası ENGLISH_COVERAGE_READY kapısı kapalıyken
 * eklenmez. Temel cümle (davranış temelli vaat) her zaman güvenlidir; bkz.
 * content/day.ts'nin 'ingilizce' bölümündeki aynı desen.
 */
const INGILIZCE_ANSWER = `İngilizce, ayrı bir ders saati değil; günün içinde kullanılan ikinci dildir. Mezun olurken çocuğunuz İngilizce yönergeyi çevirisiz anlıyor, kendini tanıtıyor ve tanıdık durumlarda kısa cümlelerle karşılık veriyor.${
  ENGLISH_COVERAGE_READY ? ' Öğretmenimiz İngilizceyi gün boyunca kullanır.' : ''
}`;

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'yas-araligi',
    question: 'Anaokulunuza kaç yaş arası çocuklar kabul ediliyor?',
    answer:
      'Özel Şeker Anaokulu 2 yaşından itibaren, çocuk 5 yaşını tamamlayana kadar kabul eder. 2-3 yaş oyun grubu, 3-4 yaş, 4-5 yaş ve 5-6 yaş için ayrı sınıflarımız ve her gruba özel eğitim programlarımız vardır.',
    featured: true,
    ready: true,
  },
  {
    id: 'sinif-mevcudu',
    question: 'Sınıf mevcudunuz ve öğretmen başına düşen çocuk sayısı nedir?',
    answer:
      'Sınıflarımızda 10 çocuk bulunur ve her sınıfta iki öğretmen görev yapar — öğretmen başına beş çocuk düşer. Millî Eğitim Bakanlığı yönetmeliği bu yaş grubunda öğretmen başına 20 çocuğa kadar izin verirken, biz bu üst sınırın dörtte biriyle çalışıyoruz.',
    featured: true,
    // 🔴 Doğrulama kuyruğu #1, #2 (asset dosyası §0.2) — sınıf mevcudu ve
    // öğretmen sayısı okul tarafından doğrulanana kadar bu madde ne render
    // edilir ne de FAQPage JSON-LD şemasına girer. Tek kaynak ROSTER_STATUS;
    // burada ikinci bir "ready" anahtarı icat edilmiyor.
    ready: ROSTER_STATUS.ready,
  },
  {
    id: 'ingilizce',
    question: 'İngilizce eğitiminiz nasıl işliyor?',
    answer: INGILIZCE_ANSWER,
    featured: true,
    ready: true,
  },
  {
    id: 'calisma-saatleri',
    question: 'Çalışma saatleriniz nelerdir?',
    answer:
      'Hafta içi 07:15-19:15 saatleri arasında hizmet veriyoruz. Tam gün ve yarım gün seçeneklerimiz mevcuttur; yarım gün programı 07:15-13:00 arasındadır.',
    featured: true,
    ready: true,
  },
  {
    id: 'egitim-programi',
    question: 'Eğitim yaklaşımınız nedir?',
    answer:
      'Montessori, High Scope ve Çoklu Zeka kuramlarını temel alan, oyun temelli bir program uyguluyoruz. Sanat, müzik, drama, fen, matematik ve dil gelişimi alanlarında günlük etkinlikler düzenlenir.',
    featured: true,
    ready: true,
  },
  {
    id: 'guvenlik',
    question: 'Güvenlik önlemleriniz nelerdir?',
    answer:
      '24 saat kamera sistemi, kontrollü giriş-çıkış, yangın alarm sistemi ve ilk yardım sertifikalı personel bulunmaktadır.',
    featured: true,
    ready: true,
  },
  {
    id: 'servis',
    question: 'Servis hizmetiniz hangi bölgeleri kapsıyor?',
    answer:
      'TODO: Gerçek güzergâhları yazın. Beykent, Büyükçekmece, Beylikdüzü gibi bölge adlarını açıkça geçirin — yerel arama görünürlüğü için kritik.',
    featured: false,
    ready: false,
  },
  {
    id: 'yemek',
    question: 'Yemekler nerede ve nasıl hazırlanıyor?',
    answer: 'TODO: Mutfak, diyetisyen onayı, menü döngüsü bilgisini yazın.',
    featured: false,
    ready: false,
  },
  {
    id: 'uyum-sureci',
    question: 'Uyum süreci nasıl işliyor?',
    answer: 'TODO: Kademeli başlangıç planınızı adım adım anlatın.',
    featured: false,
    ready: false,
  },
  {
    id: 'ucret-taksit',
    question: 'Ödeme planı ve taksit seçenekleriniz nelerdir?',
    answer: 'TODO: Ödeme planı ve kardeş/peşin ödeme koşullarını okuldan alıp yazın.',
    featured: false,
    ready: false,
  },
  {
    id: 'ucret-dahil',
    question: 'Yıllık ücrete yemek ve branş dersleri dahil mi?',
    answer:
      'Tam gün programımıza günlük İngilizce, tüm branş dersleri, rehberlik desteği ve eğitim materyalleri dahildir. Servis ve okul kıyafeti ayrıca fiyatlanır. Güncel ücret ve ödeme planı ön görüşmede paylaşılır.',
    featured: false,
    ready: true,
  },
];

/** Yayına hazır sorular — render edilecek ve schema'ya girecek tek liste budur. */
export const PUBLISHED_FAQ = FAQ_ITEMS.filter((item) => item.ready);

export const FEATURED_FAQ = PUBLISHED_FAQ.filter((item) => item.featured);
