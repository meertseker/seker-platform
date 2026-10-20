import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabase } from "./supabase/server";
import { homeFor, type Role } from "./role-access";

export type { Role };

export interface SessionProfile {
  id: string;
  full_name: string;
  role: Role;
  can_edit_site: boolean;
}

/**
 * İstek başına bir kez çalışır (layout ve sayfa aynı sonucu paylaşır).
 * getClaims() JWT'yi imza anahtarıyla yerelde doğrular; her sayfada Auth
 * sunucusuna gidip gelmez. Pasif kullanıcıyı profiles.is_active yakalar.
 */
export const getSessionProfile = cache(async (): Promise<SessionProfile> => {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;

  if (!userId) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active, can_edit_site")
    .eq("id", userId)
    .single();

  if (!profile || !profile.is_active) {
    redirect("/login");
  }

  return profile as SessionProfile;
});

/** Sayfa yalnız belirli rollere açıksa: rol dışındaysa kendi ana ekranına yollar. */
export async function requireRole(...roles: Role[]): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!roles.includes(profile.role)) redirect(homeFor(profile.role));
  return profile;
}
