"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSessionProfile } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

export type NotificationType =
  | "teklif_onay_bekliyor"
  | "teklifiniz_onaylandi"
  | "teklif_revize_edildi"
  | "teklif_reddedildi";

export async function notify(
  supabase: SupabaseClient,
  userId: string,
  type: NotificationType,
  payload: Record<string, unknown>,
) {
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type,
    payload,
  });

  if (error) {
    throw new Error(`Bildirim yazılamadı: ${error.message}`);
  }
}

export async function markNotificationsRead() {
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", profile.id)
    .is("read_at", null);

  if (error) return { error: "Bildirimler okundu işaretlenemedi" };

  revalidatePath("/");
  return {};
}
