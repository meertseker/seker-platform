import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@seker/db';
import { authCookieOptions } from './cookie';

/** İstek başına yeni istemci; kullanıcının oturumuyla (RLS uygulanır) çalışır. */
export async function createServerSupabase(): Promise<SupabaseClient<Database>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error('Eksik ortam değişkeni: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }
  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookieOptions: authCookieOptions(),
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component içinden çağrıldıysa çerezi middleware yeniler.
        }
      },
    },
  });
}
