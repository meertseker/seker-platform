import type { SupabaseClient } from "@supabase/supabase-js";
import { buildPaymentTraces, PAYMENT_EVENT_TYPES, type PaymentEventRow } from "@/lib/payment-events";

/** Ödeme notları ve hatırlatma izleri; `studentIds` verilirse yalnız o öğrenciler. */
export async function fetchPaymentTraces(supabase: SupabaseClient, studentIds?: string[]) {
  let query = supabase
    .from("events")
    .select("entity_id, event_type, created_at, payload, actor:profiles!events_actor_id_fkey(full_name)")
    .eq("entity_type", "student")
    .in("event_type", [...PAYMENT_EVENT_TYPES])
    .order("created_at", { ascending: false })
    .limit(5000);
  if (studentIds) query = query.in("entity_id", studentIds);
  const { data } = await query;
  return buildPaymentTraces((data ?? []) as unknown as PaymentEventRow[]);
}
