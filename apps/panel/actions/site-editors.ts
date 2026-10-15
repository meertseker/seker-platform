"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

export async function setCanEditSite(userId: string, value: boolean): Promise<{ ok: boolean; error?: string }> {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") return { ok: false, error: "Bu ayarı yalnızca yönetici değiştirebilir." };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("set_can_edit_site", { p_user: userId, p_value: value });
  if (error) return { ok: false, error: "Kaydedilemedi, tekrar deneyin." };
  revalidatePath("/ayarlar");
  return { ok: true };
}
