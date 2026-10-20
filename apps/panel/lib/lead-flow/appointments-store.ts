// Randevu yazımları (durum akışından çağrılır).
import type { SupabaseClient } from "@supabase/supabase-js";
import { logEvent } from "@/lib/events";

/**
 * H8: velinin bekleyen randevularını iptal eder; her biri için randevu_sonuclandi olayı yazılır (zaman
 * çizelgesi ve WhatsApp grubu aynı yoldan öğrenir). Dönüş: iptal edilen randevu kimlikleri.
 */
export async function cancelPendingAppointments(
  supabase: SupabaseClient,
  leadId: string,
  actorId: string,
  note: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("id")
    .eq("lead_id", leadId)
    .eq("outcome", "bekliyor");
  if (error) throw new Error(`Randevular okunamadı: ${error.message}`);
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  if (ids.length === 0) return [];

  const { error: updateError } = await supabase
    .from("appointments")
    .update({ outcome: "iptal", outcome_note: note })
    .eq("lead_id", leadId)
    .eq("outcome", "bekliyor");
  if (updateError) throw new Error(`Randevular iptal edilemedi: ${updateError.message}`);

  for (const id of ids) {
    await logEvent(supabase, {
      entityType: "appointment",
      entityId: id,
      eventType: "randevu_sonuclandi",
      actorId,
      payload: { outcome: "iptal", reason: "kaybedildi" },
    });
  }
  return ids;
}
