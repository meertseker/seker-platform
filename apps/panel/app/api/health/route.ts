import { NextResponse } from "next/server";
import { createAdminSupabase } from "@seker/auth/admin";

export const dynamic = "force-dynamic";

/** Uptime izleme her 5 dakikada çağırır: hem DB'yi kontrol eder hem Supabase Free'yi aktif tutar. */
export async function GET() {
  const { error } = await createAdminSupabase().from("app_settings").select("key").limit(1);
  if (error) return NextResponse.json({ ok: false }, { status: 503 });
  return NextResponse.json({ ok: true });
}
