// İçerik ayarları (app_settings). Varsayılanların tek kaynağı burasıdır; değerler 0017 tohumlarıyla aynıdır.
// Öğretmen yalnız yasakli_ifadeler ve icerik_limitleri anahtarlarını okur; reklam_kurallari ona varsayılanla döner.
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_BANNED_PHRASES } from "./checks";

export type ContentLimits = { reelsCaption: number; pageTitle: number; min: number };
export type AdRules = { targetTl: number; stopMultiple: number; winMin: number; noResultWeeks: number };
export type ContentRules = { banned: string[]; limits: ContentLimits; rules: AdRules };

export const DEFAULT_CONTENT_LIMITS: ContentLimits = { reelsCaption: 150, pageTitle: 30, min: 10 };
export const DEFAULT_AD_RULES: AdRules = { targetTl: 1000, stopMultiple: 3, winMin: 5, noResultWeeks: 3 };

const KEYS = ["yasakli_ifadeler", "icerik_limitleri", "reklam_kurallari"] as const;

function positive(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function nonNegative(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function parseBanned(value: unknown): string[] {
  if (!Array.isArray(value)) return DEFAULT_BANNED_PHRASES;
  return value.filter((s): s is string => typeof s === "string" && s.trim() !== "");
}

export function parseLimits(value: unknown): ContentLimits {
  const v = obj(value);
  return {
    reelsCaption: positive(v.reels_aciklama, DEFAULT_CONTENT_LIMITS.reelsCaption),
    pageTitle: positive(v.sayfa_baslik, DEFAULT_CONTENT_LIMITS.pageTitle),
    min: nonNegative(v.en_az, DEFAULT_CONTENT_LIMITS.min),
  };
}

export function parseAdRules(value: unknown): AdRules {
  const v = obj(value);
  return {
    targetTl: positive(v.hedef_nitelikli_tl, DEFAULT_AD_RULES.targetTl),
    stopMultiple: positive(v.durdur_kat, DEFAULT_AD_RULES.stopMultiple),
    winMin: positive(v.kazan_min_nitelikli, DEFAULT_AD_RULES.winMin),
    noResultWeeks: positive(v.sonucsuz_hafta, DEFAULT_AD_RULES.noResultWeeks),
  };
}

/** Ayarları okur; eksik ya da bozuk her anahtar için varsayılan kullanılır. */
export async function getContentRules(supabase: SupabaseClient): Promise<ContentRules> {
  const { data } = await supabase.from("app_settings").select("key, value").in("key", [...KEYS]);
  const map = new Map<string, unknown>(
    ((data ?? []) as { key: string; value: unknown }[]).map((r) => [r.key, r.value]),
  );
  return {
    banned: parseBanned(map.get("yasakli_ifadeler")),
    limits: parseLimits(map.get("icerik_limitleri")),
    rules: parseAdRules(map.get("reklam_kurallari")),
  };
}
