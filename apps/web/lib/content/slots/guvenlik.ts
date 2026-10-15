import { SITE } from '@/lib/site';
import { SUPPORT } from '@/content/program';
import type { SlotDef } from '../types';
import { limitFor, limitForField } from './limits';

const text = (label: string, def: string, heading = false): SlotDef => ({
  kind: 'text', label, default: def, max: limitFor(def, heading),
});

/**
 * Bu sayfa daha önce sekiz adet "TODO: ... eklenecek" kartını doğrudan
 * yayında gösteriyordu. Artık yalnızca okulun doğruladığı uygulamalar
 * yazılıyor; belge gerektiren başlıklar (yangın onayı, deprem raporu,
 * hijyen protokolü, acil durum planı) sayfada iddia olarak yer almaz —
 * bunlar ön görüşmede yerinde gösterilir.
 */
const SAFETY_SECTIONS = [
  {
    id: 'kamera',
    title: 'Kamera sistemi ve veli erişimi',
    body: 'Okulun her yeri kamerayla izleniyor ve velilerimiz bu görüntülere kendileri erişebiliyor. İşten çıkmadan önce telefonu açıp çocuğunuzun ne yaptığına bakabilirsiniz. Bunu bir denetim aracı olarak değil, içiniz rahat etsin diye sunuyoruz.',
  },
  {
    id: 'bahce',
    title: 'Gözetim altındaki iki bahçe',
    body: 'Çocuklar günün büyük bölümünü bahçede geçiriyor. İki bahçemiz de kapalı ve gözetim altında; oyun alanları öğretmenin görebileceği mesafede kurulu. Çocuk kendi oyununu kurar, öğretmen gözler ve gerektiğinde araya girer.',
  },
  {
    id: 'teslim',
    title: 'Günü birlikte kapatıyoruz',
    body: 'Her çocuk alınırken öğretmeni size o günü anlatır: ne yaptı, neyi zor buldu, neye ilk kez cesaret etti. Çocuğunuzu kimin alacağı değişecekse bunu önceden bize bildirmeniz gerekiyor.',
  },
  {
    id: 'mutfak',
    title: 'Okulun kendi mutfağı',
    body: 'Yemeklerimiz okulun kendi mutfağında, her gün taze olarak hazırlanıyor. Aylık yemek listesini velilerimizle önceden paylaşıyoruz. Çocuğunuzun alerjisi ya da özel bir beslenme durumu varsa kayıt sırasında not alıyor ve mutfağa iletiyoruz.',
  },
  {
    id: 'psikolog',
    title: 'Uzman psikolog desteği',
    body: SUPPORT.psychologist,
  },
  {
    id: 'servis',
    title: 'Servis',
    body: `${SITE.areaServed.join(', ')} taraflarına servisimiz var. Güzergâh ve saatler kayıtlı ailelerin adreslerine göre şekillendiği için, adresinizin uygunluğunu ön görüşmede birlikte değerlendiriyoruz.`,
  },
];

export const GUVENLIK_SLOTS: Record<string, SlotDef> = {
  'meta.guvenlik.title': { kind: 'text', label: 'Sayfa başlığı (Google)', default: 'Güvenlik ve Sağlık', max: 70 },
  'meta.guvenlik.description': {
    kind: 'text', label: 'Sayfa açıklaması (Google)', max: 160,
    default: 'Kamera sistemi ve veli erişimi, gözetim altındaki iki bahçe, okulun kendi mutfağı ve uzman psikolog desteği. Beykent Büyükçekmece Özel Şeker Anaokulu.',
  },

  'guvenlik.hero.eyebrow': text('Üst etiket', 'Güvenlik ve Sağlık'),
  'guvenlik.hero.title': text('Ana başlık', 'Çocuğunuzun güvenliği, tesadüfe bırakılmaz.', true),
  'guvenlik.hero.lead': text(
    'Giriş metni',
    'Aşağıda okulumuzda her gün işleyen güvenlik ve sağlık uygulamalarını bulacaksınız. Yangın, deprem ve acil durum belgelerimizi ise ön görüşmede yerinde gösteriyoruz — bir web sayfasında okuduğunuz cümle yerine belgenin kendisini görmeniz daha anlamlı.',
  ),
  'guvenlik.sections': {
    kind: 'list', label: 'Güvenlik ve sağlık uygulamaları', fixedItems: true, maxItems: 12, default: SAFETY_SECTIONS,
    fields: {
      title: { kind: 'text', max: limitForField(SAFETY_SECTIONS, 'title'), label: 'Başlık' },
      body: { kind: 'text', max: limitForField(SAFETY_SECTIONS, 'body'), label: 'Açıklama' },
    },
  },
  'guvenlik.cta.title': text('Form başlığı', 'Güvenlik uygulamalarımızı yerinde inceleyin', true),
  'guvenlik.cta.lead': text(
    'Form üstü metin',
    'Ön görüşmede binayı birlikte gezip giriş-çıkış düzenini, bahçeleri ve belgelerimizi gözden geçirebiliriz.',
  ),
};
