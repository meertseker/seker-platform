import { formatTRY, tlToKurus } from "@/lib/money";

function moneyFromPayload(value: unknown) {
  return typeof value === "number" ? formatTRY(tlToKurus(value)) : null;
}

export function notificationText(notification: {
  type: string;
  payload: Record<string, unknown>;
}): string {
  const { payload } = notification;
  const offered = moneyFromPayload(payload.offered);
  const counterPrice = moneyFromPayload(payload.counterPrice);

  switch (notification.type) {
    case "teklif_onay_bekliyor":
      return offered
        ? `Onay bekleyen yeni teklif: ${offered}`
        : "Yeni teklif onay bekliyor.";
    case "teklifiniz_onaylandi":
      return "Teklifiniz onaylandı.";
    case "teklif_revize_edildi":
      return counterPrice
        ? `Teklif için karşı rakam girildi: ${counterPrice}`
        : "Teklif için karşı rakam girildi.";
    case "teklif_reddedildi":
      return "Teklifiniz reddedildi.";
    case "web_basvuru": {
      const name = typeof payload.parentName === "string" ? payload.parentName : "Bir veli";
      if (payload.duplicate === true) return `${name} siteden tekrar başvurdu`;
      const page = typeof payload.landingPath === "string" && payload.landingPath ? ` (${payload.landingPath})` : "";
      return `Yeni web başvurusu: ${name}${page}`;
    }
    default:
      return "Yeni bildirim var.";
  }
}
