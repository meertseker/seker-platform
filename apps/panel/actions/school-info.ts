"use server";

// Ayarlar → Okul bilgileri: yönetici okulun tanıtım yazılarını, artılarını ve broşür metinlerini girer.
// AI konu önerileri bu metni temel alır. Yazma oturum istemcisiyle (write_app_settings: yalnız yönetici).
import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { SCHOOL_INFO_MAX } from "@/lib/ai/gorev-girdi";
import { SCHOOL_INFO_KEY } from "@/lib/ai/gorev-veri";
import { createServerSupabase } from "@/lib/supabase/server";

export async function saveSchoolInfo(text: string): Promise<{ ok: true } | { error: string }> {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") return { error: "Okul bilgilerini yalnızca yönetici değiştirebilir." };
  const metin = (typeof text === "string" ? text : "").trim();
  if (metin.length > SCHOOL_INFO_MAX) return { error: "Okul bilgileri en fazla 20.000 karakter olabilir." };

  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.from("app_settings").upsert({ key: SCHOOL_INFO_KEY, value: { metin } }, { onConflict: "key" });
    if (error) return { error: "Kaydedilemedi, tekrar deneyin." };
  } catch {
    return { error: "Kaydedilemedi, tekrar deneyin." };
  }
  revalidatePath("/ayarlar");
  return { ok: true };
}
