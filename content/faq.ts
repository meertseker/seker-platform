export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  featured: boolean;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'yas-araligi',
    question: 'Anaokulunuza kaç yaş arası çocuklar kabul ediliyor?',
    answer:
      'Özel Şeker Anaokulu 2 yaşından itibaren, çocuk 5 yaşını tamamlayana kadar kabul eder. 2-3 yaş oyun grubu, 3-4 yaş, 4-5 yaş ve 5-6 yaş için ayrı sınıflarımız ve her gruba özel eğitim programlarımız vardır.',
    featured: true,
  },
  {
    id: 'sinif-mevcudu',
    question: 'Sınıf mevcudunuz ve öğretmen başına düşen çocuk sayısı nedir?',
    answer:
      'Sınıflarımızda 10 çocuk bulunur ve her sınıfta iki öğretmen görev yapar — öğretmen başına beş çocuk düşer. Millî Eğitim Bakanlığı yönetmeliği bu yaş grubunda öğretmen başına 20 çocuğa kadar izin verirken, biz bu üst sınırın dörtte biriyle çalışıyoruz.',
    featured: true,
  },
  {
    id: 'ingilizce',
    question: 'İngilizce eğitiminiz nasıl işliyor?',
    answer:
      'Çocuklarımız mezun olduğunda İngilizce konuşuyor. Bunu haftada birkaç saatlik ders ile değil, native İngilizce öğretmenimizin günlük akışın doğal parçası olmasıyla sağlıyoruz.',
    featured: true,
  },
  {
    id: 'calisma-saatleri',
    question: 'Çalışma saatleriniz nelerdir?',
    answer:
      'Hafta içi 07:15-19:15 saatleri arasında hizmet veriyoruz. Tam gün ve yarım gün seçeneklerimiz mevcuttur; yarım gün programı 07:15-13:00 arasındadır.',
    featured: true,
  },
  {
    id: 'egitim-programi',
    question: 'Eğitim yaklaşımınız nedir?',
    answer:
      'Montessori, High Scope ve Çoklu Zeka kuramlarını temel alan, oyun temelli bir program uyguluyoruz. Sanat, müzik, drama, fen, matematik ve dil gelişimi alanlarında günlük etkinlikler düzenlenir.',
    featured: true,
  },
  {
    id: 'guvenlik',
    question: 'Güvenlik önlemleriniz nelerdir?',
    answer:
      '24 saat kamera sistemi, kontrollü giriş-çıkış, yangın alarm sistemi ve ilk yardım sertifikalı personel bulunmaktadır.',
    featured: true,
  },
  {
    id: 'servis',
    question: 'Servis hizmetiniz hangi bölgeleri kapsıyor?',
    answer:
      'TODO: Gerçek güzergâhları yazın. Beykent, Büyükçekmece, Beylikdüzü gibi bölge adlarını açıkça geçirin — yerel arama görünürlüğü için kritik.',
    featured: false,
  },
  {
    id: 'yemek',
    question: 'Yemekler nerede ve nasıl hazırlanıyor?',
    answer: 'TODO: Mutfak, diyetisyen onayı, menü döngüsü bilgisini yazın.',
    featured: false,
  },
  {
    id: 'uyum-sureci',
    question: 'Uyum süreci nasıl işliyor?',
    answer: 'TODO: Kademeli başlangıç planınızı adım adım anlatın.',
    featured: false,
  },
];

export const FEATURED_FAQ = FAQ_ITEMS.filter((item) => item.featured);
