export function tlToKurus(tl: number): number {
  return Math.round(tl * 100);
}
export function kurusToTl(kurus: number): number {
  return kurus / 100;
}
export function formatTRY(kurus: number): string {
  const formatted = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(kurus / 100);
  return `${formatted} ₺`;
}
