export const LEAD_STATUSES = {
  yeni: "Yeni", ulasildi: "Ulaşıldı", randevu: "Randevu",
  gorusme_yapildi: "Görüşme Yapıldı", teklif: "Teklif",
  beklemede: "Beklemede",
  kazanildi: "Kazanıldı", kaybedildi: "Kaybedildi",
} as const;
export type LeadStatus = keyof typeof LEAD_STATUSES;

export const LEAD_SOURCES = {
  referans: "Referans", instagram: "Instagram", reklam: "Reklam",
  tabela_gecerken: "Tabela / Geçerken", telefon: "Telefon",
  etkinlik: "Etkinlik", web_sitesi: "Web Sitesi", whatsapp: "WhatsApp", diger: "Diğer",
} as const;
export type LeadSource = keyof typeof LEAD_SOURCES;

export const LOST_REASONS = {
  fiyat: "Fiyat", uzaklik: "Uzaklık", baska_okul: "Başka okul",
  ulasilamadi: "Ulaşılamadı", vazgecti: "Vazgeçti",
  yas_uymuyor: "Yaş uymuyor", gelecek_yil: "Gelecek yıl", diger: "Diğer",
} as const;
export type LostReason = keyof typeof LOST_REASONS;

export const OFFER_STATUSES = {
  onay_bekliyor: "Onay Bekliyor", onaylandi: "Onaylandı",
  revize_edildi: "Revize Edildi", reddedildi: "Reddedildi", gecersiz: "Geçersiz",
} as const;
export type OfferStatus = keyof typeof OFFER_STATUSES;

export const PROGRAMS = {
  tam_gun: "Tam Gün", yarim_gun: "Yarım Gün",
  uc_gun: "3 Gün", play_grup: "Play Grup",
} as const;
export type Program = keyof typeof PROGRAMS;

export const ITEM_TYPES = {
  aidat: "Aidat", kayit_ucreti: "Kayıt Ücreti",
  servis: "Servis", yemek: "Yemek", kitap: "Kitap-Kırtasiye", diger: "Diğer",
} as const;
export type ItemType = keyof typeof ITEM_TYPES;

export const PAYMENT_METHODS = {
  havale: "Havale/EFT", nakit: "Nakit", pos: "Kart (POS)", diger: "Diğer",
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;

export const APPOINTMENT_TYPES = {
  okul_ziyareti: "Okul Ziyareti", telefon: "Telefon Görüşmesi",
  demo: "Demo Dersi", oryantasyon: "Oryantasyon",
} as const;
export type AppointmentType = keyof typeof APPOINTMENT_TYPES;
export const APPOINTMENT_OUTCOMES = {
  bekliyor: "Bekliyor", geldi: "Geldi", gelmedi: "Gelmedi",
  ertelendi: "Ertelendi", iptal: "İptal",
} as const;
export type AppointmentOutcome = keyof typeof APPOINTMENT_OUTCOMES;

export const INSTALLMENT_STATUSES = {
  bekliyor: "Bekliyor", odendi: "Ödendi", iptal: "İptal",
} as const;
export type InstallmentStatus = keyof typeof INSTALLMENT_STATUSES;

export const DISCOUNT_TYPES = {
  yok: "Yok", yuzde_10: "%10 Kardeş", ozel: "Özel",
} as const;
export type DiscountType = keyof typeof DISCOUNT_TYPES;

export const STUDENT_STATUSES = {
  aktif: "Aktif", ayrildi: "Ayrıldı", mezun: "Mezun",
} as const;

export const EVENT_LABELS = {
  lead_olusturuldu: "Veli eklendi",
  durum_degisti: "Durum değişti",
  lead_guncellendi: "Veli bilgileri güncellendi",
  randevu_olusturuldu: "Randevu oluşturuldu",
  randevu_sonuclandi: "Randevu sonuçlandı",
  teklif_olusturuldu: "Teklif oluşturuldu",
  teklif_onaylandi: "Teklif onaylandı",
  teklif_reddedildi: "Teklif reddedildi",
  teklif_revize_edildi: "Teklif revize edildi",
  ogrenciye_donusturuldu: "Öğrenciye dönüştürüldü",
  plan_olusturuldu: "Ödeme planı oluşturuldu",
  taksit_odendi: "Taksit ödendi",
  odeme_geri_alindi: "Ödeme geri alındı",
  fiyat_listesi_guncellendi: "Fiyat listesi güncellendi",
  beklemeye_alindi: "Beklemeye alındı",
  ogrenci_ayrildi: "Öğrenci ayrıldı",
  iade_kaydedildi: "İade kaydedildi",
  aileye_baglandi: "Aileye bağlandı",
  web_basvuru: "Web sitesinden başvurdu",
  web_tekrar_basvuru: "Web sitesinden tekrar başvurdu",
  taksit_guncellendi: "Taksit güncellendi",
  arama_kaydi: "Arama kaydedildi",
  mesaj_tekrar: "Mesajla tekrar yazdı",
} as const;

export const CONVERSION_ACTIONS = {
  randevu: "Randevu", kayit: "Kayıt",
} as const;
export type ConversionAction = keyof typeof CONVERSION_ACTIONS;

export const CONVERSION_UPLOAD_STATUSES = {
  bekliyor: "Bekliyor", gonderildi: "Gönderildi", hata: "Hata", atlandi: "Atlandı",
} as const;
export type ConversionUploadStatus = keyof typeof CONVERSION_UPLOAD_STATUSES;

export function label(group: Record<string, string>, value: string): string {
  return group[value] ?? value;
}

export const FEEDBACK_KINDS = {
  hata: "Hata bildirimi",
  oneri: "Öneri / özellik isteği",
} as const;
export type FeedbackKind = keyof typeof FEEDBACK_KINDS;

export const FEEDBACK_STATUSES = {
  yeni: "Yeni",
  inceleniyor: "İnceleniyor",
  tamamlandi: "Tamamlandı",
  yapilmayacak: "Yapılmayacak",
} as const;
export type FeedbackStatus = keyof typeof FEEDBACK_STATUSES;

/** Formdaki "ne zaman başlamak istiyor" cevabı (leads.start_window). */
export const START_WINDOWS = {
  hemen: "hemen başlamak istiyor", "1_3_ay": "1–3 ay içinde",
  "3_6_ay": "3–6 ay içinde", gelecek_yil: "gelecek yıl",
} as const;
export type StartWindow = keyof typeof START_WINDOWS;
