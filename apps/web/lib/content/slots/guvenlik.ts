import { SITE } from '@/lib/site';
import { SUPPORT } from '@/content/program';
import type { SlotDef } from '../types';
import { limitFor, limitForField } from './limits';

const text = (label: string, def: string, heading = false): SlotDef => ({
  kind: 'text', label, default: def, max: limitFor(def, heading),
});

/**
 * Hakkımızda sayfasındaki güvenlik bölümü (eski /guvenlik sayfası; anahtar adları
 * okulun kayıtları kaybolmasın diye korunur). Bu bölüm daha önce sekiz adet "TODO: ... eklenecek" kartını doğrudan
 * yayında gösteriyordu. Artık yalnızca okulun doğruladığı uygulamalar
 * yazılıyor; belge gerektiren başlıklar (yangın onayı, deprem raporu,
 * hijyen protokolü, acil durum planı) sayfada iddia olarak yer almaz —
 * bunlar ön görüşmede yerinde gösterilir.
 */
const SAFETY_SECTIONS = [
  {
    id: 'kamera',
    title: 'Okulcep ile gün içinde bilgilendirme',
    body: 'Çocuğunuzun gün içindeki anlarını Okulcep uygulamamız üzerinden takip edebilirsiniz. Öğretmenlerimiz gün içinde mesaj, fotoğraf ve video paylaşarak sizi bilgilendirir.',
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
  'guvenlik.hero.eyebrow': text('Üst etiket', 'Güvenlik ve Sağlık'),
  'guvenlik.hero.title': text('Başlık', 'Çocuğunuzun güvenliği, tesadüfe bırakılmaz.', true),
  'guvenlik.sections': {
    kind: 'list', label: 'Kartlar', fixedItems: true, maxItems: 12, default: SAFETY_SECTIONS,
    fields: {
      title: { kind: 'text', max: limitForField(SAFETY_SECTIONS, 'title'), label: 'Başlık' },
      body: { kind: 'text', max: limitForField(SAFETY_SECTIONS, 'body'), label: 'Açıklama' },
    },
  },
};
