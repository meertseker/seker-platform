import { ROSTER_STATUS, ENGLISH_HOURS_PER_DAY } from '@/content/day';
import {
  ENGLISH_TRACKS,
  FULL_DAY_LABEL,
  HALF_DAY_LABEL,
  MONTESSORI_DAYS_PER_WEEK,
  SUPPORT,
} from '@/content/program';
import { SITE } from '@/lib/site';
import type { SlotDef } from '../types';
import { limitFor, limitForField } from './limits';

const text = (label: string, def: string, heading = false): SlotDef => ({
  kind: 'text', label, default: def, max: limitFor(def, heading),
});

/**
 * Bölümler: soru başlığı + en çok dört paragraf (p1 öne çıkan paragraf). Boş paragraf basılmaz.
 * `brans` bölümünün p2 alanı yalnızca giriş cümlesidir; yıl boyu branş adları program.branches listesinden türetilip arkasına eklenir.
 */
const EGITIM_SECTIONS = [
  {
    id: 'montessori',
    question: `Montessori yaklaşımını nasıl uyguluyoruz?`,
    p1: `Montessori eğitimi okulumuzda haftanın ${MONTESSORI_DAYS_PER_WEEK} günü uygulanıyor. Ayrı bir etkinlik saati değil; günün omurgası bu.`,
    p2: 'Materyaller çocuğun boyundaki açık raflarda duruyor. Çocuk günlük yaşam, duyusal çalışmalar, dil, matematik, dikkat ve konsantrasyon alanlarında özel olarak hazırlanmış materyallerle çalışıyor. Bir işi seçmek, bitirmek ve yerine kaldırmak onun sorumluluğunda.',
    p3: `Sınıflarımızda ${ROSTER_STATUS.childCount} çocuk ve iki öğretmen bulunuyor. Bu yaklaşımın gerçekten işlemesi buna bağlı: öğretmenin her çocuğun neyle ne kadar çalıştığını gözlemleyebilmesi gerekiyor. Kalabalık bir sınıfta Montessori sözde kalır.`,
    p4: 'Bu çalışmalarla özgüven, sorumluluk, el-göz koordinasyonu, problem çözme ve odaklanma becerilerinin gelişimini destekliyoruz.',
  },
  {
    id: 'planlama',
    question: 'Çocuk günü kendisi planlayabiliyor mu?',
    p1: 'Evet. Gün, sabah çemberinde birlikte planlanır: kim ne çalışacak, hangi branş dersi var, bahçeye ne zaman çıkılacak.',
    p2: 'High Scope programının "planla-yap-değerlendir" döngüsünü bu noktada kullanıyoruz. Çocuk günün başında ne yapacağını seçiyor, seçtiği işi gerçekleştiriyor ve gün sonunda öğretmeniyle birlikte değerlendiriyor. Yaş büyüdükçe planlama süresi ve karmaşıklığı artıyor.',
    p3: 'Sonuç, yönergeyle değil kendi kararıyla harekete geçen bir çocuk. İlkokula geçişte en çok işe yarayan alışkanlıklardan biri bu.',
    p4: '',
  },
  {
    id: 'brans',
    question: 'Branş dersleri programın neresinde duruyor?',
    p1: 'Branş dersleri eğlence molası değil, programın parçası. Her biri alanında uzman bir öğretmen tarafından yürütülüyor.',
    p2: 'Programımızda şu çalışmalar yer alıyor:',
    p3: 'Bu genişliği bilerek koruyoruz. Bir çocuk satrançta açılırken bir başkası seramikte ya da dramada parlıyor; hangi çocuğun neyle açılacağını önceden bilemiyorsunuz. Programımız her birine eşit görünürlük veriyor.',
    p4: 'Bu çalışmalarla yaratıcılık, özgüven, iletişim, sosyal beceri, problem çözme, motor gelişim ve kendini ifade etme becerilerini destekliyoruz.',
  },
  {
    id: 'dil',
    question: 'Yabancı dil eğitimi nasıl işliyor?',
    p1: `Çocukların erken yaşta yabancı dil ile tanışmasını önemsiyoruz. Çocuğunuz her gün ${ENGLISH_HOURS_PER_DAY} saatini İngilizce öğretmeniyle geçiriyor — haftada birkaç ders değil, her gün aynı saatte.`,
    p2: 'İngilizce çalışmaları oyun, şarkı, hikâye, etkinlik ve günlük iletişimin içinden yürüyor. Çocuk önce anlıyor, sonra tek kelimelerle karşılık veriyor, en sonunda cümle kuruyor. Aceleye getirmiyoruz.',
    p3: 'İngilizcenin yanında Almanca çalışmalarına da yer veriyoruz.',
    p4: '',
  },
  {
    id: 'teknoloji',
    question: 'Teknoloji eğitim sürecine nasıl giriyor?',
    p1: SUPPORT.smartBoard,
    p2: 'Teknolojiyi yaş grubuna uygun ölçüde ve öğretmenin yönlendirmesiyle kullanıyoruz. Robotik & Kodlama dersinde çocuklar manyetik lego setleri ve tabletlerle kendi robotlarını kuruyor, sonra hareketlerini kodluyor.',
    p3: 'Amacımız ekran süresi eklemek değil; çocuğun neden-sonuç ilişkisi kurmasını, planlama yapmasını ve çözüm üretmesini desteklemek.',
    p4: '',
  },
  {
    id: 'duygusal',
    question: 'Sosyal ve duygusal gelişimi kim takip ediyor?',
    p1: SUPPORT.psychologist,
    p2: 'Uyum dönemi, kardeş kıskançlığı, tuvalet eğitimi ya da uyku düzeni gibi başlıklarda evde ve okulda tutarlı bir yaklaşım kurmak için sizinle birlikte çalışıyoruz.',
    p3: 'Sevgi, güven ve aidiyet duygusunu merkeze alan bir okul ortamı kurmaya çalışıyoruz. Çocuğun kendini burada değerli hissetmesi, öğrenmenin ön koşulu.',
    p4: '',
  },
];

