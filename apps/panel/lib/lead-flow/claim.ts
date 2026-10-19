// Veli üstlenme: tek koşullu UPDATE ... RETURNING. Ortak listede "Ara"ya ilk basan alır.
// R24: üstlenme yalnız İLK teması yönetir. İlk temas yapılmışsa herkes arayabilir (takibi meslektaş
// da yapabilir); bu durumda hiçbir şey yazılmaz, veli sahibinde kalır.
// Eşzamanlı iki istekte satır kilidi ikinciyi bekletir, Postgres koşulu güncel satırda yeniden değerlendirir;
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
    // Henüz kimse "Ara"ya basmadıysa (claimed_at boş) otomatik atanmış veli de alınabilir.
    .or(`claimed_at.is.null,assigned_to.eq.${userId},claimed_at.lt."${cutoff}"`)
    .select("id");
  if (error) throw new Error(`Üstlenilemedi: ${error.message}`);
  if (data && data.length > 0) return { ok: true };

  // Kazanamadık: ilk temas mı yapılmış, yoksa başkası mı arıyor? (yalnızca okuma)
  const { data: lead } = await supabase
    .from("leads")
    .select("assigned_to, first_contact_at")
    .eq("id", leadId)
    .maybeSingle();
  const row = lead as { assigned_to: string | null; first_contact_at: string | null } | null;
  if (row?.first_contact_at) return { ok: true };
  const owner = row?.assigned_to ?? null;
  if (owner === userId) return { ok: true };
  if (!owner) return { ok: false, claimedBy: UNKNOWN_OWNER };
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", owner).maybeSingle();
  return { ok: false, claimedBy: (profile as { full_name: string } | null)?.full_name || UNKNOWN_OWNER };
}
