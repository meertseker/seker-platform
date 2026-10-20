import {
  BadgePercent,
  Banknote,
  Bell,
  CalendarClock,
  Clapperboard,
  Megaphone,
  MessageCircleWarning,
  MessageSquarePlus,
  PhoneCall,
  PhoneMissed,
  PhoneOff,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { isNotificationType, type NotificationType } from "@/lib/notifications/types";

type Tone = "primary" | "accent" | "warning" | "destructive" | "muted";

const TONE_CLASS: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent-soft text-accent",
  warning: "bg-warning-soft text-warning",
  destructive: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

const ICONS: Record<NotificationType, { icon: LucideIcon; tone: Tone }> = {
  teklif_onay_bekliyor: { icon: BadgePercent, tone: "primary" },
  teklif_revize_edildi: { icon: BadgePercent, tone: "primary" },
  teklifiniz_onaylandi: { icon: BadgePercent, tone: "accent" },
  teklif_karsi_onaylandi: { icon: BadgePercent, tone: "accent" },
  teklif_reddedildi: { icon: BadgePercent, tone: "destructive" },
  web_basvuru: { icon: UserPlus, tone: "accent" },
  veli_bekliyor: { icon: PhoneCall, tone: "warning" },
  cevapsiz_arama: { icon: PhoneMissed, tone: "warning" },
  randevu_bugun: { icon: CalendarClock, tone: "primary" },
  geciken_ozet: { icon: Banknote, tone: "warning" },
  ads_senkron_hata: { icon: Megaphone, tone: "destructive" },
  wa_baglanti_koptu: { icon: MessageCircleWarning, tone: "destructive" },
  santral_senkron_hata: { icon: PhoneOff, tone: "destructive" },
  geri_bildirim: { icon: MessageSquarePlus, tone: "muted" },
  icerik_gorev: { icon: Clapperboard, tone: "primary" },
  icerik_teslim: { icon: Clapperboard, tone: "primary" },
  icerik_duzeltme: { icon: Clapperboard, tone: "warning" },
  icerik_onay: { icon: Clapperboard, tone: "accent" },
};

const FALLBACK = { icon: Bell, tone: "muted" as Tone };

/** Bildirim türünü renkli yuvarlak simgeyle gösterir; süs, ekran okuyucudan gizli. */
export function NotificationIcon({ type, className = "" }: { type: string; className?: string }) {
  const { icon: Icon, tone } = isNotificationType(type) ? ICONS[type] : FALLBACK;
  return (
    <span
      aria-hidden
      className={`flex size-9 shrink-0 items-center justify-center rounded-full ${TONE_CLASS[tone]} ${className}`}
    >
      <Icon className="size-[1.125rem]" strokeWidth={2.1} />
    </span>
  );
}
