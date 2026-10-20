// AI konu önerisinin şeması, doğrulaması ve filtresi (saf modül).
// AI yalnız konu önerir; öneri yalnız görevi verenin ekranında görünür. Yasaklı ya da para ifadesi içeren öneri atılır.
import { z } from "zod";
import { checkText } from "@/lib/content/checks";
import { SLOT_ORDER, type WeeklySlot } from "@/lib/content/slots";

export type Suggestion = { baslik: string; aciklama: string; dayanak: string };
export type SlotSuggestions = Record<WeeklySlot, Suggestion[]>;

export const MAX_PER_SLOT = 3;
export const LIMITS = { baslik: 80, aciklama: 400, dayanak: 120 } as const;

const suggestionSchema = z.object({
  baslik: z.string().describe("Konu başlığı, en fazla 80 karakter"),
  aciklama: z.string().describe("2-3 cümle: ne anlatılacak ve neden bu hafta; en fazla 400 karakter"),
  dayanak: z.string().describe("Dayandığı okul artısı, okul bilgilerinden; en fazla 120 karakter"),
});

/** Claude'a yapılandırılmış çıktı şeması olarak giden şema (yalnız yapı; uzunluklar ayrıca denetlenir). */
export const aiOutputSchema = z.object({
  yuvalar: z.array(
    z.object({
      yuva: z.enum(SLOT_ORDER as [WeeklySlot, ...WeeklySlot[]]),
      oneriler: z.array(suggestionSchema),
    }),
  ),
});

export type AiOutput = z.infer<typeof aiOutputSchema>;

/** Para ifadeleri: danışman harcama görmez, öneri gerekçesi para göstermez. */
const MONEY_RE = /₺|(?<![\p{L}\p{N}])(tl|lira|bütçe|butce|harcama|harcan|maliyet|kuruş|kurus)/u;

/** Önerinin atılma nedeni; geçerliyse null. */
export function suggestionProblem(s: Suggestion, banned: string[]): string | null {
  const fields: [keyof Suggestion, number][] = [
    ["baslik", LIMITS.baslik],
    ["aciklama", LIMITS.aciklama],
    ["dayanak", LIMITS.dayanak],
  ];
  for (const [key, max] of fields) {
    const value = s[key].trim();
    if (value.length < 3) return `${key} boş`;
    if (value.length > max) return `${key} ${max} karakteri aştı`;
  }
  const all = `${s.baslik}\n${s.aciklama}\n${s.dayanak}`;
  // Panelin metin kontrolüyle aynı eşleşme (ekler dahil, Türkçe harf katlamalı).
  const check = checkText(all, { max: Number.MAX_SAFE_INTEGER, min: 0, banned });
  if (!check.ok) return check.message;
  if (MONEY_RE.test(all.toLocaleLowerCase("tr"))) return "para ifadesi içeriyor";
  return null;
}

/** Ham çıktıyı doğrular; şema dışıysa null. Yuva başına en çok 3 geçerli, başlığı tekil öneri döner. */
export function cleanSuggestions(raw: unknown, banned: string[]): SlotSuggestions | null {
  const parsed = aiOutputSchema.safeParse(raw);
  if (!parsed.success) return null;
  const out = Object.fromEntries(SLOT_ORDER.map((s) => [s, [] as Suggestion[]])) as SlotSuggestions;
  for (const group of parsed.data.yuvalar) {
    const list = out[group.yuva];
    for (const o of group.oneriler) {
      if (list.length >= MAX_PER_SLOT) break;
      const s: Suggestion = { baslik: o.baslik.trim(), aciklama: o.aciklama.trim(), dayanak: o.dayanak.trim() };
      const problem = suggestionProblem(s, banned);
      if (problem) {
        console.warn("[ai-gorev] öneri atıldı:", problem);
        continue;
      }
      const key = s.baslik.toLocaleLowerCase("tr");
      if (list.some((x) => x.baslik.toLocaleLowerCase("tr") === key)) continue;
      list.push(s);
    }
  }
  return out;
}
