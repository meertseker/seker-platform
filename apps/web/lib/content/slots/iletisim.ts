import { FULL_DAY_LABEL, HALF_DAY_LABEL } from '@/content/program';
import type { SlotDef } from '../types';
import { limitFor } from './limits';

const text = (label: string, def: string, heading = false): SlotDef => ({
  kind: 'text', label, default: def, max: limitFor(def, heading),
});

/**
 * İletişim sayfası. Sayfa açıklaması (meta) slot değildir: adres, telefon ve saatler
 * site.* alanlarından üretilir (page.tsx), böylece okul bilgileri değişince kendiliğinden güncellenir.
 */
export const ILETISIM_SLOTS: Record<string, SlotDef> = {
  'meta.iletisim.title': { kind: 'text', label: 'Sayfa başlığı (Google)', default: 'İletişim', max: 70 },

  'iletisim.hero.eyebrow': text('Üst etiket', 'İletişim'),
  'iletisim.hero.title': text('Ana başlık', 'Bize ulaşın', true),
  'iletisim.hero.lead': text(
    'Giriş metni',
    `Formu doldurun, telefon edin ya da WhatsApp'tan yazın. Hafta içi ${FULL_DAY_LABEL} saatleri arasında okulda oluyoruz; yarım gün programımız ${HALF_DAY_LABEL} arasında.`,
  ),
  // Ana sayfadaki iletişim bölümüyle aynı varsayılanlar, ayrı anahtarlar: biri değişince diğeri değişmez.
  'iletisim.contact.eyebrow': text('Form bölümü etiketi', 'Ön görüşme'),
  'iletisim.contact.title': text('Form bölümü başlığı', 'Ön Görüşme Randevusu Alın', true),
  'iletisim.contact.lead': text(
    'Form bölümü açıklaması',
    'Okulu gezin, sınıfları ve bahçeleri görün, öğretmenlerimizle tanışın. Size uygun bir saat seçin; kayıt zorunluluğu yok.',
  ),
};
