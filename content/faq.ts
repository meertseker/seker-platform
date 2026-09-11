import { ROSTER_STATUS, ENGLISH_HOURS_PER_DAY } from './day';

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  featured: boolean;
  /** false ise cevap henüz okul tarafından doldurulmamıştır; hiçbir yerde render edilmez. */
  ready: boolean;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'yas-araligi',
    question: 'Kaç yaşındaki çocukları kabul ediyorsunuz?',
    answer:
      'İki yaşından itibaren alıyoruz ve çocuğunuz beş yaşını tamamlayana kadar bize katılabilir. Dört ayrı grubumuz var: 2-3 yaş oyun grubu, 3-4 yaş, 4-5 yaş ve 5-6 yaş ilkokula hazırlık. Her grubun kendi sınıfı, kendi öğretmenleri ve kendi programı var.',
    featured: true,
    ready: true,
  },
  {
    id: 'sinif-mevcudu',
    question: 'Bir sınıfta kaç çocuk var?',
    answer: `Sınıflarımızda ${ROSTER_STATUS.childCount} çocuk var ve her sınıfta iki öğretmen birden bulunuyor. Yani bir öğretmene altı-yedi çocuk düşüyor. Millî Eğitim yönetmeliği bu yaş grubunda öğretmen başına ${ROSTER_STATUS.limit} çocuğa kadar izin veriyor; biz bunun çok altında kalmayı tercih ediyoruz. İkinci öğretmenin olması şu demek: bir çocuk ağladığında ya da tuvalete götürülmesi gerektiğinde sınıfın geri kalanı boşta kalmıyor.`,
    featured: true,
    ready: ROSTER_STATUS.ready,
  },
  {
    id: 'ingilizce',
    question: 'İngilizce eğitiminiz nasıl işliyor?',
    answer: `Çocuğunuz her gün ${ENGLISH_HOURS_PER_DAY} saatini anadili İngilizce olan öğretmeniyle geçiriyor. Haftada birkaç ders değil; her gün. Bu saatlerde Türkçeye dönülmüyor, çocuk dili kullanarak öğreniyor. Mezun olan çocuklarımız İngilizce konuşuyor — bunun sırrı yok, günde iki saatin yıllar içinde birikmesi.`,
    featured: true,
    ready: true,
  },
  {
    id: 'kamera',
    question: 'Çocuğumu gün içinde görebilir miyim?',
    answer:
      'Görebilirsiniz. Okulun her yeri kamerayla izleniyor ve velilerimiz bu görüntülere kendileri erişebiliyor. İşten çıkmadan önce telefonu açıp çocuğunuzun ne yaptığına bakabilirsiniz. Bunu bir denetim aracı olarak değil, içiniz rahat etsin diye sunuyoruz.',
    featured: true,
    ready: true,
  },
  {
    id: 'servis',
    question: 'Servisiniz hangi bölgelere geliyor?',
    answer:
      'Beykent, Beylikdüzü, Mimaroba, Gürpınar, Yakuplu ve Büyükçekmece taraflarına servisimiz var. Oturduğunuz sokağa göre güzergâhı ön görüşmede birlikte bakalım.',
    featured: true,
    ready: true,
  },
  {
    id: 'calisma-saatleri',
    question: 'Çalışma saatleriniz nedir?',
    answer:
      'Hafta içi sabah erkenden akşama kadar açığız. Tam gün ve yarım gün seçeneklerimiz var. Kesin saatleri ve size uygun olanı görüşmede konuşalım.',
    featured: true,
    ready: true,
  },
  {
    id: 'egitim-programi',
    question: 'Nasıl bir eğitim programı uyguluyorsunuz?',
    answer:
      'Montessori ve High Scope temelli, oyunun içinden ilerleyen bir program uyguluyoruz. Somut olarak şöyle işliyor: materyaller çocuğun boyundaki açık raflarda duruyor, çocuk ne çalışacağını kendi seçiyor, öğretmen araya girmeden izliyor. Bunun yanında müzik, drama, seramik, sanat, dans, satranç, robotik kodlama ve beden eğitimi atölyeleri var.',
    featured: true,
    ready: true,
  },
  {
    id: 'ucret',
    question: 'Ücretleriniz ne kadar?',
    answer:
      'Ücreti siteye yazmıyoruz. Sebebi şu: bir rakam tek başına neyin karşılığı olduğunu anlatmıyor ve sınıfı görmeden duyduğunuz fiyat karşılaştırma yapmanıza da yaramıyor. Gelin, okulu gezin, sonra oturup konuşalım.',
    featured: true,
    ready: true,
  },
  {
    id: 'yemek',
    question: 'Yemekler nerede hazırlanıyor?',
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
    question: 'Ödeme planınız ve taksit seçenekleriniz var mı?',
    answer: 'TODO: Ödeme planı ve kardeş/peşin ödeme koşullarını okuldan alıp yazın.',
    featured: false,
    ready: false,
  },
];

/** Yayına hazır sorular — render edilecek ve schema'ya girecek tek liste budur. */
export const PUBLISHED_FAQ = FAQ_ITEMS.filter((item) => item.ready);

export const FEATURED_FAQ = PUBLISHED_FAQ.filter((item) => item.featured);
