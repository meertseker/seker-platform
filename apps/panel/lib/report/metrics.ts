// Rapor hesaplarının temel parçaları (saf): oran, değişim, maliyet bölmesi, ortanca.
// Sıfıra bölmede sayı uydurulmaz: sonuç null'dır ve ekranda "—" yazılır.

/** n / d; payda 0 ya da negatifse null. */
export function ratio(n: number, d: number): number | null {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return null;
  return n / d;
}

export type Change = {
  current: number;
  previous: number;
  diff: number;
  /** Oransal değişim (0.25 = %25 artış); önceki 0 ise null. */
  pct: number | null;
};

/** Önceki döneme göre değişim. Önceki dönem 0 ise yüzde verilmez (sonsuz artış yazılmaz), yalnız fark. */
export function change(current: number, previous: number): Change {
  return { current, previous, diff: current - previous, pct: previous > 0 ? (current - previous) / previous : null };
}

/** Artış iyi mi ("up"), kötü mü ("down"), yoksa yorumsuz mu ("none": ör. reklam harcaması). */
export type Direction = "up" | "down" | "none";
export type Tone = "good" | "bad" | "flat";

/** Değişimin rengi: artış iyi mi kötü mü metriğe göre (`goodWhen`). Fark yoksa düz. */
export function changeTone(c: Pick<Change, "diff">, goodWhen: Direction): Tone {
  if (c.diff === 0 || goodWhen === "none") return "flat";
  return (c.diff > 0) === (goodWhen === "up") ? "good" : "bad";
}

/** Harcama (kuruş) ÷ adet, kuruşa yuvarlı. Harcama yoksa ya da adet 0 ise null. */
export function costPer(spendKurus: number, count: number): number | null {
  if (!(spendKurus > 0) || !(count > 0)) return null;
  return Math.round(spendKurus / count);
}

export function median(values: number[]): number | null {
  const list = values.filter((v) => Number.isFinite(v));
  if (list.length === 0) return null;
  const sorted = [...list].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function mean(values: number[]): number | null {
  const list = values.filter((v) => Number.isFinite(v));
  return list.length === 0 ? null : list.reduce((s, v) => s + v, 0) / list.length;
}

export function sum(values: number[]): number {
  return values.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
}

/** TL (numeric kolon) → kuruş. */
export function kurus(tl: number | string | null | undefined): number {
  const n = Number(tl ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Google/Meta mikro birimi → kuruş (1 TL = 1.000.000 mikro). Toplam önce mikro olarak birikir. */
export function microsToKurus(micros: number): number {
  return Math.round(micros / 10_000);
}

/** Bir haritadaki sayacı artırır. */
export function bump<K>(map: Map<K, number>, key: K, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

export type AgingBucket = { key: string; label: string; min: number; max: number | null };

export const AGING_BUCKETS: AgingBucket[] = [
  { key: "1-30", label: "1–30 gün", min: 1, max: 30 },
  { key: "31-60", label: "31–60 gün", min: 31, max: 60 },
  { key: "61-90", label: "61–90 gün", min: 61, max: 90 },
  { key: "90+", label: "90 günden fazla", min: 91, max: null },
];

/** Geciken taksitleri gün kovalarına dağıtır (tutar kuruş). 0 ve altı gün kovaya girmez. */
export function agingOf(rows: { days: number; amountKurus: number }[]): { key: string; label: string; count: number; amountKurus: number }[] {
  return AGING_BUCKETS.map((b) => {
    const inBucket = rows.filter((r) => r.days >= b.min && (b.max === null || r.days <= b.max));
    return { key: b.key, label: b.label, count: inBucket.length, amountKurus: sum(inBucket.map((r) => r.amountKurus)) };
  });
}

/** Arama kelimesi: küçük harf (Türkçe), baştaki/sondaki boşluk ve art arda boşluk sadeleşir; "+" ve tırnak atılır. */
export function normalizeTerm(term: string | null | undefined): string | null {
  if (!term) return null;
  const cleaned = term
    .replace(/[+"[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("tr");
  return cleaned.length > 0 ? cleaned : null;
}
