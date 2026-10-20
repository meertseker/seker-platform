// İçerik kodu ve ISO hafta yardımcıları (saf modül). K5: Reels R-<yy><ww>-<A|B|C>, sayfa S-<yy><ww>-<G|I>.
import { addDaysToDateString, istanbulDateString } from "@/lib/lead-flow/business-hours";

export type ContentKind = "reels" | "sayfa";
export type PagePlatform = "google" | "instagram";

/** "YYYY-MM-DD" gününün haftanın günü: 1=Pazartesi … 7=Pazar. */
function isoWeekday(dateString: string): number {
  const d = new Date(`${dateString}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** İstanbul gününe göre ISO yılı ve hafta numarası (haftayı Perşembe belirler). */
export function isoWeek(d: Date): { year: number; week: number } {
  const day = istanbulDateString(d);
  const thursday = addDaysToDateString(day, 4 - isoWeekday(day));
  const year = Number(thursday.slice(0, 4));
  const jan1 = Date.parse(`${year}-01-01T00:00:00Z`);
  const dayOfYear = Math.round((Date.parse(`${thursday}T00:00:00Z`) - jan1) / 86_400_000);
  return { year, week: Math.floor(dayOfYear / 7) + 1 };
}

/** O haftanın Pazartesi günü (İstanbul): "YYYY-MM-DD". */
export function weekStart(d: Date): string {
  const day = istanbulDateString(d);
  return addDaysToDateString(day, -(isoWeekday(day) - 1));
}

const REELS_LETTERS = ["A", "B", "C"];

export type ReelsLetter = "A" | "B" | "C";

/**
 * Haftanın bir sonraki boş içerik kodu; harfler doluysa null.
 * taken: tam kodlar ("R-2645-A"); başka haftanınkiler yok sayılır.
 * reelsLetter: Reels için yalnız bu harf (Bu hafta ekranının slotu); doluysa null.
 */
export function nextContentCode(
  kind: ContentKind,
  at: Date,
  taken: string[],
  pagePlatform: PagePlatform = "google",
  reelsLetter?: ReelsLetter,
): string | null {
  const { year, week } = isoWeek(at);
  const prefix = `${kind === "reels" ? "R" : "S"}-${String(year % 100).padStart(2, "0")}${String(week).padStart(2, "0")}-`;
  const reels = reelsLetter && REELS_LETTERS.includes(reelsLetter) ? [reelsLetter] : REELS_LETTERS;
  const letters = kind === "reels" ? reels : [pagePlatform === "instagram" ? "I" : "G"];
  const free = letters.find((l) => !taken.includes(prefix + l));
  return free ? prefix + free : null;
}
