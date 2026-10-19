import type { SlotDef } from '../types';
import { limitFor } from './limits';

/**
 * Başvuru formunun (LeadForm) görünen etiketleri. Alan adları, doğrulama ve gönderim kodda kalır.
 * KVKK onay cümlesi (KVKK_CONSENT_LABEL) bilerek slot DEĞİLDİR: hukuki metin kodda durur.
 * İstemci bileşen LeadForm yedek olarak bu varsayılanları kullanır (data verilmeyen sayfalarda).
 */
export const FORM_DEFAULTS: Record<string, string> = {
  'form.parentName.label': 'Adınız',
  'form.phone.label': 'Telefon numaranız',
  'form.submit': 'Beni Arayın',
  'form.submitting': 'Gönderiliyor…',
  // "Numaranızı bırakın, <strong>15 dakika</strong> içinde sizi arayalım." üç parçadan oluşur.
  'form.help.before': 'Numaranızı bırakın,',
  'form.help.emphasis': '15 dakika',
  'form.help.after': 'içinde sizi arayalım.',
  'form.birth.legend': 'Çocuğunuzun doğum ayı ve yılı',
  'form.district.label': 'Oturduğunuz semt',
  'form.start.legend': 'Ne zaman başlamayı düşünüyorsunuz?',
  'form.start.hemen': 'Hemen',
  'form.start.1_3_ay': '1–3 ay içinde',
  'form.start.3_6_ay': '3–6 ay içinde',
  'form.start.gelecek_yil': 'Gelecek eğitim yılı',
  'form.whatsapp.label': "WhatsApp'tan yazmamızı ister misiniz?",
  'form.error': 'Bağlantı hatası. Lütfen telefonla ulaşın.',
  'form.invalid': 'Lütfen işaretli alanları kontrol edin.',
};

const LABELS: Record<string, string> = {
  'form.parentName.label': 'Form: ad alanı etiketi',
  'form.phone.label': 'Form: telefon alanı etiketi',
  'form.submit': 'Form: gönder düğmesi',
  'form.submitting': 'Form: gönderilirken düğme yazısı',
  'form.help.before': 'Form altı satır: baştaki yazı',
  'form.help.emphasis': 'Form altı satır: kalın vurgu (ör. süre)',
  'form.help.after': 'Form altı satır: sondaki yazı',
  'form.birth.legend': 'Form: doğum ayı ve yılı sorusu',
  'form.district.label': 'Form: semt sorusu',
  'form.start.legend': 'Form: başlangıç zamanı sorusu',
  'form.start.hemen': 'Form: başlangıç seçeneği 1',
  'form.start.1_3_ay': 'Form: başlangıç seçeneği 2',
  'form.start.3_6_ay': 'Form: başlangıç seçeneği 3',
  'form.start.gelecek_yil': 'Form: başlangıç seçeneği 4',
  'form.whatsapp.label': 'Form: WhatsApp sorusu',
  'form.error': 'Form: bağlantı hatası mesajı',
  'form.invalid': 'Form: işaretli alan uyarısı',
};

export const FORM_SLOTS: Record<string, SlotDef> = Object.fromEntries(
  Object.entries(FORM_DEFAULTS).map(([key, def]) => [
    key,
    { kind: 'text', label: LABELS[key], default: def, max: limitFor(def) } satisfies SlotDef,
  ]),
);
