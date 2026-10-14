import { ROSTER_STATUS, ENGLISH_HOURS_PER_DAY } from './day';
import {
  FULL_DAY_LABEL,
  HALF_DAY_LABEL,
  MONTESSORI_DAYS_PER_WEEK,
  SUPPORT,
  YEAR_ROUND_BRANCHES,
} from './program';

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  featured: boolean;
  /** false ise cevap henüz okul tarafından doldurulmamıştır; hiçbir yerde render edilmez. */
  ready: boolean;
};

const BRANCH_NAMES = YEAR_ROUND_BRANCHES.map((branch) => branch.name).join(', ');

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'yas-araligi',
    question: 'Kaç yaş arası çocukları kabul ediyorsunuz?',
    answer: `2-6 yaş arası çocukları kabul ediyoruz. Dört grubumuz var: 2-3 yaş oyun grubu, 3-4 yaş, 4-5 yaş ve 5-6 yaş ilkokula hazırlık. ${SUPPORT.classPlacement}`,
    featured: true,
    ready: true,
  },
  {
    id: 'sinif-mevcudu',
    question: 'Bir sınıfta kaç çocuk var?',
    answer: `Sınıflarımızda ${ROSTER_STATUS.childCount} çocuk var ve her sınıfta iki öğretmen birden görev yapıyor. Millî Eğitim yönetmeliği bu yaş grubunda öğretmen başına ${ROSTER_STATUS.limit} çocuğa kadar izin veriyor; biz bunun belirgin biçimde altında kalmayı tercih ediyoruz. İkinci öğretmenin olması şu demek: bir çocuk ağladığında ya da tuvalete götürülmesi gerektiğinde sınıfın geri kalanı boşta kalmıyor.`,
    featured: true,
    ready: ROSTER_STATUS.ready,
  },
  {
    id: 'calisma-saatleri',
    question: 'Çalışma saatleriniz nedir?',
    answer: `Anaokulumuz hafta içi ${FULL_DAY_LABEL} saatleri arasında hizmet veriyor. Tam gün ve yarım gün olmak üzere iki seçeneğimiz var: tam gün ${FULL_DAY_LABEL}, yarım gün ${HALF_DAY_LABEL}. Ailelerin çalışma düzenine uygun olanı birlikte seçiyoruz.`,
    featured: true,
    ready: true,
  },
  {
    id: 'montessori',
    question: 'Montessori eğitimi haftada kaç gün uygulanıyor?',
    answer: `Montessori eğitimi okulumuzda haftanın ${MONTESSORI_DAYS_PER_WEEK} günü uygulanıyor; ayrı bir etkinlik saati değil, günün omurgası. Çocuklar günlük yaşam, duyusal çalışmalar, dil, matematik, dikkat ve konsantrasyon alanlarında özel olarak hazırlanmış materyallerle çalışıyor. Materyaller çocuğun boyundaki açık raflarda duruyor; ne çalışacağını kendisi seçiyor, öğretmen araya girmeden gözlemliyor.`,
    featured: true,
    ready: true,
  },
  {
    id: 'ingilizce',
    question: 'İngilizce eğitiminiz nasıl işliyor?',
    answer: `Çocuğunuz her gün ${ENGLISH_HOURS_PER_DAY} saatini İngilizce öğretmeniyle geçiriyor — haftada birkaç ders değil, her gün. İngilizce çalışmaları oyun, şarkı, hikâye ve günlük iletişimin içinden yürüyor. English Play Time ve English Kids Club etkinliklerinde dil ders masasından çıkıyor; Speaking çalışmalarında çocuk öğrendiği ifadeleri konuşurken kullanıyor. İngilizcenin yanında Almanca çalışmalarına da yer veriyoruz.`,
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
    id: 'ucret',
    question: 'Ücretleriniz ne kadar?',
    answer:
      'Ücreti siteye yazmıyoruz. Bir rakam tek başına neyin karşılığı olduğunu anlatmıyor; sınıfı görmeden duyduğunuz fiyat karşılaştırma yapmanıza da yaramıyor. Gelin, okulu gezin, sonra oturup konuşalım. Ücret, ödeme planı, kardeş ve peşin ödeme koşullarını ön görüşmede yazılı olarak paylaşıyoruz.',
    featured: true,
    ready: true,
  },
  {
    id: 'brans-dersleri',
    question: 'Hangi branş dersleri var?',
    answer: `Eğitim programımızı şu branş ve çalışmalarla zenginleştiriyoruz: ${BRANCH_NAMES}. Her biri alanında uzman bir öğretmenle yürüyor. Amacımız çocuğun farklı ilgi ve yetenek alanlarını denemesine fırsat sunmak — hangi çocuğun neyle açılacağını önceden bilemiyorsunuz.`,
    featured: false,
    ready: true,
  },
  {
    id: 'psikolog',
    question: 'Okulda psikolog var mı?',
    answer: `${SUPPORT.psychologist} Uyum dönemi, kardeş kıskançlığı, tuvalet eğitimi ya da uyku düzeni gibi başlıklarda evde ve okulda tutarlı bir yaklaşım kurmak için birlikte çalışıyoruz.`,
    featured: false,
    ready: true,
  },
  {
    id: 'bahce',
    question: 'Okulun bahçesi ve fiziksel alanı nasıl?',
    answer:
      'İki ayrı binamız ve geniş metrekareye sahip iki büyük bahçemiz var. Çocuklar günün önemli bir bölümünü bahçede geçiriyor: ahşap oyun mutfağı, açık hava sınıfı, denge yolu, dev satranç tahtası ve ağacın etrafındaki oturma bankı hep aynı bahçede. Bu alanı yıllar içinde kendimiz kurduk.',
    featured: false,
    ready: true,
  },
  {
    id: 'egitim-programi',
    question: 'Nasıl bir eğitim programı uyguluyorsunuz?',
    answer: `Montessori yaklaşımını merkeze alan, oyunun içinden ilerleyen bir program uyguluyoruz. Somut olarak şöyle işliyor: materyaller çocuğun boyundaki açık raflarda duruyor, çocuk ne çalışacağını kendi seçiyor, öğretmen araya girmeden gözlemliyor. Bunun üzerine branş derslerini ekliyoruz. Eğitim programımız çocukların zihinsel, sosyal, duygusal, fiziksel ve sanatsal gelişimlerini bir bütün olarak destekleyecek şekilde planlanıyor.`,
    featured: false,
    ready: true,
  },
  {
    id: 'servis',
    question: 'Servisiniz hangi bölgelere geliyor?',
    answer:
      'Beykent, Beylikdüzü, Mimaroba, Gürpınar, Yakuplu ve Büyükçekmece taraflarına servisimiz var. Oturduğunuz sokağa göre güzergâhı ön görüşmede birlikte bakalım.',
    featured: false,
    ready: true,
  },
  {
    id: 'yemek',
    question: 'Yemekler nerede hazırlanıyor?',
    answer:
      'Yemeklerimiz okulun kendi mutfağında, her gün taze olarak hazırlanıyor. Aylık yemek listesini velilerimizle önceden paylaşıyoruz; çocuğunuzun alerjisi ya da özel bir beslenme durumu varsa kayıt sırasında not alıyor ve mutfağa iletiyoruz.',
    featured: false,
    ready: true,
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
