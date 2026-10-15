import type { SlotDef } from '../types';
import { limitFor } from './limits';

const text = (label: string, def: string, heading = false): SlotDef => ({
  kind: 'text', label, default: def, max: limitFor(def, heading),
});

const BOOKING_NOTE = 'Sınıf mevcudumuz sınırlı olduğu için kayıtları dönem başında kapatıyoruz.';

/** Yaş grupları listesi ve alt sayfaları. Grup içerikleri `ageGroups.items` listesindedir (lists.ts). */
export const YASGRUPLARI_SLOTS: Record<string, SlotDef> = {
  'meta.yasgruplari.title': { kind: 'text', label: 'Sayfa başlığı (Google)', default: 'Yaş Grupları', max: 70 },
  'meta.yasgruplari.description': {
    kind: 'text', label: 'Sayfa açıklaması (Google)', max: 160,
    default:
      'Özel Şeker Anaokulu\'nda 2 yaşından ilkokula hazırlığa kadar dört yaş grubu: 2-3 yaş oyun grubu, 3-4 yaş, 4-5 yaş ve 5-6 yaş sınıfları.',
  },

  'yasgruplari.hero.eyebrow': text('Üst etiket', '2 yaştan ilkokula hazırlığa'),
  'yasgruplari.hero.title': text('Ana başlık', 'Her yaşın kendi programı, kendi sınıfı var.', true),
  'yasgruplari.hero.lead': text(
    'Giriş metni',
    'Sınıflarımızı çocukların doğum yıllarını ve aylarını dikkate alarak oluşturuyor, gelişim dönemlerine uygun bir eğitim süreci planlıyoruz. Çocuğunuzun grubuna tıklayarak o yaşa özel programı ve günün akışını inceleyin.',
  ),
  'yasgruplari.card.cta': text('Kart bağlantı yazısı', 'Programı incele'),
  'yasgruplari.cta.title': text('Form başlığı', 'Çocuğunuzun yaş grubu için kontenjan sorun', true),
  'yasgruplari.cta.lead': text('Form üstü metin', BOOKING_NOTE),

  // Alt sayfaların (2-3-yas, 3-4-yas …) ortak etiketleri.
  'yasgrubu.classSize.label': text('Sınıf mevcudu etiketi', 'Sınıf mevcudu:'),
  'yasgrubu.focus.suffix': text('Odak alanları başlığı (yaş etiketinden sonra gelir)', 'programında odak alanlarımız', true),
  'yasgrubu.flow.title': text('Günün akışı başlığı', 'Günün akışından', true),
  'yasgrubu.flow.cta': text('Günlük akış bağlantı yazısı', 'Tam günlük akışı görün'),
  'yasgrubu.cta.suffix': text('Form başlığı (yaş etiketinden sonra gelir)', 'kontenjanımızı sorun', true),
  'yasgrubu.cta.lead': text('Form üstü metin', BOOKING_NOTE),
};
