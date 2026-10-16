import {
  label,
  LOST_REASONS,
  type AppointmentOutcome,
  type LeadSource,
  type LeadStatus,
  type OfferStatus,
} from "./constants";
import { formatTRY, tlToKurus } from "./money";

/** Web sitesi / reklam formundan gelen başvuru kaynakları (bkz. 0006_web_leads.sql). */
export const WEB_APPLICATION_SOURCES: LeadSource[] = ["web_sitesi", "reklam"];

/** Velinin "Sıradaki adım" kutusundaki tek büyük butonun yapacağı iş. */
export type NextStepAction =
  | "call"
  | "appointment"
  | "appointment_result"
  | "offer"
  | "counter_offer"
  | "convert"
  | "open_student"
  | "reopen"
  | null;

export interface NextStep {
  key: string;
  title: string;
  hint: string;
  action: NextStepAction;
}

export interface NextStepLead {
  status: LeadStatus;
  converted_student_id: string | null;
  lost_reason?: string | null;
}

export interface NextStepAppointment {
  scheduled_at: string;
  outcome: AppointmentOutcome;
}

export interface NextStepOffer {
  status: OfferStatus;
  counter_price?: number | null;
  superseded_by_offer_id?: string | null;
}

export interface NextStepInput {
  lead: NextStepLead;
  appointments: NextStepAppointment[];
  offers: NextStepOffer[];
  now: string;
}

const appointmentFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});

/** Randevu zamanını İstanbul saatiyle "17 Ekim Cuma 14:30" biçiminde yazar. */
export function formatAppointmentTime(iso: string): string {
  return appointmentFormatter.format(new Date(iso));
}

/** `iso` anından `now` anına kadar geçen tam gün sayısı (negatif olmaz). */
export function daysSince(iso: string, now: string | Date): number {
  const nowMs = typeof now === "string" ? Date.parse(now) : now.getTime();
  const elapsed = nowMs - Date.parse(iso);
  if (!Number.isFinite(elapsed) || elapsed <= 0) return 0;
  return Math.floor(elapsed / 86400000);
}

/** "5 dk önce", "3 sa önce", "2 gün önce" — sunucuda bir kez hesaplanır. */
export function elapsedText(iso: string, now: string | Date): string {
  const nowMs = typeof now === "string" ? Date.parse(now) : now.getTime();
  const minutes = Math.max(0, Math.floor((nowMs - Date.parse(iso)) / 60000));
  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  return `${Math.floor(hours / 24)} gün önce`;
}

/** Açık (kazanılan/kaybedilen olmayan) durumlar. */
export function isOpenStatus(status: LeadStatus): boolean {
  return status !== "kazanildi" && status !== "kaybedildi";
}

/** Sıradaki adım butonunun açacağı sayfa içi form (`?adim=`). */
export type StepSheet = "randevu" | "teklif" | "kayit" | "not" | "sonuc";

export function sheetForAction(action: NextStepAction): StepSheet | null {
  switch (action) {
    case "appointment":
      return "randevu";
    case "offer":
      return "teklif";
    case "convert":
      return "kayit";
    case "appointment_result":
      return "sonuc";
    default:
      return null;
  }
}

/** Velinin şu an yapılması gereken tek işini seçer (saf fonksiyon). */
export function nextStep({ lead, appointments, offers, now }: NextStepInput): NextStep {
  const nowMs = Date.parse(now);

  if (lead.status === "kazanildi" || lead.converted_student_id) {
    return {
      key: "kayit_tamam",
      title: "Kayıt tamamlandı",
      hint: "Öğrenci kaydına geçip ödeme planını görebilirsin.",
      action: lead.converted_student_id ? "open_student" : null,
    };
  }

  if (lead.status === "kaybedildi") {
    const reason = lead.lost_reason ? label(LOST_REASONS, lead.lost_reason) : null;
    return {
      key: "kaybedildi",
      title: "Kaybedildi",
      hint: reason
        ? `Neden: ${reason}. Veli geri dönerse yeniden açabilirsin.`
        : "Veli geri dönerse yeniden açabilirsin.",
      action: "reopen",
    };
  }

  if (offers.some((offer) => offer.status === "onaylandi")) {
    return {
      key: "donustur",
      title: "Öğrenciye dönüştür",
      hint: "Onaylı teklif hazır. Öğrenci kaydını açıp ödeme planına geç.",
      action: "convert",
    };
  }

  const pending = appointments.filter((item) => item.outcome === "bekliyor");
  const pastPending = pending
    .filter((item) => Date.parse(item.scheduled_at) <= nowMs)
    .sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));
  if (pastPending.length > 0) {
    return {
      key: "ziyaret_sonucu",
      title: "Ziyaret sonucunu gir",
      hint: `${formatAppointmentTime(pastPending[0].scheduled_at)} randevusu sonuçlanmadı. Veli geldi mi?`,
      action: "appointment_result",
    };
  }

  if (offers.some((offer) => offer.status === "onay_bekliyor")) {
    return {
      key: "onay_bekleniyor",
      title: "Yönetici onayı bekleniyor",
      hint: "Teklif yöneticide. Onaylanınca kayda geçebilirsin.",
      action: null,
    };
  }

  const counter = offers.find(
    (offer) =>
      offer.status === "revize_edildi" &&
      offer.counter_price != null &&
      !offer.superseded_by_offer_id,
  );
  if (counter) {
    return {
      key: "karsi_teklif",
      title: "Karşı rakamla teklif oluştur",
      hint: `Yönetici ${formatTRY(tlToKurus(Number(counter.counter_price)))} önerdi. Bu rakamla teklifi onaylı oluştur.`,
      action: "counter_offer",
    };
  }

  switch (lead.status) {
    case "yeni":
      return {
        key: "ilk_arama",
        title: "İlk aramayı yap",
        hint: "Veliyi ara, kendini tanıt ve ihtiyacını öğren.",
        action: "call",
      };
    case "ulasildi":
      return {
        key: "randevu_ver",
        title: "Randevu ver",
        hint: "Okul ziyareti için gün ve saat belirle.",
        action: "appointment",
      };
    case "randevu": {
      const upcoming = pending
        .filter((item) => Date.parse(item.scheduled_at) > nowMs)
        .sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));
      if (upcoming.length > 0) {
        return {
          key: "ziyaret_bekleniyor",
          title: "Ziyaret bekleniyor",
          hint: `Randevu: ${formatAppointmentTime(upcoming[0].scheduled_at)}`,
          action: null,
        };
      }
      return {
        key: "randevu_ver",
        title: "Randevu ver",
        hint: "Bekleyen randevu yok. Yeni bir gün ve saat belirle.",
        action: "appointment",
      };
    }
    case "gorusme_yapildi":
      return {
        key: "teklif_hazirla",
        title: "Teklif hazırla",
        hint: "Görüşülen programa göre fiyat teklifini gir.",
        action: "offer",
      };
    case "teklif":
      return {
        key: "teklif_hazirla",
        title: "Teklif hazırla",
        hint: "Geçerli bir teklif yok. Yeni teklif oluştur.",
        action: "offer",
      };
    case "beklemede":
      return {
        key: "sezon_ara",
        title: "Sezon yaklaşınca ara",
        hint: "Veli beklemede. Kayıt dönemi yaklaşınca tekrar ara.",
        action: "call",
      };
    default:
      return {
        key: "ilk_arama",
        title: "İlk aramayı yap",
        hint: "Veliyi ara, kendini tanıt ve ihtiyacını öğren.",
        action: "call",
      };
  }
}
