import { SITE } from '@/lib/site';
import { ROSTER_STATUS, ENGLISH_HOURS_PER_DAY } from '@/content/day';
import { MONTESSORI_DAYS_PER_WEEK, WEEK_DAYS } from '@/content/program';
import type { SlotDef } from '../types';
import { limitFor, limitForField } from './limits';

const text = (label: string, def: string, heading = false): SlotDef => ({
  kind: 'text', label, default: def, max: limitFor(def, heading),
});

const FEATURE_CARDS = [
  {
    id: 'taniyoruz',
    title: 'Her Çocuğu Tanıyoruz',
    description:
      'Sınıflarımızı doğum yılını ve ayını dikkate alarak oluşturuyor, her çocuğun gelişimini yakından takip ediyoruz.',
  },
  {
    id: 'montessori',
    title: `Haftanın ${MONTESSORI_DAYS_PER_WEEK} Günü Montessori`,
    description:
      'Materyaller çocuğun boyundaki açık raflarda. Ne çalışacağını kendi seçiyor, kendi hızında bitiriyor; öğretmen araya girmeden gözlemliyor.',
  },
  {
    id: 'ingilizce',
    title: 'Her Gün İngilizce',
    description: `Haftada birkaç ders değil, her gün ${ENGLISH_HOURS_PER_DAY} saat. Oyun, şarkı ve hikâyeyle başlıyor, günlük iletişimde konuşulmaya devam ediyor.`,
  },
  {
    id: 'psikolog',
    title: 'Okulda Uzman Psikolog',
    description:
      'Sosyal ve duygusal gelişimi de takip ediyoruz. İhtiyaç hâlinde randevu oluşturup bireysel görüşme desteği alabiliyorsunuz.',
  },
];

const GARDEN_SHOTS = [
  {
    id: 'mudKitchen',
    title: 'Küçük Şeflerin Mutfağı',
    note: 'Gerçek tencere, gerçek kepçe, gerçek çamur. Bulaşığı da kendileri topluyor.',
  },
  {
    id: 'outdoorClass',
    title: 'Açık Hava Sınıfı',
    note: 'Hava elverdiği sürece ders içeride değil, bu çardağın altında yapılıyor.',
  },
  {
    id: 'giraffes',
    title: 'Zürafalar',
    note: 'Okulun iki sakini. Yeni gelen her çocuk ilk gün onlarla tanışıyor.',
  },
  {
    id: 'candyCorner',
    title: 'Şeker Köşesi',
    note: 'Doğum günleri, ilk gün fotoğrafları ve mezuniyet kareleri burada çekiliyor.',
  },
];

const ASCII: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };
const weekDefault = WEEK_DAYS.map((d) => ({
  id: d.day.toLowerCase().replace(/[çğıöşü]/g, (ch) => ASCII[ch]),
  day: d.day,
  title: d.title,
  description: d.description,
}));

