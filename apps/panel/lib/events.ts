import type { SupabaseClient } from "@supabase/supabase-js";

export async function logEvent(supabase: SupabaseClient, e: {
  entityType: "lead" | "offer" | "student" | "installment" | "appointment" | "price_list";
  entityId: string; eventType: string; actorId: string; payload?: object;
}): Promise<void> {
  const { error } = await supabase.from("events").insert({
    entity_type: e.entityType, entity_id: e.entityId,
    event_type: e.eventType, actor_id: e.actorId, payload: e.payload ?? {},
  });
  // Mutasyon zaten commit edildi; kayıp bir audit satırı 500'e ve tekrar
  // denemeye yol açmamalı, yalnızca loglanır.
  if (error) console.error(`Event yazılamadı: ${error.message}`);
  else kickWaFlush();
}

/** Yazılan olay WhatsApp kuyruğuna düştüyse kısa süre sonra gruba gönderilsin.
 *  WAHA yapılandırılmamışsa (yerel, test) hiçbir şey yüklenmez. */
export function kickWaFlush(): void {
  if (!process.env.WAHA_URL) return;
  void import("@/lib/wa/run").then((m) => m.scheduleWaFlush()).catch(() => {});
}
