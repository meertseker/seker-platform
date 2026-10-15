import { redirect } from "next/navigation";
import { createServerSupabase } from "./supabase/server";

export interface SessionProfile {
  id: string;
  full_name: string;
  role: "yonetici" | "danisman";
  can_edit_site: boolean;
}

export async function getSessionProfile(): Promise<SessionProfile> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active, can_edit_site")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active) {
    redirect("/login");
  }

  return profile as SessionProfile;
}
