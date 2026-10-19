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

export function timerTone(minutes: number): "ok" | "warn" | "late" {
  if (minutes <= 5) return "ok";
  if (minutes <= 15) return "warn";
  return "late";
}
