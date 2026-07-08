import type { SupabaseClient } from "@supabase/supabase-js";

export async function logEvent(supabase: SupabaseClient, e: {
  entityType: "lead" | "offer" | "student" | "installment" | "appointment" | "price_list";
  entityId: string; eventType: string; actorId: string; payload?: object;
}): Promise<void> {
  const { error } = await supabase.from("events").insert({
    entity_type: e.entityType, entity_id: e.entityId,
    event_type: e.eventType, actor_id: e.actorId, payload: e.payload ?? {},
  });
  if (error) throw new Error(`Event yazılamadı: ${error.message}`);
}
