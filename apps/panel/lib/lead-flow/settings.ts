// Ön büro akışı ayarları (app_settings). Varsayılanların tek kaynağı burasıdır;
// değerler 0014 migration tohumlarıyla aynıdır.
import type { SupabaseClient } from "@supabase/supabase-js";
import { type BusinessHours, DEFAULT_BUSINESS_HOURS } from "./business-hours";

export type WaTemplate = { key: string; label: string; text: string };

export type LeadFlowSettings = {
  hours: BusinessHours;
  districts: string[];
  callScript: string[];
  priceAnswer: string;
  templates: WaTemplate[];
  claimMinutes: number;
};

export const DEFAULT_DISTRICTS: string[] = ["Beykent", "Beylikdüzü", "Büyükçekmece", "Esenyurt", "Gürpınar", "Yakuplu"];

export const DEFAULT_CALL_SCRIPT: string[] = [
  "Merhaba {veli}, Şeker Anaokulu'ndan {danisman}. Formunuz için arıyorum, uygun musunuz?",
  "Formu doğrula: \"Çocuğunuz {cocuk_yasi} yaşında, {semt}'tesiniz, doğru mu?\"",
  "Dinle: \"Okul seçerken sizin için en önemli şey ne?\" Cevabı aşağıya not et.",
  "Ziyarete davet et, iki saat söyle: \"Salı 10:00 mı, Perşembe 16:30 mu?\"",
];

export const DEFAULT_PRICE_ANSWER =
  "Aylık ücretlerimiz programa göre [ARALIK] TL arasında. En doğrusu okulu görüp öğretmenimizle tanışmanız. Salı mı Perşembe mi uygun?";

export const DEFAULT_TEMPLATES: WaTemplate[] = [
  { key: "ulasilamadi", label: "Ulaşamadım", text: "Merhaba {veli}, Şeker Anaokulu'ndan {danisman}. Formunuz için aradım, ulaşamadım. Size uygun bir saatte tekrar arayabilir miyim?" },
  { key: "ziyaret_saatleri", label: "Ziyaret saatleri", text: "Merhaba {veli}, Şeker Anaokulu'ndan {danisman}. Okulu gezmek için Salı 10:00 ya da Perşembe 16:30 uygundur. Hangisi size uyar?" },
  { key: "randevu_onay", label: "Randevu onayı", text: "Merhaba {veli}, ziyaret randevunuz onaylandı. Sizi okulumuzda ağırlamaktan memnuniyet duyarız. - {danisman}, Şeker Anaokulu" },
  { key: "ziyaret_tesekkur", label: "Ziyaret teşekkürü", text: "Merhaba {veli}, bugün okulumuzu ziyaret ettiğiniz için teşekkür ederiz. Aklınıza takılan her şeyi bana yazabilirsiniz. - {danisman}, Şeker Anaokulu" },
  { key: "kontenjan", label: "Kontenjan", text: "Merhaba {veli}, Şeker Anaokulu'ndan {danisman}. Kontenjanlarımız sınırlıdır; yer ayırtmak isterseniz size yardımcı olabilirim." },
];

export const DEFAULT_CLAIM_MINUTES = 15;

const KEYS = ["mesai", "servis_semtleri", "arama_metni", "fiyat_cevabi", "wa_sablonlari", "ustlenme_dk"] as const;

function hhmmToMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function parseBusinessHours(value: unknown): BusinessHours {
  if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_BUSINESS_HOURS;
  const v = value as Record<string, unknown>;
  const start = hhmmToMinutes(v.start);
  const end = hhmmToMinutes(v.end);
  const days = v.days;
  const daysOk =
    Array.isArray(days) && days.length > 0 && days.every((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  if (start === null || end === null || start >= end || !daysOk) return DEFAULT_BUSINESS_HOURS;
  return { days: [...new Set(days as number[])].sort((a, b) => a - b), start: v.start as string, end: v.end as string };
}

function parseStringList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const list = value.filter((s): s is string => typeof s === "string" && s.trim() !== "");
  return list.length > 0 ? list : fallback;
}

function parseTemplates(value: unknown): WaTemplate[] {
  if (!Array.isArray(value)) return DEFAULT_TEMPLATES;
  const list = value.filter(
    (t): t is WaTemplate =>
      !!t && typeof t === "object" &&
      typeof (t as WaTemplate).key === "string" && (t as WaTemplate).key !== "" &&
      typeof (t as WaTemplate).label === "string" &&
      typeof (t as WaTemplate).text === "string" && (t as WaTemplate).text.trim() !== "",
  );
  return list.length > 0 ? list.map(({ key, label, text }) => ({ key, label, text })) : DEFAULT_TEMPLATES;
}

function parseClaimMinutes(value: unknown): number {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : DEFAULT_CLAIM_MINUTES;
}

/** Ayarları okur; eksik ya da bozuk her anahtar için varsayılan kullanılır. */
export async function getLeadFlowSettings(supabase: SupabaseClient): Promise<LeadFlowSettings> {
  const { data } = await supabase.from("app_settings").select("key, value").in("key", [...KEYS]);
  const map = new Map<string, unknown>(
    ((data ?? []) as { key: string; value: unknown }[]).map((r) => [r.key, r.value]),
  );
  const price = map.get("fiyat_cevabi");
  return {
    hours: parseBusinessHours(map.get("mesai")),
    districts: parseStringList(map.get("servis_semtleri"), DEFAULT_DISTRICTS),
    callScript: parseStringList(map.get("arama_metni"), DEFAULT_CALL_SCRIPT),
    priceAnswer: typeof price === "string" && price.trim() !== "" ? price : DEFAULT_PRICE_ANSWER,
    templates: parseTemplates(map.get("wa_sablonlari")),
    claimMinutes: parseClaimMinutes(map.get("ustlenme_dk")),
  };
}
