// Bildirim türlerinin tek kaynağı. Yeni tür eklerken buraya, metin için
// lib/notification-text.ts'e, hedef için lib/notifications/link.ts'e ekleyin.
export const NOTIFICATION_TYPES = [
  "teklif_onay_bekliyor",
  "teklifiniz_onaylandi",
  "teklif_revize_edildi",
  "teklif_karsi_onaylandi",
  "teklif_reddedildi",
  "web_basvuru",
  "ads_senkron_hata",
  "wa_baglanti_koptu",
  "geri_bildirim",
  "veli_bekliyor",
  "randevu_bugun",
  "geciken_ozet",
  "cevapsiz_arama",
  "santral_senkron_hata",
  "icerik_gorev",
  "icerik_teslim",
  "icerik_duzeltme",
  "icerik_onay",
  "ig_yayinlandi",
  "ig_yayin_hata",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export function isNotificationType(t: string): t is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(t);
}

export interface NotificationLike {
  type: string;
  payload: Record<string, unknown>;
  leadName?: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
