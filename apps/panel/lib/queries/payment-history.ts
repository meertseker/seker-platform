import type { SupabaseClient } from "@supabase/supabase-js";
import type { HistoryEventInput } from "@/lib/payment-history";

type ActorJoin = { full_name: string } | { full_name: string }[] | null;

/** Öğrencinin `odeme_alindi` olayları (geri alınmışlar dahil; süzme buildPaymentHistory'de). */
export async function fetchPaymentEvents(supabase: SupabaseClient, studentId: string): Promise<HistoryEventInput[]> {
  const { data } = await supabase
    .from("events")
    .select("id, created_at, payload, actor:profiles!events_actor_id_fkey(full_name)")
    .eq("entity_type", "student")
    .eq("entity_id", studentId)
    .eq("event_type", "odeme_alindi")
    .order("created_at", { ascending: false })
    .limit(1000);
  return ((data ?? []) as unknown as { id: string; created_at: string; payload: unknown; actor: ActorJoin }[]).map((row) => {
    const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor;
    return { id: row.id, createdAt: row.created_at, actorName: actor?.full_name ?? null, payload: row.payload };
  });
}
