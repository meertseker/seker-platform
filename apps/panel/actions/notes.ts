"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { kickWaFlush } from "@/lib/events";
import { createServerSupabase } from "@/lib/supabase/server";

export async function addNote(leadId: string, body: string) {
  const text = body.trim();
  if (!text) return { error: "Not boş olamaz" };

  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();
  const { error: noteError } = await supabase.from("lead_notes").insert({
    lead_id: leadId,
    author_id: profile.id,
    body: text,
  });
  if (noteError) return { error: "Not eklenemedi" };

  const { error: leadError } = await supabase.from("leads").update({
    last_activity_at: new Date().toISOString(),
  }).eq("id", leadId);
  if (leadError) return { error: "Veli güncellenemedi" };

  kickWaFlush();
  revalidatePath(`/leads/${leadId}`);
  return {};
}
