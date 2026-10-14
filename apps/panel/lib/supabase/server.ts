import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase as createTypedServerSupabase } from "@seker/auth/server";

/**
 * Panelin mevcut 128 sorgusu henüz Database tipine göre yazılmadı; tipsiz
 * istemci döndürmek davranışı değiştirmez. Yeni kod @seker/auth/server'ı
 * doğrudan (tipli) kullanır.
 */
export async function createServerSupabase(): Promise<SupabaseClient> {
  return (await createTypedServerSupabase()) as unknown as SupabaseClient;
}
