// Mesai saati ve aday sayacı kuralları (saf modül).
// İstanbul sabit +03:00 (DST yok) — projedeki diğer yardımcılarla aynı varsayım.

const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** days: 1=Pazartesi … 7=Pazar; start/end "HH:MM" İstanbul saati. */
export type BusinessHours = { days: number[]; start: string; end: string };

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  days: [1, 2, 3, 4, 5],
  start: "08:30",
  end: "18:00",
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** "2026-11-04" + "10:00" → 2026-11-04T10:00:00+03:00 */
export function istanbulAt(dateString: string, hhmm: string): Date {
  return new Date(`${dateString}T${hhmm}:00+03:00`);
}

/** Mesai içindeyse kendisi, değilse sonraki mesai başlangıcı. */
export function nextBusinessMoment(at: Date, hours: BusinessHours): Date {
  const local = new Date(at.getTime() + ISTANBUL_OFFSET_MS);
  const isoDay = local.getUTCDay() === 0 ? 7 : local.getUTCDay();
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const start = toMinutes(hours.start);
  const end = toMinutes(hours.end);

  if (hours.days.includes(isoDay) && minutes >= start && minutes < end) return at;

  const dayStartUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  // Bugün hâlâ açılmadıysa bugün; aksi halde sonraki mesai günü.
  const first = hours.days.includes(isoDay) && minutes < start ? 0 : 1;
  for (let i = first; i <= first + 7; i++) {
    const d = new Date(dayStartUtc + i * DAY_MS);
    const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    if (hours.days.includes(dow)) {
      return new Date(d.getTime() + start * 60000 - ISTANBUL_OFFSET_MS);
    }
  }
  return at; // days boşsa sayaç kaydırılamaz
}

export function clockStart(createdAt: Date, hours: BusinessHours): Date {
  return nextBusinessMoment(createdAt, hours);
}

/** Tam dakika (aşağı yuvarlanır); negatifse 0. */
export function elapsedMinutes(start: Date, now: Date): number {
  const diff = now.getTime() - start.getTime();
  return diff <= 0 ? 0 : Math.floor(diff / 60000);
}

/**
 * İki an arasındaki mesai içi tam dakika (aşağı yuvarlanır); ters sıradaysa 0.
 * Aday sayacı bununla sayar: 17:55'te gelen veli 18:00'de durur, ertesi sabah kaldığı yerden devam eder.
 */
export function businessMinutesBetween(start: Date, now: Date, hours: BusinessHours): number {
  if (now.getTime() <= start.getTime()) return 0;
  const last = istanbulDateString(now);
  let totalMs = 0;
  let day = istanbulDateString(start);
  // Üst sınır: çok eski kayıtta döngü sonsuza gitmesin (≈ 1 yıl).
  for (let i = 0; day <= last && i < 400; i++, day = addDaysToDateString(day, 1)) {
    if (!isBusinessDay(day, hours)) continue;
    const from = Math.max(istanbulAt(day, hours.start).getTime(), start.getTime());
    const to = Math.min(istanbulAt(day, hours.end).getTime(), now.getTime());
    if (to > from) totalMs += to - from;
  }
  return Math.floor(totalMs / 60000);
}

export function timerTone(minutes: number): "ok" | "warn" | "late" {
  if (minutes <= 5) return "ok";
  if (minutes <= 15) return "warn";
  return "late";
}

/** Anın İstanbul takvim günü: "YYYY-MM-DD". */
export function istanbulDateString(at: Date): string {
  return new Date(at.getTime() + ISTANBUL_OFFSET_MS).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" gününe n gün ekler (negatif olabilir). */
export function addDaysToDateString(dateString: string, n: number): string {
  return new Date(Date.parse(`${dateString}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" günü mesai günü mü? */
export function isBusinessDay(dateString: string, hours: BusinessHours): boolean {
  const dow = new Date(`${dateString}T00:00:00Z`).getUTCDay();
  return hours.days.includes(dow === 0 ? 7 : dow);
}

const dayTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Istanbul",
});

/** İstanbul saatiyle "Salı 4 Kasım 10:00". */
export function formatDayTime(at: Date): string {
  const parts = dayTimeFormatter.formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("weekday")} ${get("day")} ${get("month")} ${get("hour")}:${get("minute")}`;
}

/**
 * "YYYY-MM-DDTHH:MM[:SS]" İstanbul yerel saati (sabit +03:00) olarak okunur;
 * diğer biçimler Date ile çözülür. Geçersizse null.
 */
export function parseIstanbulDateTime(value: string): Date | null {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );

  if (match) {
    const [, year, month, day, hour, minute, second = "0"] = match;
    return new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour) - 3,
        Number(minute),
        Number(second),
      ),
    );
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
