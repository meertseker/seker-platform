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

const CLASS_SIZE = '10 çocuk, 2 öğretmen — öğretmen başına 5 çocuk';

export const AGE_GROUPS_CONTENT: AgeGroup[] = [
  {
    slug: '2-3-yas',
    title: '2-3 Yaş Oyun Grubu',
    ageLabel: '2-3 yaş',
    headline: 'İlk ayrılık, on kişilik bir sınıfta.',
    metaTitle: '2-3 Yaş Oyun Grubu — Beykent',
    metaDescription:
      'Beykent Büyükçekmece\'de 2-3 yaş oyun grubu. 10 kişilik sınıf, iki öğretmen, kademeli uyum süreci. Çocuğunuzun ilk okul deneyimi için ön görüşme alın.',
    intro:
      'İki yaş, çocuğun aileden ilk kez ayrıldığı dönemdir. Bu yaşta önceliğimiz akademik kazanım değil, güvenli bağlanma ve kademeli uyumdur. On kişilik sınıfımızda iki öğretmen bulunması, bu yaş için tercih değil zorunluluktur.',
    focusAreas: [
      { title: 'Uyum ve bağlanma', description: 'Kademeli başlangıç planıyla ayrılık kaygısının yönetimi.' },
      { title: 'Öz bakım becerileri', description: 'Tuvalet eğitimi desteği, kendi başına yeme, el yıkama.' },
      { title: 'Duyusal oyun', description: 'Kum, su, hamur ve doku çalışmalarıyla duyusal gelişim.' },
      { title: 'Dil gelişimi', description: 'Şarkı, tekerleme ve hikâye ile kelime dağarcığının genişletilmesi; native öğretmenle İngilizceye ilk temas.' },
    ],
    dailyHighlights: ['Karşılama ve serbest oyun', 'Duyusal atölye', 'Bahçe zamanı', 'Öğle uykusu', 'Müzik ve hareket'],
    classSize: CLASS_SIZE,
    image: '/motorskills.jpg',
  },
  {
    slug: '3-4-yas',
    title: '3-4 Yaş Anaokulu',
    ageLabel: '3-4 yaş',
    headline: 'Merakın en yüksek olduğu yaş.',
    metaTitle: '3-4 Yaş Anaokulu — Beykent',
    metaDescription:
      'Beykent\'te 3-4 yaş anaokulu programı. Montessori materyalleri, İngilizce, sanat ve drama atölyeleriyle çocuğunuzun keşif dönemi.',
    intro:
      'Üç yaş, "neden" sorusunun yaşıdır. Programımız bu merakı bastırmak yerine yönlendirmek üzerine kuruludur.',
    focusAreas: [
      { title: 'Montessori çalışmaları', description: 'Bireysel hızda ilerleyen, hazırlanmış ortam çalışmaları.' },
      { title: 'Sosyal beceriler', description: 'Sıra bekleme, paylaşma, çatışma çözme.' },
      { title: 'İngilizce', description: 'Native öğretmenle günlük İngilizce — dil, ders olarak değil günün doğal parçası olarak öğrenilir.' },
      { title: 'Yaratıcı ifade', description: 'Seramik, resim ve drama atölyeleri.' },
    ],
    dailyHighlights: ['Sabah çemberi', 'Montessori çalışma saati', 'İngilizce', 'Bahçe zamanı', 'Atölye'],
    classSize: CLASS_SIZE,
    image: '/art.jpg',
  },
  {
    slug: '4-5-yas',
    title: '4-5 Yaş Anaokulu',
    ageLabel: '4-5 yaş',
    headline: 'Bilişsel sıçramanın yılı.',
    metaTitle: '4-5 Yaş Anaokulu — Beykent',
    metaDescription:
      'Beykent\'te 4-5 yaş anaokulu. Robotik kodlama, satranç, matematik ve okuma yazmaya hazırlık çalışmalarıyla zenginleştirilmiş program.',
    intro:
      'Dört yaş, soyut düşüncenin filizlendiği dönemdir. Program bu yaşta problem çözme ve mantıksal düşünmeye ağırlık verir.',
    focusAreas: [
      { title: 'Robotik ve kodlama', description: 'Algoritmik düşünmenin oyunla temellendirilmesi.' },
      { title: 'Satranç', description: 'Planlama, sonuç öngörme ve odaklanma becerileri.' },
      { title: 'Matematik temelleri', description: 'Sayı, örüntü, ölçme ve geometri çalışmaları.' },
      { title: 'Bilim atölyesi', description: 'Deney ve gözlem yoluyla neden-sonuç ilişkisi.' },
    ],
    dailyHighlights: ['Sabah çemberi', 'Bilim veya robotik atölyesi', 'İngilizce', 'Satranç', 'Bahçe zamanı'],
    classSize: CLASS_SIZE,
    image: '/robotic.jpg',
  },
  {
    slug: '5-6-yas',
    title: '5-6 Yaş İlkokula Hazırlık',
    ageLabel: '5-6 yaş',
    headline: 'İlkokula hazır, ama çocukluğundan ödün vermeden.',
    metaTitle: '5-6 Yaş İlkokula Hazırlık Sınıfı — Beykent',
    metaDescription:
      'Beykent\'te 5-6 yaş ilkokula hazırlık sınıfı. Okuma yazmaya hazırlık, dikkat ve odaklanma çalışmaları, ilkokul geçiş programı.',
    intro:
      'Bu yaşta hedef okuma yazma öğretmek değil, ilkokulda ihtiyaç duyulacak dikkat süresini, kalem tutuşunu ve öğrenme alışkanlığını kurmaktır.',
    focusAreas: [
      { title: 'Okuma yazmaya hazırlık', description: 'Ses farkındalığı, çizgi ve kalem tutuş çalışmaları.' },
      { title: 'Dikkat ve odaklanma', description: 'Süresi kademeli uzayan bireysel çalışma seansları.' },
      { title: 'Sorumluluk', description: 'Görev alma, kendi eşyasını yönetme, plan takibi.' },
      { title: 'İngilizce', description: 'Mezun olan çocuklarımız İngilizce konuşuyor. Bu, native öğretmenimizin dört yıl boyunca günün doğal parçası olmasının sonucudur.' },
    ],
    dailyHighlights: ['Sabah çemberi', 'Hazırlık çalışması', 'İngilizce', 'Proje saati', 'Bahçe zamanı'],
    classSize: CLASS_SIZE,
    image: '/satranc.jpg',
  },
];

export function getAgeGroup(slug: string): AgeGroup | undefined {
  return AGE_GROUPS_CONTENT.find((group) => group.slug === slug);
}
