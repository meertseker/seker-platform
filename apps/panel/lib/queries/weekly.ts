// Bu hafta ekranının verisi: toplantı haftasında ve bir önceki haftada gelen reklam velileri (K6), randevuları,
// kişilerin açık görevleri ve adları. Oturum (RLS) istemcisiyle okunur; satırlar sayfa sayfa, `.in()` listeleri 100'lük parçalarla.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadStatus } from "@/lib/constants";
import { fetchAllPages } from "@/lib/content/board";
import { addDaysToDateString } from "@/lib/lead-flow/business-hours";
import { isAdSourced, weekRange, type WeeklyAppt, type WeeklyLead, type WeeklyTask } from "@/lib/ads/weekly";

const IN_CHUNK = 100;

/** K6 süzgeci PostgREST `or` biçiminde. */
const AD_SOURCED_FILTER = "ad_platform.in.(google,meta),source.eq.reklam,channel.in.(ig_dm,ig_yorum)";

type LeadRow = {
  id: string;
  created_at: string;
  first_contact_at: string | null;
  status: LeadStatus;
  lost_reason: string | null;
  is_qualified: boolean | null;
  q_reached: boolean | null;
  source: string;
  channel: string | null;
  ad_platform: "google" | "meta" | null;
  content_code: string | null;
  assigned_to: string | null;
  appointments: { scheduled_at: string; outcome: string | null }[] | null;
};

type ApptRow = {
  lead_id: string;
  scheduled_at: string;
  outcome: string | null;
  lead: { assigned_to: string | null; source: string; channel: string | null; ad_platform: "google" | "meta" | null } | null;
};

function chunks<T>(list: T[], size = IN_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export type WeeklyData = {
  weekStart: string;
  /** Toplantı haftasında gelen reklam velileri (huni, ilk arama, randevu). */
  leads: WeeklyLead[];
  /** `leads`'in tüm randevuları (huni "Ziyarete gelen"). */
  appts: WeeklyAppt[];
  /** Bir önceki haftada gelen reklam velileri (ulaşma; hepsi 7 günü doldurmuş). */
  reachLeads: WeeklyLead[];
  /** Takvim haftasına düşen, herhangi bir reklam velisinin randevuları (ziyarete gelme). */
  weekAppts: WeeklyAppt[];
  /** Kişi başına açık görev sayısı. */
  openTasksByUser: Map<string, number>;
  /** Açık görevler, süre bilgisiyle (karnede geciken görev). */
  openTasks: WeeklyTask[];
  names: Map<string, string>;
};

async function loadAdLeads(
  supabase: SupabaseClient,
  from: string,
  to: string,
): Promise<{ leads: WeeklyLead[]; appts: WeeklyAppt[] }> {
  const rows = await fetchAllPages<LeadRow>((f, t) =>
    supabase
      .from("leads")
      .select(
        "id, created_at, first_contact_at, status, lost_reason, is_qualified, q_reached, source, channel, ad_platform, content_code, assigned_to, appointments(scheduled_at, outcome)",
      )
      .gte("created_at", from)
      .lt("created_at", to)
      .or(AD_SOURCED_FILTER)
      .order("created_at")
      .order("id")
      .range(f, t),
  );

  const leads: WeeklyLead[] = [];
  const appts: WeeklyAppt[] = [];
  for (const r of rows) {
    const lead: WeeklyLead = {
      id: r.id,
      createdAt: r.created_at,
      firstContactAt: r.first_contact_at,
      status: r.status,
      lostReason: r.lost_reason,
      isQualified: r.is_qualified === true,
      qReached: r.q_reached,
      source: r.source,
      channel: r.channel,
      adPlatform: r.ad_platform,
      contentCode: r.content_code,
      assignedTo: r.assigned_to,
      hasAppointment: (r.appointments ?? []).some((a) => a.outcome !== "iptal"),
    };
    if (!isAdSourced(lead)) continue;
    leads.push(lead);
    for (const a of r.appointments ?? []) {
      appts.push({ leadId: r.id, scheduledAt: a.scheduled_at, outcome: a.outcome, assignedTo: r.assigned_to });
    }
  }
  return { leads, appts };
}

/** Takvim haftasına düşen randevular; velisi K6 süzgecinden geçenler (`leads!inner`). */
async function loadWeekAppts(supabase: SupabaseClient, from: string, to: string): Promise<WeeklyAppt[]> {
  const rows = await fetchAllPages<ApptRow>((f, t) =>
    supabase
      .from("appointments")
      .select("lead_id, scheduled_at, outcome, lead:leads!inner(assigned_to, source, channel, ad_platform)")
      .gte("scheduled_at", from)
      .lt("scheduled_at", to)
      .or(AD_SOURCED_FILTER, { referencedTable: "lead" })
      .order("scheduled_at")
      .order("id")
      .range(f, t),
  );
  return rows
    .filter((r) => r.lead && isAdSourced({ adPlatform: r.lead.ad_platform, source: r.lead.source, channel: r.lead.channel }))
    .map((r) => ({ leadId: r.lead_id, scheduledAt: r.scheduled_at, outcome: r.outcome, assignedTo: r.lead?.assigned_to ?? null }));
}

/**
 * `weekStart` (Pazartesi) toplantı haftasının verisi. `hasAppointment`: iptal dışı randevusu var.
 * Açık görevler kişinin tüm açık görevleridir (yalnız reklam velileri değil).
 */
export async function loadWeeklyData(supabase: SupabaseClient, weekStart: string): Promise<WeeklyData> {
  const week = weekRange(weekStart);
  const prev = weekRange(addDaysToDateString(weekStart, -7));

  const [current, previous, weekAppts] = await Promise.all([
    loadAdLeads(supabase, week.from, week.to),
    loadAdLeads(supabase, prev.from, prev.to),
    loadWeekAppts(supabase, week.from, week.to),
  ]);

  const userIds = [
    ...new Set([...current.leads, ...previous.leads].map((l) => l.assignedTo).filter((id): id is string => !!id)),
  ];
  const openTasksByUser = new Map<string, number>();
  const openTasks: WeeklyTask[] = [];
  const names = new Map<string, string>();

  await Promise.all(
    chunks(userIds).map(async (part) => {
      const [tasks, profiles] = await Promise.all([
        fetchAllPages<{ assigned_to: string; due_date: string; due_at: string | null }>((f, t) =>
          supabase
            .from("tasks")
            .select("assigned_to, due_date, due_at")
            .eq("status", "acik")
            .in("assigned_to", part)
            .order("id")
            .range(f, t),
        ),
        fetchAllPages<{ id: string; full_name: string | null }>((f, t) =>
          supabase.from("profiles").select("id, full_name").in("id", part).order("id").range(f, t),
        ),
      ]);
      for (const t of tasks) {
        openTasksByUser.set(t.assigned_to, (openTasksByUser.get(t.assigned_to) ?? 0) + 1);
        openTasks.push({ assignedTo: t.assigned_to, dueDate: t.due_date, dueAt: t.due_at });
      }
      for (const p of profiles) if (p.full_name) names.set(p.id, p.full_name);
    }),
  );

  return {
    weekStart,
    leads: current.leads,
    appts: current.appts,
    reachLeads: previous.leads,
    weekAppts,
    openTasksByUser,
    openTasks,
    names,
  };
}
