import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@seker/db';
import { requireEnv } from '@seker/shared/env';

/**
 * Çerezsiz istemci: "use cache" içinde kullanılabilir. 3 sn'de vazgeçer.
 * Değerler requireEnv ile (dinamik erişim) okunur: NEXT_PUBLIC_* derlemede koda gömülmez.
 */
export function createPublicSupabase() {
  return createClient<Database>(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(3000) }) },
    },
  );
}
