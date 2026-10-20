// Rapor sayılarının Türkçe yazımı (ekran ve CSV). Değer yoksa "—".

export const DASH = "—";

const int = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });

export function formatInt(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? DASH : int.format(n);
}

/** Kuruş → "12.450 ₺" (rapor kuruş göstermez; 100 TL altı tutarlarda kuruş yazılır). */
export function formatTl(kurus: number | null | undefined): string {
  if (kurus == null || !Number.isFinite(kurus)) return DASH;
  const tl = kurus / 100;
  const fmt = Math.abs(tl) < 100 && !Number.isInteger(tl)
    ? new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : int;
  return `${fmt.format(tl)} ₺`;
}

/** Kuruş → kısa: "1,2 milyon ₺", "45 bin ₺", "980 ₺". */
export function formatTlCompact(kurus: number | null | undefined): string {
  if (kurus == null || !Number.isFinite(kurus)) return DASH;
  const tl = kurus / 100;
  const abs = Math.abs(tl);
  if (abs >= 1_000_000) return `${oneDecimal.format(tl / 1_000_000)} milyon ₺`;
  if (abs >= 10_000) return `${int.format(Math.round(tl / 1000))} bin ₺`;
  return `${int.format(Math.round(tl))} ₺`;
}

/** Oran (0.42) → "%42"; 1'in altındaki küçük oranlar bir ondalıkla. */
export function formatPct(r: number | null | undefined): string {
  if (r == null || !Number.isFinite(r)) return DASH;
  const p = r * 100;
  return `%${Math.abs(p) < 10 ? oneDecimal.format(Math.round(p * 10) / 10) : int.format(Math.round(p))}`;
}

/** Mesai dakikası → "12 dk", "2 sa 5 dk", "3 gün". */
export function formatMinutes(m: number | null | undefined): string {
  if (m == null || !Number.isFinite(m)) return DASH;
  const total = Math.round(m);
  if (total < 60) return `${total} dk`;
  if (total < 60 * 24) {
    const h = Math.floor(total / 60);
    const rest = total % 60;
    return rest > 0 ? `${h} sa ${rest} dk` : `${h} sa`;
  }
  return `${oneDecimal.format(total / (60 * 24))} gün`;
}

/** Gün (ondalıklı) → "0,5 gün", "12 gün". */
export function formatDays(d: number | null | undefined): string {
  if (d == null || !Number.isFinite(d)) return DASH;
  if (d < 1) {
    const hours = Math.round(d * 24);
    return hours <= 0 ? "1 saatten az" : `${hours} saat`;
  }
  return `${oneDecimal.format(d)} gün`;
}

/** Değişim yüzdesi: "+%12", "−%5", "0". */
export function formatSignedPct(r: number | null | undefined): string {
  if (r == null || !Number.isFinite(r)) return DASH;
  const p = Math.round(r * 100);
  if (p === 0) return "%0";
  return `${p > 0 ? "+" : "−"}%${int.format(Math.abs(p))}`;
}

export function formatSignedInt(n: number): string {
  if (n === 0) return "0";
  return `${n > 0 ? "+" : "−"}${int.format(Math.abs(n))}`;
}
