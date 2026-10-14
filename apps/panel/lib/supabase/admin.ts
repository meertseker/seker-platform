import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminSupabase as createTypedAdminSupabase } from "@seker/auth/admin";

export function createAdminSupabase(): SupabaseClient | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return null;
  return createTypedAdminSupabase() as unknown as SupabaseClient;
}
