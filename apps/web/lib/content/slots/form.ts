import type { SlotDef } from '../types';
import { limitFor } from './limits';
import { PHONE_ERROR } from '@/lib/leadSchema';

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
  'form.phone.placeholder': '05XX XXX XX XX',
  'form.birth.month': 'Ay',
  'form.birth.year': 'Yıl',
  'form.district.placeholder': 'Seçin',
  // Alan hataları: sunucu (lib/leadSchema.ts) ve istemci aynı alanda hata bildirince bu yazı gösterilir.
  'form.err.parentName': 'Ad soyad en az 2 karakter olmalı',
  'form.err.phone': PHONE_ERROR,
  'form.err.kvkkConsent': 'Devam etmek için aydınlatma metnini onaylayın',
  'form.err.childBirthMonth': 'Doğum ayını seçin',
  'form.err.childBirthYear': 'Doğum yılını seçin',
  'form.err.district': 'Semtinizi seçin',
  'form.err.startWindow': 'Başlangıç zamanını seçin',
  // Sunucu yanıtına göre form altı uyarıları (app/api/lead/route.ts).
  'form.tooMany': 'Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin veya bizi arayın.',
  'form.failed': 'Talebiniz alınamadı, lütfen telefonla ulaşın.',
};

const LABELS: Record<string, string> = {
  'form.parentName.label': 'Ad alanı etiketi',
  'form.phone.label': 'Telefon alanı etiketi',
  'form.submit': 'Gönder düğmesi',
  'form.submitting': 'Gönderilirken düğme yazısı',
  'form.help.before': 'Baştaki yazı',
  'form.help.emphasis': 'Kalın vurgu (ör. süre)',
  'form.help.after': 'Sondaki yazı',
  'form.birth.legend': 'Soru',
  'form.district.label': 'Soru',
  'form.start.legend': 'Soru',
  'form.start.hemen': '1. seçenek',
  'form.start.1_3_ay': '2. seçenek',
  'form.start.3_6_ay': '3. seçenek',
  'form.start.gelecek_yil': '4. seçenek',
  'form.whatsapp.label': 'WhatsApp sorusu',
  'form.error': 'Bağlantı hatası mesajı',
  'form.invalid': 'İşaretli alan uyarısı',
  'form.phone.placeholder': 'Telefon kutusundaki örnek yazı',
  'form.birth.month': 'Ay kutusunun ilk satırı',
  'form.birth.year': 'Yıl kutusunun ilk satırı',
  'form.district.placeholder': 'Kutunun ilk satırı',
  'form.err.parentName': 'Ad eksik',
  'form.err.phone': 'Telefon numarası geçersiz',
  'form.err.kvkkConsent': 'KVKK onayı işaretlenmemiş',
  'form.err.childBirthMonth': 'Doğum ayı seçilmemiş',
  'form.err.childBirthYear': 'Doğum yılı seçilmemiş',
  'form.err.district': 'Semt seçilmemiş',
  'form.err.startWindow': 'Başlangıç zamanı seçilmemiş',
  'form.tooMany': 'Çok fazla deneme uyarısı',
  'form.failed': 'Başvuru alınamadı uyarısı',
};

/** Başvuru formunun tıklanarak düzenlenemeyen (seçenek, örnek yazı, hata) alanları: sayfa ayarlarında listelenir. */
export const FORM_SETTING_KEYS = ['form.phone.placeholder', 'form.err.parentName', 'form.err.phone', 'form.err.kvkkConsent', 'form.tooMany', 'form.failed'];
/** Yalnızca reklam sayfalarındaki uzun formda (qualify) görünen alanlar. */
export const FORM_QUALIFY_SETTING_KEYS = [
  'form.birth.month', 'form.birth.year', 'form.district.placeholder',
  'form.err.childBirthMonth', 'form.err.childBirthYear', 'form.err.district', 'form.err.startWindow',
];

export const FORM_SLOTS: Record<string, SlotDef> = Object.fromEntries(
  Object.entries(FORM_DEFAULTS).map(([key, def]) => [
    key,
    { kind: 'text', label: LABELS[key], default: def, max: limitFor(def) } satisfies SlotDef,
  ]),
);
