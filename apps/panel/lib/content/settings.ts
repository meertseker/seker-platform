// İçerik ayarları (app_settings). Okuma getAdSettings üzerinden yapılır; varsayılanların tek kaynağı lib/ads/ad-settings.ts'tir.
// Öğretmen yalnız yasakli_ifadeler ve icerik_limitleri anahtarlarını okur; reklam_kurallari ona varsayılanla döner.
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_AD_SETTINGS, getAdSettings } from "@/lib/ads/ad-settings";

export type ContentLimits = { reelsCaption: number; pageTitle: number; min: number };
export type AdRules = { targetTl: number; stopMultiple: number; winMin: number; noResultWeeks: number };
export type ContentRules = { banned: string[]; limits: ContentLimits; rules: AdRules };

export const DEFAULT_CONTENT_LIMITS: ContentLimits = DEFAULT_AD_SETTINGS.limits;
export const DEFAULT_AD_RULES: AdRules = {
  targetTl: DEFAULT_AD_SETTINGS.targetTl,
  stopMultiple: DEFAULT_AD_SETTINGS.stopMultiple,
  winMin: DEFAULT_AD_SETTINGS.winMin,
  noResultWeeks: DEFAULT_AD_SETTINGS.noResultWeeks,
};

/** Ayarları okur; eksik ya da bozuk her anahtar için varsayılan kullanılır. */
export async function getContentRules(supabase: SupabaseClient): Promise<ContentRules> {
  const s = await getAdSettings(supabase);
  return {
    banned: s.banned,
    limits: { ...s.limits },
    rules: { targetTl: s.targetTl, stopMultiple: s.stopMultiple, winMin: s.winMin, noResultWeeks: s.noResultWeeks },
  };
}
