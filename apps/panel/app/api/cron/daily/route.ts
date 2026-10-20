import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  STALE_LEAD_STATUSES,
  dropLeadsWithFutureVisit,
  staleCutoffIso,
  istanbulDateString,
  isIstanbulMonday,
  overdueTotalKurus,
} from "@/lib/cron-rules";
import { formatTRY } from "@/lib/money";
import { loadFutureVisitLeadIds } from "@/lib/queries/stale-leads";
import { insertNotifications } from "@/lib/notifications/insert";

type StaleLead = {
  id: string;
  parent_name: string;
  assigned_to: string;
};

/** notifications tablosunda unique index olmadığından, tekrar göndermeden önce elle kontrol eder. */
async function notificationExists(
  db: SupabaseClient,
  userId: string,
  type: string,
  match: Record<string, string>,
): Promise<boolean> {
  let query = db.from("notifications").select("id").eq("user_id", userId).eq("type", type);
  for (const [key, value] of Object.entries(match)) {
    query = query.eq(`payload->>${key}`, value);
  }
  const { data } = await query.limit(1);
  return (data?.length ?? 0) > 0;
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
  const today = istanbulDateString();

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
  const now = new Date();
  const cutoff = staleCutoffIso(now, days);
  const [{ data: staleLeads }, futureVisitIds] = await Promise.all([
    db.from("leads")
      .select("id, parent_name, assigned_to")
      .in("status", STALE_LEAD_STATUSES)
      .lt("last_activity_at", cutoff).not("assigned_to", "is", null),
    loadFutureVisitLeadIds(db, now),
  ]);
  // İleri tarihli ziyareti olan veli takipsiz değildir (randevu durumu listede olduğu için).
  for (const l of dropLeadsWithFutureVisit((staleLeads ?? []) as StaleLead[], futureVisitIds)) {
    await createStaleLeadTask(l, today, days);
  }

  // Gürültü kontrolü: dünden kalan okunmamış "randevu_bugun" bildirimleri bayatlar; bugünün satırları oluşmadan önce okundu yapılır.
  // tarih YYYY-MM-DD olduğundan sözcük sırası tarih sırasıyla aynıdır. Hata loglanır, akışı durdurmaz.
  const { error: staleApptError } = await db.from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("type", "randevu_bugun").is("read_at", null).lt("payload->>tarih", today);
  if (staleApptError) console.error(`Bayat randevu bildirimleri temizlenemedi: ${staleApptError.message}`);

  // Kural 2 (spec §8.2): bugünkü randevu bildirimleri
  const dayStart = `${today}T00:00:00+03:00`, dayEnd = `${today}T23:59:59+03:00`;
  const { data: appts } = await db.from("appointments")
    .select("id, scheduled_at, lead_id, created_by, leads(parent_name)")
    .eq("outcome", "bekliyor").gte("scheduled_at", dayStart).lte("scheduled_at", dayEnd);
  const { data: yoneticiler } = await db.from("profiles").select("id").eq("role", "yonetici").eq("is_active", true);
  for (const a of appts ?? []) {
    // Supabase join'i nesne ya da dizi döndürebilir.
    const lead = Array.isArray(a.leads) ? a.leads[0] : a.leads;
    const parentName: string | null = lead?.parent_name ?? null;
    const targets = new Set([a.created_by, ...(yoneticiler ?? []).map((y) => y.id)]);
    for (const uid of targets) {
      // Cron her tetiklendiğinde aynı randevu için tekrar bildirim atmamak üzere randevu+gün+saat bazında kontrol edilir.
      if (await notificationExists(db, uid, "randevu_bugun", { appointmentId: a.id, tarih: today, at: a.scheduled_at })) continue;
      const { error } = await insertNotifications(db, [{
        user_id: uid, type: "randevu_bugun",
        payload: {
          appointmentId: a.id, leadId: a.lead_id, at: a.scheduled_at, tarih: today,
          ...(parentName ? { parentName } : {}),
        },
      }]);
      if (error) {
        console.error(`Bildirim yazılamadı: ${error.message}`);
        continue;
      }
      // Saat aynı gün değiştiyse eski saatli bildirim okundu olur; yalnız yenisi sayılır.
      const { error: oldTimeError } = await db.from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", uid).eq("type", "randevu_bugun").is("read_at", null)
        .eq("payload->>appointmentId", a.id).eq("payload->>tarih", today)
        .neq("payload->>at", a.scheduled_at);
      if (oldTimeError) console.error(`Eski saatli randevu bildirimi temizlenemedi: ${oldTimeError.message}`);
    }
  }

  /** Yeni özet eskisinin yerini alır: kullanıcının bugünden önceki okunmamış özetleri okundu olur (bugünküne dokunulmaz).
   *  Yalnızca o kullanıcının bugünkü özeti varken çağrılır; yazılamadıysa eskisi okunmamış kalır. */
  async function supersedeOldSummaries(userId: string) {
    const { error } = await db.from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId).eq("type", "geciken_ozet").is("read_at", null).lt("payload->>tarih", today);
    if (error) console.error(`Eski geciken özetler temizlenemedi: ${error.message}`);
  }

  // Kural 5 (spec §8.5): Pazartesi geciken özeti (yöneticilere)
  if (isIstanbulMonday()) {
    const { data: overdue } = await db.from("installments")
      .select("amount").eq("status", "bekliyor").lt("due_date", today);
    const totalKurus = overdueTotalKurus(overdue ?? []);
    if (totalKurus > 0) for (const y of yoneticiler ?? []) {
      // Aynı gün içinde tekrar tetiklenen cron, yöneticiye ikinci bir özet göndermesin.
      if (await notificationExists(db, y.id, "geciken_ozet", { tarih: today })) {
        await supersedeOldSummaries(y.id);
        continue;
      }
      const { error } = await insertNotifications(db, [{
        user_id: y.id, type: "geciken_ozet",
        payload: {
          count: overdue!.length,
          totalKurus,
          totalFormatted: formatTRY(totalKurus),
          tarih: today,
        },
      }]);
      if (error) {
        console.error(`Bildirim yazılamadı: ${error.message}`);
        continue;
      }
      await supersedeOldSummaries(y.id);
    }
  }
  return NextResponse.json({ ok: true, staleLeads: staleLeads?.length ?? 0, appts: appts?.length ?? 0 });
}
