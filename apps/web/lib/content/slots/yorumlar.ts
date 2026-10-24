import type { SlotDef } from '../types';
import { limitFor, metaDescriptionMax } from './limits';

const text = (label: string, def: string, heading = false): SlotDef => ({
  kind: 'text', label, default: def, max: limitFor(def, heading),
});

const DESCRIPTION =
  "Şeker Anaokulu velilerinin deneyimleri. Beykent Büyükçekmece'de anaokulu arayan aileler için gerçek veli görüşleri.";

/** Veli yorumları sayfası. Yorumlar site geneli `testimonials.items` listesindedir. */
export const YORUMLAR_SLOTS: Record<string, SlotDef> = {
  'meta.yorumlar.title': { kind: 'text', label: 'Sayfa başlığı (Google)', default: 'Veli Yorumları', max: 70 },
  'meta.yorumlar.description': { kind: 'text', label: 'Sayfa açıklaması (Google)', default: DESCRIPTION, max: metaDescriptionMax(DESCRIPTION) },

  'yorumlar.hero.eyebrow': text('Üst etiket', 'Veli Yorumları'),
  'yorumlar.hero.title': text('Ana başlık', 'Bizi seçen ailelerin deneyimi', true),
  'yorumlar.hero.lead': text(
    'Giriş metni',
    "Beykent Büyükçekmece'de çocuğunuz için okul ararken en çok güvendiğiniz kaynak, hâlihazırda bizi tercih etmiş ailelerin deneyimidir.",
  ),
  'yorumlar.source.google': text('Kaynak etiketi: Google', 'Google İşletme Profili'),
  'yorumlar.source.form': text('Kaynak etiketi: form', 'Ön görüşme formu'),
  'yorumlar.source.yuzyuze': text('Kaynak etiketi: yüz yüze', 'Yüz yüze görüşme'),

  // Yayında yorum olmadığında görünen boş durum.
  'yorumlar.empty.title': text('Boş durum başlığı', 'Veli yorumlarımızı burada topluyoruz.', true),
  'yorumlar.empty.body': text(
    'Boş durum açıklaması',
    'Yorumları yalnızca velilerimizden yazılı onay aldıktan sonra yayımlıyoruz; bu sayfa yakında dolacak. Bu arada en güvenilir bilgi kaynağı okulumuzu bizzat görmek — sınıfları ve öğretmenlerimizle tanışmak için bir ziyaret planlayalım.',
  ),
  'yorumlar.empty.cta': text('Boş durum düğmesi', 'Okul Ziyareti Planlayın'),

  'yorumlar.cta.title': text('Form başlığı', 'Siz de gelin, okulu yerinde görün', true),
  'yorumlar.cta.lead': text('Form üstü metin', 'Sınıfları ve bahçeleri gezin, öğretmenlerimizle tanışın. Size uygun bir saat seçelim.'),

  'yorumlar.share.title': text('Paylaşım başlığı', "Şeker Anaokulu'nda veliyseniz deneyiminizi paylaşın", true),
  'yorumlar.share.lead': text(
    'Paylaşım açıklaması',
    'Google İşletme Profilimiz üzerinden bıraktığınız yorumlar diğer aileler için de yol gösterici oluyor.',
  ),
  'yorumlar.share.cta': text('Google düğmesi', "Google'da Yorum Bırakın"),
};
