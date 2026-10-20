// Takipsizlik listesi için ortak süzgeç: ileri tarihli ziyareti olan veli takipsiz değildir.
import type { SupabaseClient } from "@supabase/supabase-js";
import { futureVisitLeadIds } from "@/lib/cron-rules";

/** Bekleyen ve ileri tarihli randevusu olan velilerin kimlikleri (Bugün ve günlük cron aynı kuralı kullanır). */
export async function loadFutureVisitLeadIds(db: SupabaseClient, now: Date): Promise<Set<string>> {
  const { data, error } = await db
    .from("appointments")
    .select("lead_id, scheduled_at")
    .eq("outcome", "bekliyor")
    .gt("scheduled_at", now.toISOString());
  if (error) throw new Error(`Randevular okunamadı: ${error.message}`);
  return futureVisitLeadIds((data ?? []) as { lead_id: string | null; scheduled_at: string }[], now);
}
