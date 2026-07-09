import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type StaleLead = {
  id: string;
  parent_name: string;
  assigned_to: string;
};

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" }); // YYYY-MM-DD

  async function createStaleLeadTask(lead: StaleLead, dueDate: string, days: number) {
    const ruleKey = `takipsiz:${lead.id}`;
    const { data: existing } = await db
      .from("tasks")
      .select("id")
      .eq("rule_key", ruleKey)
      .eq("status", "acik")
      .maybeSingle();

    if (existing) return;

    const { error } = await db.from("tasks").insert({
      lead_id: lead.id,
      assigned_to: lead.assigned_to,
      due_date: dueDate,
      title: `Takip et: ${lead.parent_name} (${days}+ gündür işlem yok)`,
      auto_generated: true,
      rule_key: ruleKey,
    });

    if (error && error.code !== "23505") {
      throw error;
    }
  }

  // Kural 1 (spec §8.1): takipsiz lead görevleri
  const { data: settings } = await db.from("app_settings").select("value").eq("key", "takipsizlik_gun").single();
  const days = Number(settings?.value ?? 3);
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const { data: staleLeads } = await db.from("leads")
    .select("id, parent_name, assigned_to")
    .in("status", ["yeni", "ulasildi", "gorusme_yapildi", "teklif"])
    .lt("last_activity_at", cutoff).not("assigned_to", "is", null);
  for (const l of (staleLeads ?? []) as StaleLead[]) {
    await createStaleLeadTask(l, today, days);
  }

  // Kural 2 (spec §8.2): bugünkü randevu bildirimleri
  const dayStart = `${today}T00:00:00+03:00`, dayEnd = `${today}T23:59:59+03:00`;
  const { data: appts } = await db.from("appointments")
    .select("id, scheduled_at, lead_id, created_by, leads(parent_name)")
    .eq("outcome", "bekliyor").gte("scheduled_at", dayStart).lte("scheduled_at", dayEnd);
  const { data: yoneticiler } = await db.from("profiles").select("id").eq("role", "yonetici").eq("is_active", true);
  for (const a of appts ?? []) {
    const targets = new Set([a.created_by, ...(yoneticiler ?? []).map((y) => y.id)]);
    for (const uid of targets) {
      await db.from("notifications").insert({
        user_id: uid, type: "randevu_bugun",
        payload: { appointmentId: a.id, leadId: a.lead_id, at: a.scheduled_at },
      });
    }
  }

  // Kural 5 (spec §8.5): Pazartesi geciken özeti (yöneticilere)
  const isMonday = new Date().toLocaleDateString("en-US", { timeZone: "Europe/Istanbul", weekday: "short" }) === "Mon";
  if (isMonday) {
    const { data: overdue } = await db.from("installments")
      .select("amount").eq("status", "bekliyor").lt("due_date", today);
    const total = (overdue ?? []).reduce((s, i) => s + Number(i.amount), 0);
    if (total > 0) for (const y of yoneticiler ?? []) {
      await db.from("notifications").insert({
        user_id: y.id, type: "geciken_ozet",
        payload: { count: overdue!.length, totalTl: total },
      });
    }
  }
  return NextResponse.json({ ok: true, staleLeads: staleLeads?.length ?? 0, appts: appts?.length ?? 0 });
}
