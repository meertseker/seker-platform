"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type { BusinessHours } from "@/lib/lead-flow/business-hours";
import { DEFAULT_TEMPLATES, hhmmToMinutes, type WaTemplate } from "@/lib/lead-flow/settings";

export type LeadLineInput = {
  hours: BusinessHours;
  districts: string[];
  callScript: string[];
  priceAnswer: string;
  templates: WaTemplate[];
};

const REQUIRED_KEYS = DEFAULT_TEMPLATES.map((t) => t.key);

/** Girdiyi doğrular; hata varsa Türkçe mesaj, yoksa temizlenmiş değerleri döner. */
function validate(input: LeadLineInput): { error: string } | { value: LeadLineInput } {
  if (!input || typeof input !== "object") return { error: "Geçersiz istek." };
  const { hours } = input;
  const start = hhmmToMinutes(hours?.start);
  const end = hhmmToMinutes(hours?.end);
  if (start === null || end === null) return { error: "Mesai saatleri 00:00–23:59 arasında geçerli bir saat olmalı." };
  if (start >= end) return { error: "Mesai başlangıç saati bitişten önce olmalı." };
  if (!Array.isArray(hours.days) || hours.days.length === 0 || !hours.days.every((d) => Number.isInteger(d) && d >= 1 && d <= 7)) {
    return { error: "En az bir mesai günü seçin." };
  }
  const days = [...new Set(hours.days)].sort((a, b) => a - b);

  const districts = [...new Set((Array.isArray(input.districts) ? input.districts : []).map((d) => String(d).trim()).filter(Boolean))];
  if (districts.length === 0) return { error: "En az bir servis semti girin." };
  if (districts.length > 30) return { error: "En fazla 30 servis semti girilebilir." };

  const script = (Array.isArray(input.callScript) ? input.callScript : []).map((l) => String(l).trim()).filter(Boolean);
  if (script.length < 1 || script.length > 10) return { error: "Konuşma sırası 1–10 satır olmalı." };
  if (script.some((l) => l.length > 300)) return { error: "Konuşma sırasındaki her satır en fazla 300 karakter olabilir." };

  const price = typeof input.priceAnswer === "string" ? input.priceAnswer.trim() : "";
  if (!price) return { error: "Fiyat cevabı boş olamaz." };
  if (price.length > 500) return { error: "Fiyat cevabı en fazla 500 karakter olabilir." };

  const given = new Map((Array.isArray(input.templates) ? input.templates : []).map((t) => [t?.key, t]));
  const templates: WaTemplate[] = [];
  for (const key of REQUIRED_KEYS) {
    const t = given.get(key);
    if (!t) return { error: "WhatsApp şablonlarından biri eksik." };
    const label = String(t.label ?? "").trim();
    const text = String(t.text ?? "").trim();
    if (!label) return { error: "Şablon adı boş olamaz." };
    if (!text) return { error: `"${label}" şablonunun metni boş olamaz.` };
    if (text.length > 1000) return { error: `"${label}" şablonu en fazla 1000 karakter olabilir.` };
    templates.push({ key, label, text });
  }

  return {
    value: {
      hours: { days, start: hours.start, end: hours.end },
      districts,
      callScript: script,
      priceAnswer: price,
      templates,
    },
  };
}

export async function saveLeadLineSettings(input: LeadLineInput): Promise<{ ok: true } | { error: string }> {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") return { error: "Bu ayarı yalnızca yönetici değiştirebilir." };

  const checked = validate(input);
  if ("error" in checked) return checked;
  const v = checked.value;

  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.from("app_settings").upsert(
      [
        { key: "mesai", value: v.hours },
        { key: "servis_semtleri", value: v.districts },
        { key: "arama_metni", value: v.callScript },
        { key: "fiyat_cevabi", value: v.priceAnswer },
        { key: "wa_sablonlari", value: v.templates },
      ],
      { onConflict: "key" },
    );
    if (error) return { error: "Kaydedilemedi, tekrar deneyin." };
  } catch {
    return { error: "Kaydedilemedi, tekrar deneyin." };
  }
  revalidatePath("/ayarlar");
  revalidatePath("/bugun");
  revalidatePath("/leads/[id]", "page");
  revalidatePath("/leads/[id]/ara", "page");
  return { ok: true };
}
