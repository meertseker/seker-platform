// Bildirim listesi için İstanbul takvim gününe göre gruplama ve zaman etiketi.
import { istanbulDateString } from "@/lib/cron-rules";

export type NotificationGroupLabel = "Bugün" | "Dün" | "Daha eski";

export interface NotificationGroup<T> {
  label: NotificationGroupLabel;
  items: T[];
}

function istanbulDay(value: string): string | null {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : istanbulDateString(new Date(ms));
}

// Takvim günü üzerinden bir gün geri: saat farkından bağımsız.
function previousDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function dayLabel(created: string, now: Date): NotificationGroupLabel {
  const day = istanbulDay(created);
  const today = istanbulDateString(now);
  if (day === today) return "Bugün";
  if (day === previousDay(today)) return "Dün";
  return "Daha eski";
}

const ORDER: NotificationGroupLabel[] = ["Bugün", "Dün", "Daha eski"];

/** Sıra korunur, boş gruplar düşer. */
export function groupNotificationsByDay<T extends { created_at: string }>(
  items: T[],
  now: Date,
): NotificationGroup<T>[] {
  const buckets = new Map<NotificationGroupLabel, T[]>(ORDER.map((label) => [label, []]));
  for (const item of items) buckets.get(dayLabel(item.created_at, now))!.push(item);
  return ORDER.filter((label) => buckets.get(label)!.length > 0).map((label) => ({
    label,
    items: buckets.get(label)!,
  }));
}

const timeFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "numeric",
  month: "short",
});
const dateWithYearFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "14:05" (bugün), "dün 09:12", "12 Eki" ya da başka yılda "12 Eki 2025". */
export function formatNotificationTime(created: string, now: Date): string {
  const ms = Date.parse(created);
  if (Number.isNaN(ms)) return "";
  const date = new Date(ms);
  const label = dayLabel(created, now);
  if (label === "Bugün") return timeFormatter.format(date);
  if (label === "Dün") return `dün ${timeFormatter.format(date)}`;
  const sameYear = istanbulDateString(date).slice(0, 4) === istanbulDateString(now).slice(0, 4);
  return (sameYear ? dateFormatter : dateWithYearFormatter).format(date);
}
