import { ROSTER_STATUS } from '@/content/day';
import { FULL_DAY_LABEL, HALF_DAY_LABEL } from '@/content/program';
import type { SlotDef } from '../types';
import { limitFor, limitForField, metaDescriptionMax } from './limits';

const text = (label: string, def: string, heading = false): SlotDef => ({
  kind: 'text', label, default: def, max: limitFor(def, heading),
});

const STEPS = [
  {
    id: 'on-gorusme',
    title: 'Ön görüşme talebi',
    description: `Formu doldurun veya arayın. Çocuğunuzun yaş grubunu ve tam gün (${FULL_DAY_LABEL}) ya da yarım gün (${HALF_DAY_LABEL}) tercihinizi birlikte netleştirelim.`,
  },
  {
    id: 'ziyaret',
    title: 'Okul ziyareti ve tanışma',
    description:
      'Ders saatinde gelin: sınıfları, bahçeleri ve öğretmenleri yerinde görün, sorularınızı yüz yüze konuşalım.',
  },
  {
    id: 'kayit',
    title: 'Kayıt',
    description:
      'Grubunda yer varsa evrak ve kayıt işlemlerini tamamlayıp başlangıç tarihini birlikte planlayalım. Uyum sürecini çocuğunuzun temposuna göre planlıyoruz.',
  },
];

const DESCRIPTION =
  "Özel Şeker Anaokulu 2026-2027 ön kayıt. Beykent Büyükçekmece'de 2-6 yaş okul öncesi eğitim; tam gün ve yarım gün seçenekleri. Ön görüşme randevusu alın.";

export const KAYIT_SLOTS: Record<string, SlotDef> = {
  'meta.kayit.title': { kind: 'text', label: 'Sayfa başlığı (Google)', default: '2026-2027 Kayıtları', max: 70 },
  'meta.kayit.description': { kind: 'text', label: 'Sayfa açıklaması (Google)', default: DESCRIPTION, max: metaDescriptionMax(DESCRIPTION) },

  'kayit.hero.eyebrow': text('Üst etiket', '2-6 yaş · Beykent Büyükçekmece'),
  'kayit.hero.title': text('Ana başlık', '2026-2027 kayıtlarımız açık', true),
  'kayit.hero.lead': text(
    'Giriş metni',
    `Sınıflarımızda ${ROSTER_STATUS.childCount} çocuk bulunuyor ve her sınıfta iki öğretmen görev yapıyor. Sınıfları doğum yılına ve ayına göre oluşturduğumuz için her grupta yer sayısı sınırlı; 2-3 yaş oyun grubundan 5-6 yaş ilkokula hazırlık sınıfına kadar tüm gruplarda erken başvurmanızı öneririz.`,
  ),
  'kayit.form.title': text('Form başlığı', 'Ön görüşme randevunuzu alın', true),
  'kayit.steps.title': text('Kayıt süreci başlığı', 'Kayıt süreci üç adımdan oluşur', true),
  'kayit.steps': {
    kind: 'list', label: 'Kayıt adımları', fixedItems: true, maxItems: 3, default: STEPS,
    fields: {
      title: { kind: 'text', max: 40, label: 'Adım başlığı' },
      description: { kind: 'text', max: limitForField(STEPS, 'description'), label: 'Adım açıklaması' },
    },
  },
  'kayit.contact.title': text('Doğrudan ulaşım başlığı', 'Formu doldurmadan da ulaşabilirsiniz', true),
  'kayit.contact.lead': text(
    'Doğrudan ulaşım açıklaması',
    "Telefon veya WhatsApp'tan yazdığınızda da aynı 15 dakikalık dönüş taahhüdümüz geçerlidir.",
  ),
  'kayit.contact.ctaWhatsapp': text('WhatsApp düğmesi', "WhatsApp'tan Yazın"),
};
