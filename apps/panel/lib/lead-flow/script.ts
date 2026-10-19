// Arama ekranı yardımcıları (saf modül): konuşma metni ve önerilen ziyaret saatleri.
import {
  addDaysToDateString,
  type BusinessHours,
  istanbulAt,
  istanbulDateString,
  isBusinessDay,
} from "./business-hours";
import { DEFAULT_CONFLICT_MINUTES } from "./conflict-window";

export { ageFromBirth } from "./age";

export type ScriptVars = { veli: string; danisman: string; cocukYasi: string; semt: string };

/** {veli}, {danisman}, {cocuk_yasi}, {semt} doldurulur; bilinmeyen yer tutucu olduğu gibi kalır. */
export function fillScript(lines: string[], vars: ScriptVars): string[] {
  const map: Record<string, string> = {
    veli: vars.veli,
    danisman: vars.danisman,
    cocuk_yasi: vars.cocukYasi,
    semt: vars.semt,
  };
  return lines.map((line) =>
    line.replace(/\{(\w+)\}/g, (match, key: string) => (Object.hasOwn(map, key) ? map[key] : match)),
  );
}

/** Ziyaret için önerilen saatler (İstanbul). */
export const SLOT_CANDIDATES = ["10:00", "11:00", "16:30"] as const;
const SLOT_DAYS = 5;

/**
 * Önümüzdeki 5 iş gününde (bugün dahil), 10:00 / 11:00 / 16:30 adaylarından geçmemiş, mesai içinde
 * kalan ve bekleyen bir randevuyla `windowMinutes` (cakisma_dakika; sınır dahil) içinde çakışmayan
 * ilk `count` saat. Dönen değer "YYYY-MM-DDTHH:MM" İstanbul yerel saatidir.
 */
export function suggestSlots(
  existing: { scheduled_at: string }[],
  now: Date,
  hours: BusinessHours,
  count = 3,
  windowMinutes = DEFAULT_CONFLICT_MINUTES,
): string[] {
  const taken = existing.map((a) => Date.parse(a.scheduled_at)).filter((t) => Number.isFinite(t));
  const windowMs = windowMinutes * 60_000;
  const out: string[] = [];
  let day = istanbulDateString(now);
  // Mesai günü yoksa sonsuz döngüye girmesin: en çok iki hafta ileri bakılır.
  for (let seen = 0, i = 0; seen < SLOT_DAYS && i < 14 && out.length < count; i++, day = addDaysToDateString(day, 1)) {
    if (!isBusinessDay(day, hours)) continue;
    seen++;
    const open = istanbulAt(day, hours.start).getTime();
    const close = istanbulAt(day, hours.end).getTime();
    for (const hhmm of SLOT_CANDIDATES) {
      const at = istanbulAt(day, hhmm).getTime();
      if (at <= now.getTime() || at < open || at >= close) continue;
      if (taken.some((t) => Math.abs(t - at) <= windowMs)) continue;
      out.push(`${day}T${hhmm}`);
      if (out.length >= count) break;
    }
  }
  return out;
}

const WEEKDAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

/** Öneri düğmesi etiketi: "Bugün 16:30", "Yarın 10:00", "Perşembe 11:00" (5 iş günü içinde gün adı tekrarlamaz). */
export function slotLabel(slot: string, now: Date): string {
  const [day, hhmm] = slot.split("T");
  const today = istanbulDateString(now);
  if (day === today) return `Bugün ${hhmm}`;
  if (day === addDaysToDateString(today, 1)) return `Yarın ${hhmm}`;
  return `${WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()]} ${hhmm}`;
}
