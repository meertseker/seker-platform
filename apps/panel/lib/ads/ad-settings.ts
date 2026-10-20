// Reklam ayarları ve hedefler (app_settings). Varsayılanların tek kaynağı burasıdır; değerler 0017/0018 tohumlarıyla aynıdır.
// Öğretmen yalnız yasakli_ifadeler ve icerik_limitleri okuyabilir; diğer anahtarlar ona varsayılanla döner.
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_BANNED_PHRASES } from "@/lib/content/checks";

export type AdSettings = {
  targetTl: number;
  stopMultiple: number;
  winMin: number;
  noResultWeeks: number;
  scaleMaxPct: number;
  fatigueFrequency: number;
  fatigueCtrDropPct: number;
  gates: { firstCallMin: number; reachPct: number; apptPct: number; showPct: number };
  monthlyBudget: { googleTl: number; metaTl: number };
  banned: string[];
  limits: { reelsCaption: number; pageTitle: number; min: number };
};

export const DEFAULT_AD_SETTINGS: AdSettings = {
  targetTl: 1000,
  stopMultiple: 3,
  winMin: 5,
  noResultWeeks: 3,
  scaleMaxPct: 20,
  fatigueFrequency: 3,
  fatigueCtrDropPct: 30,
  gates: { firstCallMin: 15, reachPct: 80, apptPct: 35, showPct: 70 },
  monthlyBudget: { googleTl: 0, metaTl: 0 },
  banned: DEFAULT_BANNED_PHRASES,
  limits: { reelsCaption: 150, pageTitle: 30, min: 10 },
};

export const AD_SETTING_KEYS = ["reklam_kurallari", "kapi_esikleri", "aylik_butce", "yasakli_ifadeler", "icerik_limitleri"] as const;

function positive(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function nonNegative(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Satırlardan ayarları kurar; eksik ya da bozuk her alan varsayılana düşer. */
export function parseAdSettings(rows: { key: string; value: unknown }[]): AdSettings {
  const map = new Map<string, unknown>(rows.map((r) => [r.key, r.value]));
  const d = DEFAULT_AD_SETTINGS;
  const rules = obj(map.get("reklam_kurallari"));
  const gates = obj(map.get("kapi_esikleri"));
  const budget = obj(map.get("aylik_butce"));
  const limits = obj(map.get("icerik_limitleri"));
  const banned = map.get("yasakli_ifadeler");
  return {
    targetTl: positive(rules.hedef_nitelikli_tl, d.targetTl),
    stopMultiple: positive(rules.durdur_kat, d.stopMultiple),
    winMin: positive(rules.kazan_min_nitelikli, d.winMin),
    noResultWeeks: positive(rules.sonucsuz_hafta, d.noResultWeeks),
    scaleMaxPct: positive(rules.buyutme_yuzde, d.scaleMaxPct),
    fatigueFrequency: positive(rules.yorgunluk_siklik, d.fatigueFrequency),
    fatigueCtrDropPct: positive(rules.yorgunluk_ctr_dusus_yuzde, d.fatigueCtrDropPct),
    gates: {
      firstCallMin: positive(gates.ilk_arama_dk, d.gates.firstCallMin),
      reachPct: nonNegative(gates.ulasma_yuzde, d.gates.reachPct),
      apptPct: nonNegative(gates.randevu_yuzde, d.gates.apptPct),
      showPct: nonNegative(gates.gelme_yuzde, d.gates.showPct),
    },
    monthlyBudget: {
      googleTl: nonNegative(budget.google_tl, d.monthlyBudget.googleTl),
      metaTl: nonNegative(budget.meta_tl, d.monthlyBudget.metaTl),
    },
    banned: Array.isArray(banned)
      ? banned.filter((s): s is string => typeof s === "string" && s.trim() !== "")
      : d.banned,
    limits: {
      reelsCaption: positive(limits.reels_aciklama, d.limits.reelsCaption),
      pageTitle: positive(limits.sayfa_baslik, d.limits.pageTitle),
      min: nonNegative(limits.en_az, d.limits.min),
    },
  };
}

/** Ayarları okur; öğretmen oturumunda görünmeyen anahtarlar varsayılanla gelir. */
export async function getAdSettings(supabase: SupabaseClient): Promise<AdSettings> {
  const { data } = await supabase.from("app_settings").select("key, value").in("key", [...AD_SETTING_KEYS]);
  return parseAdSettings((data ?? []) as { key: string; value: unknown }[]);
}
