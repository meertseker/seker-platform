import {
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  MessageCircle,
  Phone,
  Sparkles,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/constants";

/*
 * Durum → renk + ikon + Türkçe etiket eşlemesi. Renk-körü güvenli: hiçbir
 * yerde renk tek başına anlam taşımaz, her rozette ikon ve metin de vardır.
 * Sınıflar `app/globals.css` içindeki `--color-status-*` token'larına karşılık
 * gelen `bg-status-*-soft` / `text-status-*` Tailwind v4 utility'leridir —
 * bileşende ham hex yoktur.
 */
export const STATUS_BADGE_STYLE: Record<
  LeadStatus,
  { bg: string; fg: string; icon: LucideIcon }
> = {
  yeni: { bg: "bg-status-yeni-soft", fg: "text-status-yeni", icon: Sparkles },
  ulasildi: { bg: "bg-status-yeni-soft", fg: "text-status-yeni", icon: Phone },
  randevu: {
    bg: "bg-status-randevu-soft",
    fg: "text-status-randevu",
    icon: CalendarDays,
  },
  gorusme_yapildi: {
    bg: "bg-status-randevu-soft",
    fg: "text-status-randevu",
    icon: MessageCircle,
  },
  teklif: { bg: "bg-status-teklif-soft", fg: "text-status-teklif", icon: FileText },
  beklemede: { bg: "bg-status-notr-soft", fg: "text-status-notr", icon: Clock },
  kazanildi: {
    bg: "bg-status-kazanildi-soft",
    fg: "text-status-kazanildi",
    icon: CheckCircle2,
  },
  kaybedildi: {
    bg: "bg-status-kaybedildi-soft",
    fg: "text-status-kaybedildi",
    icon: XCircle,
  },
};

export function statusVisual(status: LeadStatus) {
  const style = STATUS_BADGE_STYLE[status];
  return { label: LEAD_STATUSES[status], icon: style.icon, bg: style.bg, fg: style.fg };
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  const { label, icon: Icon, bg, fg } = statusVisual(status);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${bg} ${fg}`}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
