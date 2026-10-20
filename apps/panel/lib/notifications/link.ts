import { isNotificationType, type NotificationLike } from "@/lib/notifications/types";

const FALLBACK = "/bildirimler";

/** `today`: İstanbul takvim günü, YYYY-MM-DD. */
export function notificationHref(
  n: NotificationLike & { created_at?: string },
  today: string,
): string {
  const { payload } = n;
  const leadId = typeof payload.leadId === "string" && payload.leadId ? payload.leadId : null;
  const leadHref = leadId ? `/leads/${leadId}` : FALLBACK;

  if (!isNotificationType(n.type)) return FALLBACK;

  switch (n.type) {
    case "geciken_ozet":
      return "/odemeler/gecikenler";
    case "teklif_onay_bekliyor":
      return "/teklifler";
    case "randevu_bugun":
      return payload.tarih === today ? "/bugun#ziyaretler" : leadHref;
    case "geri_bildirim":
      return typeof payload.feedbackId === "string" && payload.feedbackId
        ? `/geri-bildirim#gb-${payload.feedbackId}`
        : "/geri-bildirim";
    case "wa_baglanti_koptu":
      return "/ayarlar#whatsapp";
    case "ads_senkron_hata":
      return "/pazarlama";
    case "santral_senkron_hata":
      return "/ayarlar";
    default:
      return leadHref;
  }
}
