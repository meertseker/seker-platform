// Haftanın dört içerik yuvası (saf modül). "Bu hafta" toplantısı ve "Görev ver" ekranı aynı tanımı kullanır.
import { weekStart, type ContentKind, type PagePlatform, type ReelsLetter } from "./codes";
import { addDaysToDateString, istanbulDateString, parseIstanbulDateTime } from "@/lib/lead-flow/business-hours";

export type WeeklySlot = "reels_a" | "reels_b" | "sayfa_google" | "sayfa_instagram";

export type SlotDef = {
  label: string;
  kind: ContentKind;
  /** İçerik kodunun son harfi (R-..-A, R-..-B, S-..-G, S-..-I). */
  letter: string;
  reelsLetter?: ReelsLetter;
  pagePlatform?: PagePlatform;
};

export const SLOTS: Record<WeeklySlot, SlotDef> = {
  reels_a: { label: "Reels A", kind: "reels", letter: "A", reelsLetter: "A" },
  reels_b: { label: "Reels B", kind: "reels", letter: "B", reelsLetter: "B" },
  sayfa_google: { label: "Sayfa · Google", kind: "sayfa", letter: "G", pagePlatform: "google" },
  sayfa_instagram: { label: "Sayfa · Instagram", kind: "sayfa", letter: "I", pagePlatform: "instagram" },
};

export const SLOT_ORDER: WeeklySlot[] = ["reels_a", "reels_b", "sayfa_google", "sayfa_instagram"];

export function isWeeklySlot(value: unknown): value is WeeklySlot {
  return typeof value === "string" && (SLOT_ORDER as string[]).includes(value);
}

/** Kodun yuvası: "R-2643-B" → reels_b; "S-2643-I" → sayfa_instagram. Bilinmeyen kod null. */
export function slotOfCode(code: string): WeeklySlot | null {
  const prefix = code.charAt(0);
  const letter = code.slice(-1);
  return SLOT_ORDER.find((s) => (SLOTS[s].kind === "reels" ? "R" : "S") === prefix && SLOTS[s].letter === letter) ?? null;
}

/** Görev ver ekranında seçilebilen haftalar: bu hafta ve gelecek hafta (İstanbul Pazartesi'leri). */
export function allowedTaskWeeks(now: Date): [string, string] {
  const current = weekStart(now);
  return [current, addDaysToDateString(current, 7)];
}

/** Varsayılan teslim ("YYYY-MM-DDTHH:MM", İstanbul): haftanın Perşembesi 17:00; o an geçtiyse ertesi gün 17:00. */
export function defaultTaskDue(week: string, now: Date): string {
  const thursday = `${addDaysToDateString(week, 3)}T17:00`;
  const at = parseIstanbulDateTime(thursday);
  if (at && at.getTime() > now.getTime()) return thursday;
  return `${addDaysToDateString(istanbulDateString(now), 1)}T17:00`;
}
