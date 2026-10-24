import type { SlotDef } from '../types';
import { limitFor } from './limits';

const text = (label: string, def: string, heading = false): SlotDef => ({
  kind: 'text', label, default: def, max: limitFor(def, heading),
});

/** Form sonrası teşekkür sayfası (arama motorlarına kapalı; yalnızca başlık meta'sı var). */
export const TESEKKURLER_SLOTS: Record<string, SlotDef> = {
  'meta.tesekkurler.title': { kind: 'text', label: 'Başlık (tarayıcı sekmesi)', default: 'Talebiniz Alındı', max: 70 },

  'tesekkurler.hero.eyebrow': text('Üst etiket', 'Teşekkürler'),
  'tesekkurler.hero.title': text('Ana başlık', 'Talebiniz bize ulaştı.', true),
  'tesekkurler.hero.lead': text(
    'Giriş metni',
    'Okul yönetimimiz en geç 15 dakika içinde sizi arayacak ve ön görüşme randevunuzu birlikte planlayacağız.',
  ),
  'tesekkurler.lead': text('Doğrudan ulaşım cümlesi', 'Acele bir sorunuz varsa doğrudan ulaşabilirsiniz:'),
  'tesekkurler.ctaWhatsapp': text('WhatsApp düğmesi', "WhatsApp'tan Yazın"),
  'tesekkurler.home': text('Ana sayfa bağlantısı', 'Ana sayfaya dön'),
};
