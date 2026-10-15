import type { SlotDef } from '../types';
import { limitFor } from './limits';

const text = (label: string, def: string, heading = false): SlotDef => ({
  kind: 'text', label, default: def, max: limitFor(def, heading),
});

const LEAD =
  'Yaş grupları, çalışma saatleri, Montessori çalışması, branş dersleri ve ücret — okulu gezmeye gelmeden önce merak ettiklerinizin cevabı burada.';

/** SSS sayfası. Sorular site geneli `faq.items` listesindedir (ana sayfa öne çıkanları buradan seçer). */
export const SSS_SLOTS: Record<string, SlotDef> = {
  'sss.hero.eyebrow': text('Üst etiket', 'Sık sorulan sorular'),
  'sss.hero.title': text('Ana başlık', 'Velilerin en çok sorduğu sorular', true),
  'sss.hero.lead': text('Giriş metni', LEAD),
  'sss.cta.title': text('Alt bölüm başlığı', 'Cevabını bulamadığınız bir soru mu var?', true),
  'sss.cta.lead': text('Alt bölüm açıklaması', 'Arayın ya da yazın; okulu gezmeye gelmeden önce aklınızda soru kalmasın.'),
  'sss.cta.email': text('E-posta düğmesi', 'E-posta gönderin'),
};
