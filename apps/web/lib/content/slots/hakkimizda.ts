import { CAMPUS, MONTESSORI_DAYS_PER_WEEK } from '@/content/program';
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
  'meta.hakkimizda.title': { kind: 'text', label: 'Başlık', default: 'Hakkımızda', max: 70 },
  'meta.hakkimizda.description': {
    kind: 'text', label: 'Açıklama', max: 160,
    default: "Beykent bölgesinin en köklü anaokullarından biri. {kurulusYili}'den beri iki binamız ve iki büyük bahçemizle 2-6 yaş çocuklara Montessori temelli okul öncesi eğitim.",
  },

  'hakkimizda.hero.eyebrow': text('Üst etiket', "{kurulusYili}'den beri Beykent'te"),
  'hakkimizda.hero.title': text('Ana başlık', "Beykent'in en köklü anaokullarından biriyiz.", true),
  'hakkimizda.hero.lead': text(
    'Giriş metni',
    'Yıllara dayanan eğitim deneyimimizi, çocukları tanıyan ve her çocuğun kendini değerli hissettiği bir okul anlayışıyla sürdürüyoruz. Çocukların akademik gelişiminin yanı sıra sosyal, duygusal ve bilişsel gelişimlerini de destekliyoruz.',
  ),
  'hakkimizda.facts': {
    kind: 'list', label: 'Kartlar', fixedItems: true, maxItems: 4, default: FACTS,
    fields: {
      value: { kind: 'text', max: 20, label: 'Değer' },
      label: { kind: 'text', max: limitForField(FACTS, 'label'), label: 'Etiket' },
    },
  },
  'hakkimizda.values.title': text('Başlık', 'Değerlerimiz', true),
  'hakkimizda.values.lead': text(
    'Açıklama',
    'Sevgi, güven ve aidiyet duygusunu merkeze alan bir okul ortamı kurmaya çalışıyoruz. Montessori yaklaşımımız ve branş derslerimizle çocukların özgüvenlerini, yeteneklerini ve bağımsızlıklarını destekliyoruz.',
  ),
  'hakkimizda.values': {
    kind: 'list', label: 'Kartlar', fixedItems: true, maxItems: 8, default: VALUES,
    fields: {
      title: { kind: 'text', max: 30, label: 'Başlık' },
      description: { kind: 'text', max: Math.min(200, limitForField(VALUES, 'description')), label: 'Açıklama' },
    },
  },
  'hakkimizda.visit.title': text('Başlık', 'Okulu gezmeye gelin', true),
  'hakkimizda.visit.lead': text(
    'Açıklama',
    `Haftanın ${MONTESSORI_DAYS_PER_WEEK} günü Montessori çalışıyoruz. Randevunuzu çalışma saatine alalım, sınıfı iş üstünde görün.`,
  ),
};
