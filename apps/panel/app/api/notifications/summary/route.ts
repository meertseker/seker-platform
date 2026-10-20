import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { countUnread } from "@/lib/queries/notifications";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** Zil, yeni bildirim var mı diye periyodik sorar: okunmamış sayısı + en yeni bildirim kimliği. */
export async function GET() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const [unread, latest] = await Promise.all([
    countUnread(supabase, user.id),
    supabase
      .from("notifications")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  return NextResponse.json(
    { unread, latestId: (latest.data?.[0]?.id as string | undefined) ?? null },
    { headers: NO_STORE },
  );
}
