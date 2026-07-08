export const LEAD_STATUSES = {
  yeni: "Yeni", ulasildi: "Ulaşıldı", randevu: "Randevu",
  gorusme_yapildi: "Görüşme Yapıldı", teklif: "Teklif",
  kazanildi: "Kazanıldı", kaybedildi: "Kaybedildi",
} as const;
export type LeadStatus = keyof typeof LEAD_STATUSES;

export const LEAD_SOURCES = {
  referans: "Referans", instagram: "Instagram", reklam: "Reklam",
  tabela_gecerken: "Tabela / Geçerken", telefon: "Telefon", diger: "Diğer",
} as const;
export type LeadSource = keyof typeof LEAD_SOURCES;

export const LOST_REASONS = {
  fiyat: "Fiyat", uzaklik: "Uzaklık", baska_okul: "Başka okul",
  ulasilamadi: "Ulaşılamadı", vazgecti: "Vazgeçti", diger: "Diğer",
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
  servis: "Servis", yemek: "Yemek", diger: "Diğer",
} as const;
export type ItemType = keyof typeof ITEM_TYPES;

export const PAYMENT_METHODS = {
  havale: "Havale/EFT", nakit: "Nakit", pos: "POS", diger: "Diğer",
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;

export const APPOINTMENT_TYPES = {
  okul_ziyareti: "Okul Ziyareti", telefon: "Telefon Görüşmesi",
} as const;
export const APPOINTMENT_OUTCOMES = {
  bekliyor: "Bekliyor", geldi: "Geldi", gelmedi: "Gelmedi",
  ertelendi: "Ertelendi", iptal: "İptal",
} as const;

export const STUDENT_STATUSES = {
  aktif: "Aktif", ayrildi: "Ayrıldı", mezun: "Mezun",
} as const;

export function label(group: Record<string, string>, value: string): string {
  return group[value] ?? value;
}
