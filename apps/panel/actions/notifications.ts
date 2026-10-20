"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSessionProfile } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { insertNotifications } from "@/lib/notifications/insert";
import { isUuid, type NotificationType } from "@/lib/notifications/types";

export type { NotificationType } from "@/lib/notifications/types";

export async function notify(
  supabase: SupabaseClient,
  userId: string,
  type: NotificationType,
  payload: Record<string, unknown>,
) {
  const { error } = await insertNotifications(supabase, [
    { user_id: userId, type, payload },
  ]);

  // Mutasyon zaten commit edildi; kayıp bir bildirim 500'e ve tekrar
  // denemeye yol açmamalı, yalnızca loglanır.
  if (error) {
    console.error(`Bildirim yazılamadı: ${error.message}`);
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

export async function markNotificationRead(id: string) {
  if (!isUuid(id)) {
    return { error: "Bildirim okundu işaretlenemedi" };
  }

  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", profile.id)
    .is("read_at", null);

  if (error) return { error: "Bildirim okundu işaretlenemedi" };

  revalidatePath("/");
  return {};
}
