// Rapor dönemi: URL'deki ?donem=&bas=&bit= değerlerini İstanbul takviminde bir aralığa ve karşılaştırılacak önceki
// döneme çevirir (saf modül; bugün dışarıdan verilir).

export const PERIOD_KEYS = ["bu-ay", "gecen-ay", "egitim-yili", "ozel"] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  "bu-ay": "Bu ay",
  "gecen-ay": "Geçen ay",
  "egitim-yili": "Bu eğitim yılı",
  ozel: "Özel aralık",
};

export type DayRange = { from: string; to: string };

export type Period = DayRange & {
  key: PeriodKey;
  /** Ekranda dönemin adı: "Ekim 2026 (1–20 Ekim)". */
  label: string;
  /** Cümle başı: "1–20 Ekim 2026 arasında", "Eylül 2026 ayında". */
  phrase: string;
  days: number;
  prev: DayRange & { label: string };
};

const MAX_DAYS = 366;
const DAY_MS = 86_400_000;
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

export function isYmd(value: string | undefined | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function addDays(ymd: string, n: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetweenInclusive(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

function ymd(year: number, month1: number, day: number): string {
  return `${year}-${String(month1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

function parts(day: string): [number, number, number] {
  const [y, m, d] = day.split("-").map(Number);
  return [y, m, d];
}

/** Ay kaydırma: (yıl, ay) + delta. */
function shiftMonth(year: number, month1: number, delta: number): [number, number] {
  const index = year * 12 + (month1 - 1) + delta;
  return [Math.floor(index / 12), (index % 12) + 1];
}

/** "2026-10-01".."2026-10-20" → "1–20 Ekim"; ay/yıl geçişinde iki uç da yazılır. */
export function formatDayRange(from: string, to: string): string {
  const [y1, m1, d1] = parts(from);
  const [y2, m2, d2] = parts(to);
  if (from === to) return `${d1} ${MONTHS[m1 - 1]} ${y1}`;
  if (y1 === y2 && m1 === m2) return `${d1}–${d2} ${MONTHS[m2 - 1]} ${y2}`;
  if (y1 === y2) return `${d1} ${MONTHS[m1 - 1]} – ${d2} ${MONTHS[m2 - 1]} ${y2}`;
  return `${d1} ${MONTHS[m1 - 1]} ${y1} – ${d2} ${MONTHS[m2 - 1]} ${y2}`;
}

/** "2026-10" → "Ekim 2026" */
export function formatMonth(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "2026-10" → "Eki" (grafik ekseni). */
export function formatMonthShort(monthKey: string): string {
  const m = Number(monthKey.split("-")[1]);
  return MONTHS[m - 1].slice(0, 3);
}

/** Eğitim yılı 1 Eylül'de başlar. */
export function schoolYearStart(today: string): string {
  const [y, m] = parts(today);
  return ymd(m >= 9 ? y : y - 1, 9, 1);
}

/** Aynı ay/gün bir yıl önce; 29 Şubat 28'e düşer. */
function sameDayLastYear(day: string): string {
  const [y, m, d] = parts(day);
  return ymd(y - 1, m, Math.min(d, daysInMonth(y - 1, m)));
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export type PeriodParams = Record<string, string | string[] | undefined>;

/** URL değerlerinden dönemi kurar. Geçersiz ya da eksik değer "bu ay"a düşer; özel aralık en çok 366 gün. */
export function resolvePeriod(params: PeriodParams, today: string): Period {
  const raw = first(params.donem);
  const key: PeriodKey = (PERIOD_KEYS as readonly string[]).includes(raw ?? "") ? (raw as PeriodKey) : "bu-ay";
  const [ty, tm, td] = parts(today);

  if (key === "gecen-ay") {
    const [py, pm] = shiftMonth(ty, tm, -1);
    const [qy, qm] = shiftMonth(ty, tm, -2);
    const from = ymd(py, pm, 1);
    const to = ymd(py, pm, daysInMonth(py, pm));
    const prev = { from: ymd(qy, qm, 1), to: ymd(qy, qm, daysInMonth(qy, qm)) };
    return {
      key,
      from,
      to,
      label: formatMonth(from.slice(0, 7)),
      phrase: `${formatMonth(from.slice(0, 7))} ayında`,
      days: daysBetweenInclusive(from, to),
      prev: { ...prev, label: formatMonth(prev.from.slice(0, 7)) },
    };
  }

  if (key === "egitim-yili") {
    const from = schoolYearStart(today);
    const prev = { from: sameDayLastYear(from), to: sameDayLastYear(today) };
    const [sy] = parts(from);
    return {
      key,
      from,
      to: today,
      label: `${sy}–${sy + 1} eğitim yılı (${formatDayRange(from, today)})`,
      phrase: `${sy}–${sy + 1} eğitim yılında bugüne kadar`,
      days: daysBetweenInclusive(from, today),
      prev: { ...prev, label: formatDayRange(prev.from, prev.to) },
    };
  }

  if (key === "ozel") {
    const bas = first(params.bas);
    const bit = first(params.bit);
    if (isYmd(bas) && isYmd(bit)) {
      let [from, to] = bas <= bit ? [bas, bit] : [bit, bas];
      if (to > today) to = today;
      if (from > to) from = to;
      if (daysBetweenInclusive(from, to) > MAX_DAYS) from = addDays(to, -(MAX_DAYS - 1));
      const days = daysBetweenInclusive(from, to);
      const prev = { from: addDays(from, -days), to: addDays(from, -1) };
      return {
        key,
        from,
        to,
        label: formatDayRange(from, to),
        phrase: `${formatDayRange(from, to)} arasında`,
        days,
        prev: { ...prev, label: formatDayRange(prev.from, prev.to) },
      };
    }
    // Tarihsiz özel istek: bu aya düşer.
  }

  // Bu ay: ayın 1'i → bugün; önceki: geçen ayın 1'i → aynı gün (ay kısaysa ay sonu).
  const from = ymd(ty, tm, 1);
  const [py, pm] = shiftMonth(ty, tm, -1);
  const prev = { from: ymd(py, pm, 1), to: ymd(py, pm, Math.min(td, daysInMonth(py, pm))) };
  return {
    key: "bu-ay",
    from,
    to: today,
    label: `${formatMonth(from.slice(0, 7))} (${formatDayRange(from, today)})`,
    phrase: `${formatDayRange(from, today)} arasında`,
    days: daysBetweenInclusive(from, today),
    prev: { ...prev, label: formatDayRange(prev.from, prev.to) },
  };
}

/** İstanbul gününün başlangıcı (UTC ISO). Sabit +03:00. */
export function istanbulStartIso(day: string): string {
  return new Date(`${day}T00:00:00+03:00`).toISOString();
}

/** `[from 00:00, to+1 00:00)` UTC ISO sınırları; `timestamptz` kolonlar için. */
export function isoBounds(range: DayRange): { start: string; end: string } {
  return { start: istanbulStartIso(range.from), end: istanbulStartIso(addDays(range.to, 1)) };
}

/** Bir anın (ISO) İstanbul günü. */
export function istanbulDay(iso: string): string {
  return new Date(Date.parse(iso) + 3 * 3_600_000).toISOString().slice(0, 10);
}

export function inRange(day: string | null | undefined, range: DayRange): boolean {
  return !!day && day >= range.from && day <= range.to;
}

/** Anın (ISO) İstanbul günü aralıkta mı. */
export function isoInRange(iso: string | null | undefined, range: DayRange): boolean {
  return !!iso && inRange(istanbulDay(iso), range);
}

/** Bitiş ayıyla biten son `count` ay anahtarı, eskiden yeniye ("2025-11" … "2026-10"). */
export function lastMonths(to: string, count = 12): string[] {
  const [y, m] = parts(to);
  return Array.from({ length: count }, (_, i) => {
    const [yy, mm] = shiftMonth(y, m, i - (count - 1));
    return `${yy}-${String(mm).padStart(2, "0")}`;
  });
}

/** URL'yi kurmak için dönem parametreleri. */
export function periodQuery(period: Pick<Period, "key" | "from" | "to">): string {
  if (period.key === "ozel") return `donem=ozel&bas=${period.from}&bit=${period.to}`;
  return period.key === "bu-ay" ? "" : `donem=${period.key}`;
}
