import { ROSTER_STATUS } from '@/content/day';
import { CAMPUS, MONTESSORI_DAYS_PER_WEEK, SUPPORT } from '@/content/program';
import type { SlotDef } from '../types';
import { limitFor, limitForField } from './limits';

const text = (label: string, def: string, heading = false): SlotDef => ({
  kind: 'text', label, default: def, max: limitFor(def, heading),
});

/**
 * Değerler, okulun kendi tanıtım metnindeki üçlüden gelir: "sevgi, güven ve
 * aidiyet duygusunu merkeze alan bir okul ortamı". Dördüncüsü, Montessori
 * çalışmasının hedefi olarak aynı metinde geçen bağımsızlık.
 * Simge rengi ve çizimi (chip/path) görünümdedir, id ile eşlenir; düzenlenmez.
 */
const VALUES = [
  {
    id: 'sevgi',
    title: 'Sevgi',
    description:
      'Çocuğun kendini burada değerli hissetmesi, öğrenmenin ön koşulu. Her şeyden önce bunu kuruyoruz.',
  },
  {
    id: 'guven',
    title: 'Güven',
    description:
      'Çıkışta öğretmeni size günü anlatır, gün içinde merak ettiğinizde bakabilirsiniz. Anlatmadığımız bir şey olmuyor.',
  },
  {
    id: 'aidiyet',
    title: 'Aidiyet',
    description:
      'Çocuk kendi sınıfını, kendi öğretmenini ve kendi köşesini tanır. Yıl ortasında öğretmen değiştirmiyoruz.',
  },
  {
    id: 'bagimsizlik',
    title: 'Bağımsızlık',
    description:
      'Montessori çalışmasının hedefi bu: çocuk kendi işini seçsin, kendi hızında bitirsin, yerine kaldırsın.',
  },
];

/** Doğrulanabilir künye — okulun yaşı ve fiziksel alanı. Yıl belirteçleri okul bilgisinden doldurulur. */
const FACTS = [
  { id: 'kurulus', value: '{kurulusYili}', label: 'Kuruluş yılı' },
  { id: 'yil', value: '{yilSayisi} yıl', label: 'Aynı bölgede' },
  { id: 'bina', value: String(CAMPUS.buildings), label: 'Ayrı bina' },
  { id: 'bahce', value: String(CAMPUS.gardens), label: 'Büyük bahçe' },
];

