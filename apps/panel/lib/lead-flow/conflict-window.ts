// Randevu çakışma penceresi (app_settings.cakisma_dakika, varsayılan 45 dk).
import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_CONFLICT_MINUTES = 45;

export async function readConflictWindowMinutes(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "cakisma_dakika")
    .maybeSingle();

  const minutes = Number(data?.value ?? DEFAULT_CONFLICT_MINUTES);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_CONFLICT_MINUTES;
}
