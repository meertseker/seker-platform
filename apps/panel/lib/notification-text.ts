import { formatTRY, tlToKurus } from "@/lib/money";
import { isNotificationType, type NotificationLike } from "@/lib/notifications/types";

function moneyFromPayload(value: unknown) {
  return typeof value === "number" ? formatTRY(tlToKurus(value)) : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

// Ad önceliği: payload.parentName → leadName (lead kaydından) → yok
function personName(n: NotificationLike): string | null {
  return str(n.payload.parentName) ?? str(n.leadName);
}

const timeFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function istanbulTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : timeFormatter.format(new Date(ms));
}

export function notificationText(n: NotificationLike): string {
  const { payload } = n;
  const offered = moneyFromPayload(payload.offered);
  const counterPrice = moneyFromPayload(payload.counterPrice);
  const name = personName(n);

  switch (n.type) {
    case "teklif_onay_bekliyor":
      if (name) {
        return offered
          ? `${name} için teklif onay bekliyor: ${offered}`
          : `${name} için teklif onay bekliyor`;
      }
      return offered ? `Onay bekleyen yeni teklif: ${offered}` : "Yeni teklif onay bekliyor.";
    case "teklifiniz_onaylandi":
      return name ? `${name} için teklifiniz onaylandı` : "Teklifiniz onaylandı.";
    case "teklif_revize_edildi":
      if (name) {
        return counterPrice
          ? `${name} teklifine karşı rakam girildi: ${counterPrice}`
          : `${name} teklifine karşı rakam girildi`;
      }
      return counterPrice
        ? `Teklif için karşı rakam girildi: ${counterPrice}`
        : "Teklif için karşı rakam girildi.";
    case "teklif_karsi_onaylandi":
      if (name) {
        return counterPrice
          ? `${name} teklifi karşı rakamla onaylandı: ${counterPrice}`
          : `${name} teklifi karşı rakamla onaylandı`;
      }
      return counterPrice
        ? `Teklif karşı rakamla onaylandı: ${counterPrice}`
        : "Teklif karşı rakamla onaylandı.";
    case "ads_senkron_hata":
      return "Google Ads senkronu bu sabah başarısız oldu. Pazarlama ekranına bakın.";
    case "wa_baglanti_koptu":
      return "WhatsApp bağlantısı koptu, gruba bildirim gitmiyor. Ayarlar'dan yeniden bağlayın.";
    case "teklif_reddedildi":
      return name ? `${name} için teklifiniz reddedildi` : "Teklifiniz reddedildi.";
    case "web_basvuru": {
      const who = name ?? "Bir veli";
      if (payload.duplicate === true) return `${who} siteden tekrar başvurdu`;
      const page = str(payload.landingPath) ? ` (${payload.landingPath})` : "";
      return `Yeni web başvurusu: ${who}${page}`;
    }
    case "geri_bildirim": {
      const by = str(payload.by) ?? "Bir kullanıcı";
      const title = str(payload.title) ? `: ${payload.title}` : "";
      return payload.kind === "hata"
        ? `${by} hata bildirdi${title}`
        : `${by} öneri gönderdi${title}`;
    }
    case "veli_bekliyor":
      return `${name ?? "Bir veli"} 15 dakikadır aranmadı`;
    case "randevu_bugun": {
      const time = istanbulTime(payload.at);
      // "Bugün" yazılmaz: eski satırlarda yanlış olurdu, gün başlığı tarihi zaten verir.
      if (time) return name ? `${time} randevu: ${name}` : `${time} randevu`;
      return name ? `Randevu: ${name}` : "Randevu hatırlatması";
    }
    case "geciken_ozet": {
      const total =
        str(payload.totalFormatted) ??
        (typeof payload.totalKurus === "number" ? formatTRY(payload.totalKurus) : null);
      if (typeof payload.count !== "number" || !Number.isFinite(payload.count)) return "Ödemesi geciken taksitler var";
      return total
        ? `Ödemesi geciken ${payload.count} taksit var (toplam ${total})`
        : `Ödemesi geciken ${payload.count} taksit var`;
    }
    case "cevapsiz_arama": {
      const who = name ?? str(payload.number);
      return who ? `Cevapsız arama: ${who}` : "Cevapsız arama";
    }
    case "santral_senkron_hata":
      return "Santral senkronu başarısız oldu.";
    case "icerik_gorev": {
      const code = str(payload.code);
      return code ? `Yeni içerik görevi: ${code}` : "Yeni içerik görevi";
    }
    case "icerik_teslim":
      return `${str(payload.code) ?? "İçerik"} teslim edildi, onayını bekliyor`;
    case "icerik_duzeltme": {
      const note = str(payload.note);
      return `${str(payload.code) ?? "İçerik"} için düzeltme istendi${note ? `: ${note}` : ""}`;
    }
    case "icerik_onay":
      return `${str(payload.code) ?? "İçerik"} onaylandı`;
    default:
      return `Yeni bir sistem bildirimi (${n.type.replace(/_/g, " ")})`;
  }
}

/** Metin zaten ne yapılacağını söylüyorsa null. */
export function notificationHint(n: NotificationLike): string | null {
  if (!isNotificationType(n.type)) return null;
  switch (n.type) {
    case "teklif_onay_bekliyor":
      return "Onaylayın, reddedin ya da karşı rakam girin.";
    case "teklifiniz_onaylandi":
    case "teklif_karsi_onaylandi":
      return "Veliye haber verebilirsiniz.";
    case "teklif_revize_edildi":
      return "Karşı rakamı veliyle görüşün.";
    case "teklif_reddedildi":
      return "Velinin sayfasından yeni teklif verebilirsiniz.";
    case "web_basvuru":
      return "Veliyi arayıp başvurusunu konuşun.";
    case "veli_bekliyor":
      return "Hemen arayın.";
    case "randevu_bugun":
      return "Ziyaret için hazırlanın.";
    case "geciken_ozet":
      return "Gecikenler listesinden velileri arayın.";
    case "geri_bildirim":
      return "Geri bildirim ekranında açın.";
    case "cevapsiz_arama":
      return "Geri arayın.";
    case "ads_senkron_hata":
    case "wa_baglanti_koptu":
    case "santral_senkron_hata":
      return null;
    case "icerik_gorev":
      return "Görevim ekranında açın.";
    case "icerik_teslim":
      return "İçerik ekranında onaylayın ya da düzeltme isteyin.";
    case "icerik_duzeltme":
      return "Düzeltip yeniden teslim edin.";
    case "icerik_onay":
      return null;
  }
}