export const HAKKIMIZDA_SLOTS: Record<string, SlotDef> = {
  'meta.hakkimizda.title': { kind: 'text', label: 'Sayfa başlığı (Google)', default: 'Hakkımızda', max: 70 },
  'meta.hakkimizda.description': {
    kind: 'text', label: 'Sayfa açıklaması (Google)', max: 160,
    default: "Beykent bölgesinin en köklü anaokullarından biri. {kurulusYili}'den beri iki binamız ve iki büyük bahçemizle 2-6 yaş çocuklara Montessori temelli okul öncesi eğitim.",
  },

  'hakkimizda.hero.eyebrow': text('Üst etiket', "{kurulusYili}'den beri Beykent'te"),
  'hakkimizda.hero.title': text('Ana başlık', "Beykent'in en köklü anaokullarından biriyiz.", true),
  'hakkimizda.hero.lead': text(
    'Giriş metni',
    'Yıllara dayanan eğitim deneyimimizi, çocukları tanıyan ve her çocuğun kendini değerli hissettiği bir okul anlayışıyla sürdürüyoruz. Çocukların akademik gelişiminin yanı sıra sosyal, duygusal ve bilişsel gelişimlerini de destekliyoruz.',
  ),
  'hakkimizda.facts': {
    kind: 'list', label: 'Künye kartları', fixedItems: true, maxItems: 4, default: FACTS,
    fields: {
      value: { kind: 'text', max: 20, label: 'Değer' },
      label: { kind: 'text', max: limitForField(FACTS, 'label'), label: 'Etiket' },
    },
  },
  'hakkimizda.psychologist.title': text('Psikolog bölümü başlığı', 'Okulumuzda uzman psikolog görev yapıyor', true),
  'hakkimizda.psychologist.lead': text('Psikolog bölümü ana metin', SUPPORT.psychologist),
  'hakkimizda.psychologist.note': text(
    'Psikolog bölümü ek metin',
    'Uyum dönemi, kardeş kıskançlığı, tuvalet eğitimi ya da uyku düzeni gibi başlıklarda evde ve okulda tutarlı bir yaklaşım kurmak için sizinle birlikte çalışıyoruz.',
  ),
  'hakkimizda.values.title': text('Değerler başlığı', 'Değerlerimiz', true),
  'hakkimizda.values.lead': text(
    'Değerler giriş metni',
    'Sevgi, güven ve aidiyet duygusunu merkeze alan bir okul ortamı kurmaya çalışıyoruz. Montessori yaklaşımımız ve branş derslerimizle çocukların özgüvenlerini, yeteneklerini ve bağımsızlıklarını destekliyoruz.',
  ),
  'hakkimizda.values': {
    kind: 'list', label: 'Değerlerimiz', fixedItems: true, maxItems: 8, default: VALUES,
    fields: {
      title: { kind: 'text', max: 30, label: 'Başlık' },
      description: { kind: 'text', max: Math.min(200, limitForField(VALUES, 'description')), label: 'Açıklama' },
    },
  },
  'hakkimizda.visit.title': text('Form başlığı', 'Okulu gezmeye gelin', true),
  'hakkimizda.visit.lead': text(
    'Form üstü metin',
    `Haftanın ${MONTESSORI_DAYS_PER_WEEK} günü Montessori çalışıyoruz. Randevunuzu çalışma saatine alalım, sınıfı iş üstünde görün.`,
  ),

  // AboutSection bileşeninin iki örneği (about.<örnek>.*).
  'about.garden.title': text('Bahçe bölümü başlığı', 'İki binamız, iki büyük bahçemiz var', true),
  'about.garden.description': text(
    'Bahçe bölümü metni',
    'Geniş metrekareye sahip iki bahçemizle çocukların özgürce hareket edebildiği, keşfedebildiği ve doğayla iç içe vakit geçirebildiği ferah bir eğitim ortamı sunuyoruz. Bahçeleri yıllar içinde kendimiz kurduk: ahşap oyun mutfağı, açık hava sınıfı, denge yolu, dev satranç tahtası ve ağacın etrafındaki oturma bankı. Çocuklar günün büyük bölümünü burada geçiriyor.',
  ),
  'about.garden.button': text('Bahçe bölümü düğmesi', 'Bir günümüzü görün'),
  'about.staff.title': text('Kadro bölümü başlığı', 'Kadromuz ve sınıflarımız', true),
  'about.staff.description': text(
    'Kadro bölümü metni',
    `Kendi alanında deneyimli ve uzman bir eğitim kadrosuyla her çocuğun bireysel gelişimini yakından takip ediyoruz. ${SUPPORT.classPlacement} Sınıf mevcudumuzu ${ROSTER_STATUS.childCount} çocukla sınırlıyoruz ve her sınıfta iki öğretmen bulunuyor; branş derslerinin her biri alanında uzman bir öğretmenle yürüyor.`,
  ),
  'about.staff.button': text('Kadro bölümü düğmesi', 'Branş derslerimiz'),

  // TrustBar (güven şeridi). Sınıf mevcudu ve öğretmen sayısı content/day.ts'den gelir (doğrulama kapısı).
  'trust.children.label': text('Güven şeridi: çocuk sayısı etiketi', 'Sınıfta çocuk'),
  'trust.teachers.label': text('Güven şeridi: öğretmen sayısı etiketi', 'Her sınıfta öğretmen'),
  'trust.english.value': text('Güven şeridi: İngilizce günü', '5 gün'),
  'trust.english.label': text('Güven şeridi: İngilizce etiketi', 'İngilizce'),
  'trust.years.value': text('Güven şeridi: yıl sayısı', '{yilSayisi} yıl'),
  'trust.years.label': text('Güven şeridi: yıl etiketi', "Beykent'te aynı adreste"),
};
