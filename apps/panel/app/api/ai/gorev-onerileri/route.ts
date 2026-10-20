import { NextResponse } from "next/server";
import { createAdminSupabase } from "@seker/auth/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aiEnabled, generateWeekSuggestions } from "@/lib/ai/gorev-uret";
import { allowedTaskWeeks, isWeeklySlot, SLOT_ORDER, slotOfCode, SLOTS } from "@/lib/content/slots";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * Görev ver ekranının AI konu önerileri: eksik yuvalar için üretir, hazır olanları döner.
 * Server Action yerine route handler: üretim sürerken aynı istemcinin "Gönder" eylemleri sırada beklemesin.
 * Yalnız etkin yönetici ve danışman; yazma service_role ile (ai_gorev_onerileri).
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return json({ error: "unauthorized" }, 401);
  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", userId).maybeSingle();
  if (!profile?.is_active || (profile.role !== "yonetici" && profile.role !== "danisman")) {
    return json({ error: "forbidden" }, 403);
  }

  let body: { weekStart?: unknown; slot?: unknown; force?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const now = new Date();
  const weekStart = typeof body.weekStart === "string" ? body.weekStart : "";
  if (!allowedTaskWeeks(now).includes(weekStart)) return json({ error: "bad_week" }, 400);
  if (body.slot !== undefined && !isWeeklySlot(body.slot)) return json({ error: "bad_slot" }, 400);

  if (!aiEnabled()) return json({ enabled: false });

  const admin = createAdminSupabase() as unknown as SupabaseClient;
  // Görevi açılmış yuva için öneri üretilmez.
  const { data: tasks } = await admin.from("content_items").select("code, kind").eq("week_start", weekStart);
  const taken = new Set(
    ((tasks ?? []) as { code: string; kind: string }[])
      .map((t) => {
        const slot = slotOfCode(t.code);
        return slot && SLOTS[slot].kind === t.kind ? slot : null;
      })
      .filter((s) => s !== null),
  );
  const requested = isWeeklySlot(body.slot) ? [body.slot] : SLOT_ORDER;
  const slots = requested.filter((s) => !taken.has(s));

  const state = await generateWeekSuggestions(admin, { weekStart, slots, now, force: body.force === true });
  return json(state);
}
