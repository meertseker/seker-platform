import { createServerSupabase } from './server';

export type Editor = { id: string; fullName: string };

/** getUser() JWT'yi Auth sunucusunda doğrular; getSession()'a güvenilmez. */
export async function getEditor(): Promise<Editor | null> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, is_active, can_edit_site')
    .eq('id', user.id)
    .single();
  if (!data || !data.is_active || !data.can_edit_site) return null;
  return { id: data.id, fullName: data.full_name };
}
