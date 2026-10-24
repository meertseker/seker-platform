import type { SlotDef } from '../types';
import { limitFor, metaDescriptionMax } from './limits';

const text = (label: string, def: string, heading = false): SlotDef => ({
  kind: 'text', label, default: def, max: limitFor(def, heading),
});

/**
 * Bu sayfa daha önce tamamen uydurma veriyle doluydu; yalnızca doğrulanabilir kanallar kaldı.
 * Kanal şeridi (band) düzenlenemez; öğretmen kanal ekleyebilir, yeni kanal mor şeritle başlar.
 */
const CHANNELS = [
  {
    id: 'cikis',
    title: 'Çıkışta, yüz yüze',
    body: 'Çocuğunuzu alırken öğretmeni o günü size anlatır: ne yaptı, neyi zor buldu, neye ilk kez cesaret etti. Günlük iletişimin ana kanalı bu.',
    band: 'band-bubble',
  },
  {
    id: 'kamera',
    title: "Gün içinde Okulcep'ten",
    body: 'Öğretmenlerimiz gün içinde Okulcep uygulaması üzerinden mesaj, fotoğraf ve video paylaşır. Çıkışta konuştuğumuz şey genelde gördüğünüzün arkasındaki hikâye oluyor.',
    band: 'band-mint',
  },
  {
    id: 'whatsapp',
    title: "WhatsApp'tan yazılı",
    body: 'Aylık yemek listesi, haftalık program ve etkinlik duyurularını veli grubundan paylaşıyoruz. Haftanın özel günlerini de buradan hatırlatıyoruz: çarşamba kitap, perşembe eşofman, cuma parti kıyafeti.',
    band: 'band-sky',
  },
];

const DESCRIPTION =
  'Aylık yemek listesi, günlük program ve gelişim raporlarını velilerimizle nasıl paylaştığımız. Beykent Büyükçekmece Özel Şeker Anaokulu.';

export const BULTENLER_SLOTS: Record<string, SlotDef> = {
  'meta.bultenler.title': { kind: 'text', label: 'Sayfa başlığı (Google)', default: 'Bültenler ve Veli İletişimi', max: 70 },
  'meta.bultenler.description': { kind: 'text', label: 'Sayfa açıklaması (Google)', default: DESCRIPTION, max: metaDescriptionMax(DESCRIPTION) },

  'bultenler.hero.eyebrow': text('Üst etiket', 'Veli İletişimi'),
  'bultenler.hero.title': text('Ana başlık', 'Çocuğunuzun günü hakkında sizi karanlıkta bırakmıyoruz.', true),
  'bultenler.hero.lead': text(
    'Giriş metni',
    'Aylık yemek listesi, günlük program ve gelişim değerlendirmesi — hepsini paylaşıyoruz. Aşağıda hangi kanalın ne işe yaradığı yazıyor.',
  ),
  'bultenler.channels': {
    kind: 'list', label: 'İletişim kanalları', maxItems: 6, default: CHANNELS,
    fixedItems: false,
    newItem: { band: 'band-grape' },
    fields: {
      title: { kind: 'text', max: 40, label: 'Kanal başlığı' },
      body: { kind: 'text', max: 300, label: 'Açıklama' },
    },
  },
  'bultenler.announcements.title': text('Duyurular başlığı', 'Duyurular', true),
  'bultenler.announcements.empty': text(
    'Duyuru yokken düzenleme modunda görünen yönlendirme',
    'Henüz duyuru yok. Çubuktaki ‘Yeni duyuru’ ile ekleyin.',
  ),
  'bultenler.request.title': text('Belge isteme başlığı', 'Belgeyi doğrudan isteyebilirsiniz.', true),
  'bultenler.request.body': text(
    'Belge isteme açıklaması',
    'Bu ayın yemek listesini, günlük program akışını ya da yaş grubunun haftalık planını görmek istiyorsanız yazın; aynı gün gönderiyoruz. Kayıtlı veli olmanız gerekmiyor.',
  ),
  'bultenler.request.ctaWhatsapp': text('WhatsApp düğmesi', "WhatsApp'tan İsteyin"),
};
