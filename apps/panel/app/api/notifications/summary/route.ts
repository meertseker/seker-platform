import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Zil, yeni bildirim var mı diye periyodik sorar: okunmamış sayısı + en yeni bildirim kimliği.
 * Geçici DB hatası "0 okunmamış" gibi görünmesin diye 500 döner (layout'taki countUnread gibi yumuşatmaz).
 */
export async function GET() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const [unreadResult, latestResult] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null),
    supabase
      .from("notifications")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1),
  ]);

  const failure = unreadResult.error ?? latestResult.error;
  if (failure) {
    console.error("Bildirim özeti okunamadı:", failure.message);
    return NextResponse.json({ error: "unavailable" }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json(
    {
      unread: unreadResult.count ?? 0,
      latestId: (latestResult.data?.[0]?.id as string | undefined) ?? null,
    },
    { headers: NO_STORE },
  );
}
