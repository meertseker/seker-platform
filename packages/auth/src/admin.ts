import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@seker/db';
import { requireEnv } from '@seker/shared/env';

/** RLS'i aşan sunucu istemcisi. Yalnızca sunucu kodunda, kullanıcı girdisini doğruladıktan sonra. */
export function createAdminSupabase(): SupabaseClient<Database> {
  return createClient<Database>(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SECRET_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
