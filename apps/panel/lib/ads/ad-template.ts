// Reklam şablonu (K19/K27, app_settings.reklam_sablonu) ve aylık Meta tavanı (B8).
// Varsayılanların tek kaynağı burasıdır; değerler 0026 tohumuyla aynıdır. Saf yardımcılar "şimdi"yi okumaz.
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatTl } from "@/lib/content/board";

export type AdTemplate = {
  okulAdres: string;
  lat: number | null;
  lng: number | null;
  yaricapKm: number;
  yasMin: number;
  yasMax: number;
  testGunlukTl: number;
  buyutmeGunlukTl: number;
  mevcutVelileriHaricTut: boolean;
  /** Pazartesi'den beri en çok kaç yeni reklam kurulur (B19). */
  haftalikYeniReklam: number;
  updatedBy: string | null;
  updatedAt: string | null;
};

export type AdTemplateInput = Omit<AdTemplate, "updatedBy" | "updatedAt">;

export const AD_TEMPLATE_KEY = "reklam_sablonu";
export const WEEKLY_NEW_AD_LIMIT_DEFAULT = 4;

export const DEFAULT_AD_TEMPLATE: AdTemplate = {
  okulAdres: "",
  lat: null,
  lng: null,
  yaricapKm: 8,
  yasMin: 25,
  yasMax: 45,
  testGunlukTl: 200,
  buyutmeGunlukTl: 400,
  mevcutVelileriHaricTut: true,
  haftalikYeniReklam: WEEKLY_NEW_AD_LIMIT_DEFAULT,
  updatedBy: null,
  updatedAt: null,
};

