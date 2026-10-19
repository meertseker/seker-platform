// Veli üstlenme: tek koşullu UPDATE ... RETURNING. Eşzamanlı iki istekte satır
// kilidi ikinciyi bekletir, Postgres koşulu güncel satırda yeniden değerlendirir;
// yalnız biri satır döndürür.
import type { SupabaseClient } from "@supabase/supabase-js";

export type ClaimResult = { ok: true } | { ok: false; claimedBy: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNKNOWN_OWNER = "Başka bir danışman";

export async function claimLeadAs(
  supabase: SupabaseClient,
  leadId: string,
  userId: string,
  claimMinutes: number,
  now: Date = new Date(),
): Promise<ClaimResult> {
  // userId PostgREST `or` filtresine metin olarak girer; yalnız UUID kabul edilir.
  if (!UUID.test(userId)) throw new Error("Geçersiz kullanıcı kimliği");
  const cutoff = new Date(now.getTime() - claimMinutes * 60_000).toISOString();

  const { data, error } = await supabase
    .from("leads")
    .update({ assigned_to: userId, claimed_at: now.toISOString() })
    .eq("id", leadId)
    .is("first_contact_at", null)
    .or(`assigned_to.is.null,assigned_to.eq.${userId},claimed_at.lt."${cutoff}"`)
    .select("id");
  if (error) throw new Error(`Üstlenilemedi: ${error.message}`);
  if (data && data.length > 0) return { ok: true };

  // Kazanamadık: sahibi kim? (yalnızca okuma; karar yukarıdaki güncellemede verildi)
  const { data: lead } = await supabase
    .from("leads")
    .select("assigned_to")
    .eq("id", leadId)
    .maybeSingle();
  const owner = (lead as { assigned_to: string | null } | null)?.assigned_to ?? null;
  // İlk teması zaten bu kullanıcı yaptıysa veli onundur.
  if (owner === userId) return { ok: true };
  if (!owner) return { ok: false, claimedBy: UNKNOWN_OWNER };
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", owner).maybeSingle();
  return { ok: false, claimedBy: (profile as { full_name: string } | null)?.full_name || UNKNOWN_OWNER };
}
