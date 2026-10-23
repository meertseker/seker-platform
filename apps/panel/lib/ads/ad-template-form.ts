// Z6 reklam şablonu formu ve kampanya kurulum kartının saf yardımcıları (istemci ve testler ortak kullanır).
// "Şimdi"yi okumaz; tarih yalnız verilen ISO metinden biçimlenir.
import type { AdSetup } from "@/lib/ads/ad-setup";
import type { AdTemplateInput } from "@/lib/ads/ad-template";

type FormValues = Record<string, string | boolean | undefined>;

function text(v: string | boolean | undefined): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Ondalık alan: virgül ya da nokta; boş → null, sayı değilse NaN (doğrulama reddeder). */
function decimalOrNull(v: string | boolean | undefined): number | null {
  const s = text(v).replace(/\s/g, "");
  if (s === "") return null;
  if (!/^[+-]?\d+([.,]\d+)?$/.test(s)) return Number.NaN;
  return Number(s.replace(",", "."));
}

/** Tam sayı alanı: "1.500" gibi binlik ayırıcı kabul edilir; boş ya da sayı değilse NaN (0 değil). */
function integerish(v: string | boolean | undefined): number {
  let s = text(v).replace(/\s/g, "");
  if (s === "") return Number.NaN;
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^[+-]?\d+([.,]\d+)?$/.test(s)) return Number.NaN;
  return Number(s.replace(",", "."));
}

function bool(v: string | boolean | undefined): boolean {
  if (typeof v === "boolean") return v;
  return v === "true" || v === "on";
}

/** Form alanlarını `saveAdTemplate` girdisine çevirir; asıl doğrulama sunucudadır (`validateAdTemplate`). */
export function formToTemplateInput(form: FormValues): AdTemplateInput {
  return {
    okulAdres: text(form.okulAdres),
    lat: decimalOrNull(form.lat),
    lng: decimalOrNull(form.lng),
    yaricapKm: integerish(form.yaricapKm),
    yasMin: integerish(form.yasMin),
    yasMax: integerish(form.yasMax),
    testGunlukTl: integerish(form.testGunlukTl),
    buyutmeGunlukTl: integerish(form.buyutmeGunlukTl),
    haftalikYeniReklam: integerish(form.haftalikYeniReklam),
    mevcutVelileriHaricTut: bool(form.mevcutVelileriHaricTut),
  };
}

export type SetupCardState = { label: "Hazır" | "Kurulmadı"; sub: string; canSetup: boolean };

/** "Test ve Büyütme kampanyaları" satırı: kurulduysa Hazır; değilse canlı yazım açıkken kurulabilir. */
export function setupCardState(setup: AdSetup | null, writeEnabled: boolean): SetupCardState {
  if (setup) return { label: "Hazır", sub: "Meta'da tek seferlik kuruldu · 2 kampanya", canSetup: false };
  if (!writeEnabled) {
    return { label: "Kurulmadı", sub: "Canlı yazım kapalı: yalnız 'Sadece göster' çalışır.", canSetup: false };
  }
  return { label: "Kurulmadı", sub: "Tek seferlik kurulur; ikisi de duraklatılmış açılır.", canSetup: true };
}

const dayMonth = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: "Europe/Istanbul" });

/** "Son değişiklik: <ad> · <gün ay>" (İstanbul); tarih yoksa ya da okunamıyorsa null. */
export function templateUpdatedText(name: string | null, updatedAt: string | null): string | null {
  if (!updatedAt) return null;
  const d = new Date(updatedAt);
  if (Number.isNaN(d.getTime())) return null;
  const date = dayMonth.format(d);
  return name ? `Son değişiklik: ${name} · ${date}` : `Son değişiklik: ${date}`;
}
