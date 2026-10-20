// Haftanın dört içerik yuvası (saf modül). "Bu hafta" toplantısı ve "Görev ver" ekranı aynı tanımı kullanır.
import type { ContentKind, PagePlatform, ReelsLetter } from "./codes";

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