const ADDRESS_MIN = 5;
const ADDRESS_MAX = 200;
const RADIUS_MIN = 1;
const RADIUS_MAX = 80;
const AGE_MIN = 18;
const AGE_MAX = 65;
const BUDGET_MIN = 50;
const BUDGET_MAX = 100_000;
const WEEKLY_MIN = 1;
const WEEKLY_MAX = 20;

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function intIn(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function numIn(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function int(value: unknown, min: number, max: number, fallback: number): number {
  return intIn(value, min, max) ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/** Kayıttaki şablonu okur; eksik ya da bozuk her alan varsayılana düşer. */
export function parseAdTemplate(value: unknown): AdTemplate {
  const v = obj(value);
  const d = DEFAULT_AD_TEMPLATE;
  const hasLocation = numIn(v.lat, -90, 90) && numIn(v.lng, -180, 180);
  let yasMin = int(v.yasMin, AGE_MIN, AGE_MAX, d.yasMin);
  let yasMax = int(v.yasMax, AGE_MIN, AGE_MAX, d.yasMax);
  if (yasMax < yasMin) {
    yasMin = d.yasMin;
    yasMax = d.yasMax;
  }
  return {
    okulAdres: typeof v.okulAdres === "string" ? v.okulAdres.trim() : d.okulAdres,
    lat: hasLocation ? (v.lat as number) : null,
    lng: hasLocation ? (v.lng as number) : null,
    yaricapKm: int(v.yaricapKm, RADIUS_MIN, RADIUS_MAX, d.yaricapKm),
    yasMin,
    yasMax,
    testGunlukTl: int(v.testGunlukTl, BUDGET_MIN, BUDGET_MAX, d.testGunlukTl),
    buyutmeGunlukTl: int(v.buyutmeGunlukTl, BUDGET_MIN, BUDGET_MAX, d.buyutmeGunlukTl),
    mevcutVelileriHaricTut:
      typeof v.mevcutVelileriHaricTut === "boolean" ? v.mevcutVelileriHaricTut : d.mevcutVelileriHaricTut,
    haftalikYeniReklam: int(v.haftalikYeniReklam, WEEKLY_MIN, WEEKLY_MAX, d.haftalikYeniReklam),
    updatedBy: nullableString(v.updatedBy),
    updatedAt: nullableString(v.updatedAt),
  };
}

/** Ayarlar formundan gelen şablonu doğrular; ilk hatayı Türkçe döner. */
export function validateAdTemplate(input: unknown): { ok: true; value: AdTemplateInput } | { error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "Şablon okunamadı." };
  const v = input as Record<string, unknown>;
  const okulAdres = typeof v.okulAdres === "string" ? v.okulAdres.trim() : "";
  if (okulAdres.length < ADDRESS_MIN || okulAdres.length > ADDRESS_MAX) {
    return { error: `Okul adresi ${ADDRESS_MIN}–${ADDRESS_MAX} karakter olmalı.` };
  }
  if (!numIn(v.lat, -90, 90) || !numIn(v.lng, -180, 180)) {
    return { error: "Okul konumu geçersiz: enlem −90..90, boylam −180..180 olmalı." };
  }
  if (!intIn(v.yaricapKm, RADIUS_MIN, RADIUS_MAX)) return { error: "Yarıçap 1–80 km olmalı." };
  if (!intIn(v.yasMin, AGE_MIN, AGE_MAX)) return { error: "En küçük yaş 18–65 olmalı." };
  if (!intIn(v.yasMax, v.yasMin, AGE_MAX)) return { error: "En büyük yaş, en küçük yaş ile 65 arasında olmalı." };
  if (!intIn(v.testGunlukTl, BUDGET_MIN, BUDGET_MAX)) {
    return { error: "Test günlük bütçesi 50–100.000 TL arasında tam sayı olmalı." };
  }
  if (!intIn(v.buyutmeGunlukTl, BUDGET_MIN, BUDGET_MAX)) {
    return { error: "Büyütme günlük bütçesi 50–100.000 TL arasında tam sayı olmalı." };
  }
  if (typeof v.mevcutVelileriHaricTut !== "boolean") return { error: "Mevcut veliler seçimi okunamadı." };
  if (!intIn(v.haftalikYeniReklam, WEEKLY_MIN, WEEKLY_MAX)) {
    return { error: "Haftalık yeni reklam sınırı 1–20 olmalı." };
  }
  return {
    ok: true,
    value: {
      okulAdres,
      lat: v.lat,
      lng: v.lng,
      yaricapKm: v.yaricapKm,
      yasMin: v.yasMin,
      yasMax: v.yasMax,
      testGunlukTl: v.testGunlukTl,
      buyutmeGunlukTl: v.buyutmeGunlukTl,
      mevcutVelileriHaricTut: v.mevcutVelileriHaricTut,
      haftalikYeniReklam: v.haftalikYeniReklam,
    },
  };
}

/** Kurulumu engelleyen eksikler; boş dizi şablonun dolu olduğu anlamına gelir. */
export function templateGaps(t: AdTemplate): string[] {
  const gaps: string[] = [];
  if (t.okulAdres.trim().length < ADDRESS_MIN) gaps.push("Okul adresi");
  if (t.lat === null || t.lng === null) gaps.push("Okul konumu");
  return gaps;
}

/** Ayın kalan günü, bugün dahil. `today` İstanbul yerel tarihidir ("YYYY-MM-DD"). */
export function remainingDaysInMonth(today: string): number {
  const [y, m, d] = today.split("-").map(Number);
  // Date.UTC(y, m, 0): m. ayın (1 tabanlı) son günü.
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return daysInMonth - d + 1;
}

const ONES_SUFFIX = ["ı", "i", "si", "ü", "ü", "i", "sı", "si", "i", "u"]; // sıfır, bir, iki, üç, dört, beş, altı, yedi, sekiz, dokuz
const TENS_SUFFIX = ["", "u", "si", "u", "ı", "si", "ı", "i", "i", "ı"]; // on, yirmi, otuz, kırk, elli, altmış, yetmiş, seksen, doksan

/** Sesli okunan sayının iyelik eki: 64 → "ü" (%64'ü), 60 → "ı", 50 → "si", 6 → "sı". */
export function percentSuffix(n: number): string {
  const v = Math.abs(Math.round(n));
  if (v === 0) return ONES_SUFFIX[0];
  if (v % 10 !== 0) return ONES_SUFFIX[v % 10];
  if (v % 100 !== 0) return TENS_SUFFIX[(v % 100) / 10];
  if (v % 1000 !== 0) return "ü"; // yüz
  return "i"; // bin
}

export type CapCheck = { ok: boolean; needTl: number; leftTl: number; leftPct: number | null; message: string };

/**
 * B8: ay başından Meta harcaması + (test + büyütme günlük) × kalan gün ≤ aylık Meta bütçesi.
 * Şablon kaydı, kampanya kurulumu, "Teste al" ve "Büyütmeye taşı" aynı fonksiyonu kullanır.
 */
export function monthlyCapCheck(i: {
  monthSpendTl: number;
  testGunlukTl: number;
  buyutmeGunlukTl: number;
  metaTl: number;
  today: string;
}): CapCheck {
  const needTl = i.monthSpendTl + (i.testGunlukTl + i.buyutmeGunlukTl) * remainingDaysInMonth(i.today);
  const leftTl = i.metaTl - i.monthSpendTl;
  const leftPct = i.metaTl > 0 ? Math.round((leftTl / i.metaTl) * 100) : null;
  if (i.metaTl <= 0) return { ok: false, needTl, leftTl, leftPct, message: "Aylık Meta bütçesi Ayarlar'da 0" };
  if (needTl > i.metaTl) {
    return {
      ok: false,
      needTl,
      leftTl,
      leftPct,
      message: `Aylık Meta bütçesi yetmiyor: ay sonuna ${formatTl(needTl)} gerekiyor, bütçe ${formatTl(i.metaTl)}`,
    };
  }
  const pct = leftPct ?? 0;
  return {
    ok: true,
    needTl,
    leftTl,
    leftPct,
    message: `Bütçe şablondan; aylık bütçenin %${pct}'${percentSuffix(pct)} kaldı`,
  };
}

/** Şablonu okur; satır yoksa ya da okunamazsa varsayılan döner. */
export async function getAdTemplate(supabase: SupabaseClient): Promise<AdTemplate> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", AD_TEMPLATE_KEY).maybeSingle();
  return parseAdTemplate((data as { value?: unknown } | null)?.value);
}