export const HOME_SLOTS: Record<string, SlotDef> = {
  'meta.home.title': { kind: 'text', label: 'Başlık', default: SITE.name, max: 70 },
  'meta.home.description': { kind: 'text', label: 'Açıklama', default: SITE.description, max: 160 },

  'home.hero.badge': text('Üst etiket', "Beykent'in en köklü anaokullarından biri · {kurulusYili}'den beri"),
  'home.hero.title': text('Ana başlık', 'Çocuğu tanıyan, potansiyelini keşfeden bir okul.', true),
  'home.hero.lead': text(
    'Giriş metni',
    'Her çocuğun kendine özgü olduğuna inanıyoruz. İki binamız ve geniş metrekareye sahip iki büyük bahçemizle çocukların özgürce hareket edebildiği, keşfedebildiği bir eğitim ortamı sunuyoruz.',
  ),
  'home.hero.ctaPrimary': text('Randevu düğmesi', 'Ön Görüşme Randevusu Alın'),
  'home.hero.ctaWhatsapp': text('WhatsApp düğmesi', "WhatsApp'tan Yazın"),
  'home.hero.note': text('Düğme altı not', 'Size uygun bir saat seçin. Kayıt zorunluluğu yok.'),
  'home.hero.cornerTitle': text('Fotoğraf kutusu başlığı', 'Şeker Köşesi'),
  'home.hero.cornerText': text('Fotoğraf kutusu açıklaması', 'İlk gün ve mezuniyet kareleri burada çekiliyor.'),
  'home.hero.rosterChildren': text('Sınıftaki çocuk sayısı', String(ROSTER_STATUS.childCount)),
  'home.hero.rosterChildrenLabel': text('Çocuk sayısı etiketi', 'sınıfta çocuk'),
  'home.hero.rosterTeachers': text('Öğretmen sayısı', String(ROSTER_STATUS.teacherCount)),
  'home.hero.rosterTeachersLabel': text('Öğretmen sayısı etiketi', 'öğretmen'),
  'home.hero.rosterNote': text(
    'Sınıf mevcudu notu',
    `Yönetmelik öğretmen başına ${ROSTER_STATUS.limit} çocuğa kadar izin veriyor. Sınıflarımızı doğum yılına ve ayına göre oluşturuyoruz.`,
  ),
  'home.hero.programMontessori': text('Montessori gün sayısı', `${MONTESSORI_DAYS_PER_WEEK} gün`),
  'home.hero.programMontessoriLabel': text('Montessori etiketi', 'Montessori'),
  'home.hero.programEnglish': text('İngilizce süresi', `${ENGLISH_HOURS_PER_DAY} saat`),
  'home.hero.programEnglishLabel': text('İngilizce etiketi', 'her gün İngilizce'),
  'home.hero.programNote': text(
    'Program notu',
    'Montessori ayrı bir etkinlik saati değil, haftanın her günü günün omurgası. {yilSayisi} yıldır aynı bahçede çalışıyoruz.',
  ),

  'home.testimonials.eyebrow': text('Üst etiket', 'Veli yorumları'),
  'home.testimonials.title': text('Başlık', 'Bizi seçen aileler ne diyor?', true),
  'home.testimonials.link': text('Bağlantı metni', 'Tüm yorumları okuyun'),

  'home.day.eyebrow': text('Üst etiket', 'Bir günümüz'),
  'home.day.title': text('Başlık', 'Çocuğunuz burada bütün gün ne yapıyor?', true),
  'home.day.lead': text(
    'Açıklama',
    'Velilerin bize en çok sorduğu soru bu. Karşılamadan çıkışa, günün tamamı aşağıda.',
  ),
  'home.day.link': text('Bağlantı metni', 'Günün tamamını görün'),

  'home.garden.eyebrow': text('Üst etiket', 'Bahçelerimiz'),
  'home.garden.title': text('Başlık', 'En büyük sınıfımız çatının altında değil.', true),
  'home.garden.lead': text(
    'Açıklama',
    'İki ayrı binamız ve geniş metrekareye sahip iki büyük bahçemiz var. Bahçeleri yıllar içinde kendimiz kurduk: ahşap mutfak, tamir köşesi, denge yolu, dev satranç tahtası, ağacın etrafındaki bank. Çocuklar günün büyük bölümünü burada geçiriyor.',
  ),
  'home.garden.caption': text(
    'Geniş fotoğrafın alt yazısı',
    'Ağacın etrafındaki bank, denge yolu ve açık hava sınıfı — hepsi aynı bahçede, öğretmenin görebileceği mesafede.',
  ),
  'home.garden.shots': {
    kind: 'list', label: 'Kareler', fixedItems: true, maxItems: 4, default: GARDEN_SHOTS,
    fields: {
      title: { kind: 'text', max: limitForField(GARDEN_SHOTS, 'title'), label: 'Başlık' },
      note: { kind: 'text', max: limitForField(GARDEN_SHOTS, 'note'), label: 'Açıklama' },
    },
  },

  'home.features.eyebrow': text('Üst etiket', 'Neden burası'),
  'home.features.title': text('Başlık', 'Neden Şeker Anaokulu?', true),
  'home.features.lead': text(
    'Açıklama',
    'Bizim için eğitim yalnızca öğretmek değil; çocuğu tanımak, ilgi ve yeteneklerini keşfetmesine alan açmak ve gelişimine eşlik etmek.',
  ),
  'home.features.cta': text('Randevu düğmesi', 'Ön Görüşme Randevusu Alın'),
  'home.features.cards': {
    kind: 'list', label: 'Kartlar', fixedItems: true, maxItems: 4, default: FEATURE_CARDS,
    fields: {
      title: { kind: 'text', max: limitForField(FEATURE_CARDS, 'title'), label: 'Başlık' },
      description: { kind: 'text', max: limitForField(FEATURE_CARDS, 'description'), label: 'Açıklama' },
    },
  },

  'home.activities.eyebrow': text('Üst etiket', 'Branşlar'),
  'home.activities.title': text('Başlık', 'Branş Derslerimiz', true),
  'home.activities.lead': text(
    'Açıklama',
    'Hangi çocuğun neyle açılacağını önceden bilemezsiniz. Bu yüzden programımızı farklı branş ve çalışmalarla zenginleştiriyor, her çocuğa kendi ilgi alanını bulabileceği kadar çok kapı açıyoruz.',
  ),
  'home.activities.cta': text('Bağlantı düğmesi', 'Bütün derslerin ayrıntısını görün'),

  'home.week.eyebrow': text('Üst etiket', 'Haftalık ritim'),
  'home.week.title': text('Başlık', 'Haftanın her günü çocuklar için ayrı bir şey ifade ediyor.', true),
  'home.week.lead': text(
    'Açıklama',
    'Okul yaşamını daha keyifli hâle getirmek için haftanın belirli günlerinde özel etkinlikler düzenliyoruz. Sabah çantaya ne koyacağınızı bu takvimden bakabilirsiniz.',
  ),
  'program.weekDays': {
    kind: 'list', label: 'Haftanın günleri', fixedItems: true, maxItems: 7, default: weekDefault,
    fields: {
      day: { kind: 'text', max: limitForField(weekDefault, 'day'), label: 'Gün' },
      title: { kind: 'text', max: limitForField(weekDefault, 'title'), label: 'Başlık' },
      description: { kind: 'text', max: limitForField(weekDefault, 'description'), label: 'Açıklama' },
    },
  },

  // Duyurular: veritabanındaki aktif duyurular; yoksa bölüm hiç basılmaz (düzenleme modunda yönlendirme görünür).
  'home.announcements.title': text('Başlık', 'Duyurular', true),
  'home.announcements.empty': text(
    'Duyuru yokken (yalnız düzenlemede) görünen not',
    'Henüz duyuru yok. Çubuktaki ‘Yeni duyuru’ ile ekleyin.',
  ),

  // Merak edilenler: faq.items içinde "Ana sayfada göster" işaretli sorular, kapalı akordeon.
  'home.faq.eyebrow': text('Üst etiket', 'Merak edilenler'),
  'home.faq.title': text('Başlık', 'Gelmeden önce en çok sorulanlar', true),
  'home.faqLink.label': text('Tüm sorular bağlantısı', 'Sık sorulan sorular'),

  'home.contact.eyebrow': text('Üst etiket', 'Ön görüşme'),
  'home.contact.title': text('Başlık', 'Ön Görüşme Randevusu Alın', true),
  'home.contact.lead': text(
    'Açıklama',
    'Okulu gezin, sınıfları ve bahçeleri görün, öğretmenlerimizle tanışın. Size uygun bir saat seçin; kayıt zorunluluğu yok.',
  ),
};