const paragraphMax = Math.max(
  ...['p1', 'p2', 'p3', 'p4'].map((f) => limitForField(EGITIM_SECTIONS, f)),
);

const TRACK_IDS = ['play-time', 'kids-club', 'speaking'];
const tracksDefault = ENGLISH_TRACKS.map(({ name, description }, i) => ({ id: TRACK_IDS[i], name, description }));

/** Yaş kartları: adres ve vurgu rengi kodda (id ile eşlenir), yalnızca etiketler düzenlenir. */
const agesDefault = [
  { id: '2-3-yas', label: '2-3 yaş', name: 'Oyun Grubu' },
  { id: '3-4-yas', label: '3-4 yaş', name: 'Anaokulu' },
  { id: '4-5-yas', label: '4-5 yaş', name: 'Anaokulu' },
  { id: '5-6-yas', label: '5-6 yaş', name: 'İlkokula Hazırlık' },
];

export const EGITIM_SLOTS: Record<string, SlotDef> = {
  'meta.egitim.title': { kind: 'text', label: 'Sayfa başlığı (Google)', default: 'Eğitim Yaklaşımımız', max: 70 },
  'meta.egitim.description': {
    kind: 'text', label: 'Sayfa açıklaması (Google)', max: 160,
    default: `Haftanın ${MONTESSORI_DAYS_PER_WEEK} günü Montessori, alanında uzman öğretmenlerle branş dersleri ve her gün İngilizce. Beykent Büyükçekmece'de 2-6 yaş okul öncesi eğitim.`,
  },

  'egitim.hero.eyebrow': text('Üst etiket', `Montessori · Branş dersleri · ${ENGLISH_HOURS_PER_DAY} saat İngilizce`),
  'egitim.hero.title': text('Ana başlık', 'Eğitim Yaklaşımımız', true),
  'egitim.hero.lead': text(
    'Giriş metni',
    'Çocukların bireysel farklılıklarını ve ilgi alanlarını dikkate alan bir eğitim yaklaşımı benimsiyoruz. Programımız; zihinsel, sosyal, duygusal, fiziksel ve sanatsal gelişimi bir bütün olarak destekleyecek şekilde planlanıyor.',
  ),
  'egitim.sections': {
    kind: 'list', label: 'Eğitim yaklaşımı bölümleri', fixedItems: true, maxItems: 12, default: EGITIM_SECTIONS,
    fields: {
      question: { kind: 'text', max: Math.min(120, limitForField(EGITIM_SECTIONS, 'question')), label: 'Soru başlığı' },
      p1: { kind: 'text', max: paragraphMax, label: '1. paragraf (öne çıkan)' },
      p2: { kind: 'text', max: paragraphMax, label: '2. paragraf' },
      p3: { kind: 'text', max: paragraphMax, label: '3. paragraf' },
      p4: { kind: 'text', max: paragraphMax, label: '4. paragraf (boşsa gösterilmez)' },
    },
  },
  'egitim.english.title': text('İngilizce bölümü başlığı', 'İngilizce günün içinde nasıl görünüyor?', true),
  'egitim.english.tracks': {
    kind: 'list', label: 'İngilizce çalışmaları', fixedItems: true, maxItems: 6, default: tracksDefault,
    fields: {
      name: { kind: 'text', max: limitForField(tracksDefault, 'name'), label: 'Çalışma adı' },
      description: { kind: 'text', max: limitForField(tracksDefault, 'description'), label: 'Açıklama' },
    },
  },
  'egitim.ages.title': text('Yaş grubu bölümü başlığı', 'Yaş grubuna göre program', true),
  'egitim.ages.items': {
    kind: 'list', label: 'Yaş grubu kartları', fixedItems: true, maxItems: 4, default: agesDefault,
    fields: {
      label: { kind: 'text', max: 20, label: 'Yaş aralığı' },
      name: { kind: 'text', max: limitForField(agesDefault, 'name'), label: 'Grup adı' },
    },
  },
  'egitim.ages.note': text(
    'Yaş grubu altı not',
    `Tam gün ${FULL_DAY_LABEL}, yarım gün ${HALF_DAY_LABEL}. {kurulusYili}'den beri, {yilSayisi} yıldır aynı yaklaşımla ${SITE.areaServed.slice(0, 3).join(', ')} ve çevresindeki ailelere hizmet veriyoruz.`,
  ),
  'egitim.cta.title': text('Form başlığı', 'Programı yerinde görmek ister misiniz?', true),
  'egitim.cta.lead': text('Form üstü metin', 'Ders saatinde gelin; sınıfları gezip öğretmenlerimizle tanışın.'),
};
