import { FULL_DAY_LABEL, HALF_DAY_LABEL } from '@/content/program';
import type { SlotDef } from '../types';
import { limitFor } from './limits';

const text = (label: string, def: string, heading = false): SlotDef => ({
  kind: 'text', label, default: def, max: limitFor(def, heading),
});

/** Günlük akış sayfası. Sahneler `day.chapters` listesindedir (lists.ts). */
export const GUNLUKAKIS_SLOTS: Record<string, SlotDef> = {
  'meta.gunlukakis.title': { kind: 'text', label: 'Başlık', default: 'Günlük Akış', max: 70 },
  'meta.gunlukakis.description': {
    kind: 'text', label: 'Açıklama', max: 160,
    default:
      "Şeker Anaokulu'nda bir gün: karşılamadan çıkışa — sabah çemberi, Montessori çalışma saati, İngilizce, bahçe ve branş dersleri. Beykent Büyükçekmece, 2-6 yaş.",
  },

  'gunlukakis.hero.eyebrow': text('Üst etiket', 'Karşılamadan çıkışa'),
  'gunlukakis.hero.title': text('Ana başlık', 'Bir günümüz', true),
  'gunlukakis.hero.lead': text(
    'Giriş metni',
    'Velilerin bize en çok sorduğu soru: "Çocuğum orada bütün gün ne yapıyor?" Cevabı aşağıda, sahne sahne.',
  ),

  'gunlukakis.plan.full.label': text('Etiket', 'Tam gün'),
  'gunlukakis.plan.full.hours': text('Saatler', FULL_DAY_LABEL),
  'gunlukakis.plan.full.note': text('Not', 'Aşağıdaki akışın tamamı bu programda yaşanıyor.'),
  'gunlukakis.plan.half.label': text('Etiket', 'Yarım gün'),
  'gunlukakis.plan.half.hours': text('Saatler', HALF_DAY_LABEL),
  'gunlukakis.plan.half.note': text('Not', 'Sabah çemberi, Montessori çalışması, İngilizce ve bahçe zamanını kapsıyor.'),

  'gunlukakis.scene.prefix': { kind: 'text', label: 'Sıra etiketi (ör. "Sahne 01")', default: 'Sahne', max: 20 },
  'gunlukakis.roster.count': {
    kind: 'text', label: 'Altyazı', default: '{cocuk} çocuk, {ogretmen} öğretmen', max: 60,
    warn: '{cocuk} ve {ogretmen} yerine sınıf mevcudu otomatik yazılır; bunları silmeyin.',
  },
  'gunlukakis.roster.limit': {
    kind: 'text', label: 'Üst sınır altyazısı', default: 'MEB üst sınırı {limit}', max: 60,
    warn: '{limit} yerine MEB üst sınırı otomatik yazılır; silmeyin.',
  },

  'gunlukakis.cta.title': text('Başlık', 'Bu akışı yerinde görün', true),
  'gunlukakis.cta.lead': text(
    'Açıklama',
    'Bu akış yazıldığı gibi işliyor. Emin olmak isterseniz ders saatinde gelin — randevunuzu sabaha alalım, çalışırken görün.',
  ),
};
