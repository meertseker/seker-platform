import { LEAD_STATUSES, type LeadStatus } from "@/lib/constants";
import {
  badgeClass,
  LEAD_STATUS_ICONS,
  LEAD_STATUS_STYLES,
} from "@/lib/status-styles";

/*
 * Durum → renk + ikon + Türkçe etiket eşlemesi. `lib/status-styles.ts`
 * içindeki tek kaynağı (LEAD_STATUS_STYLES / LEAD_STATUS_ICONS) sarmalayan
 * ince bir bileşen. Renk-körü güvenli: hiçbir yerde renk tek başına anlam
 * taşımaz, her rozette ikon ve metin de vardır.
 */
export function statusVisual(status: LeadStatus) {
  return {
    label: LEAD_STATUSES[status],
    icon: LEAD_STATUS_ICONS[status],
    className: badgeClass(LEAD_STATUS_STYLES[status]),
  };
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  const { label, icon: Icon, className } = statusVisual(status);

  return (
    <span className={className}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
