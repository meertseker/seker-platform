import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@seker/auth/admin";
import { businessMinutesBetween, clockStart, nextBusinessMoment } from "@/lib/lead-flow/business-hours";
import { getLeadFlowSettings } from "@/lib/lead-flow/settings";
import { applyQueueFilter } from "@/lib/queries/call-queue";

export const dynamic = "force-dynamic";

/** Sayaç (yalnız mesai dakikaları) bu değeri geçince yöneticilere uyarı gider. */
const ALERT_AFTER_MINUTES = 15;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminSupabase();
  const now = new Date();
  const { hours } = await getLeadFlowSettings(db);

  // Mesai dışında hiçbir şey gönderilmez.
  if (nextBusinessMoment(now, hours).getTime() !== now.getTime()) {
    return NextResponse.json({ ok: true, skipped: "mesai_disi" });
  }

  const { data: leads, error } = await applyQueueFilter(db.from("leads").select("id, parent_name, created_at"))
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const due: { id: string; parentName: string; minutes: number }[] = [];
  for (const l of leads ?? []) {
    const minutes = businessMinutesBetween(clockStart(new Date(l.created_at), hours), now, hours);
    if (minutes > ALERT_AFTER_MINUTES) due.push({ id: l.id, parentName: l.parent_name, minutes });
  }
  if (due.length === 0) return NextResponse.json({ ok: true, notified: 0 });

  const { data: yoneticiler } = await db.from("profiles").select("id").eq("role", "yonetici").eq("is_active", true);
  if (!yoneticiler?.length) return NextResponse.json({ ok: true, notified: 0 });

  // Tek sorguda bu veliler için daha önce gönderilmiş uyarılar.
  const { data: sent, error: sentError } = await db
    .from("notifications")
    .select("payload")
    .eq("type", "veli_bekliyor")
    .in("payload->>leadId", due.map((l) => l.id));
  if (sentError) return NextResponse.json({ error: sentError.message }, { status: 500 });
  const alreadyNotified = new Set(
    ((sent ?? []) as { payload: { leadId?: string } | null }[]).map((n) => n.payload?.leadId),
  );

  let notified = 0;
  for (const lead of due) {
    if (alreadyNotified.has(lead.id)) continue;
    // Tek insert = tek ifade (atomik): kısmi başarı olmaz, hata olursa sonraki koşu yeniden dener.
    const { error: insertError } = await db.from("notifications").insert(
      yoneticiler.map((y) => ({
        user_id: y.id,
        type: "veli_bekliyor",
        payload: { leadId: lead.id, parentName: lead.parentName, minutes: lead.minutes },
      })),
    );
    if (insertError) {
      console.error(`Bildirim yazılamadı: ${insertError.message}`);
      continue;
    }
    notified++;
  }
  return NextResponse.json({ ok: true, notified });
}
