// Bu hafta ekranının verisi: haftada gelen reklam velileri (K6), randevuları, kişilerin açık görevleri ve adları.
// Oturum (RLS) istemcisiyle okunur; satırlar sayfa sayfa, `.in()` listeleri 100'lük parçalarla.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadStatus } from "@/lib/constants";
import { fetchAllPages } from "@/lib/content/board";
import { isAdSourced, weekRange, type WeeklyAppt, type WeeklyLead } from "@/lib/ads/weekly";

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

function chunks<T>(list: T[], size = IN_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export type WeeklyData = {
  leads: WeeklyLead[];
  appts: WeeklyAppt[];
  openTasksByUser: Map<string, number>;
  names: Map<string, string>;
};

/**
 * `weekStart` (Pazartesi) haftasında gelen reklam velileri ve bu velilerin tüm randevuları.
 * `hasAppointment`: iptal dışı randevusu var. Açık görevler kişinin tüm açık görevleridir.
 */
export async function loadWeeklyData(supabase: SupabaseClient, weekStart: string): Promise<WeeklyData> {
  const { from, to } = weekRange(weekStart);

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

  const userIds = [...new Set(leads.map((l) => l.assignedTo).filter((id): id is string => !!id))];
  const openTasksByUser = new Map<string, number>();
  const names = new Map<string, string>();

  await Promise.all(
    chunks(userIds).map(async (part) => {
      const [tasks, profiles] = await Promise.all([
        fetchAllPages<{ assigned_to: string }>((f, t) =>
          supabase.from("tasks").select("assigned_to").eq("status", "acik").in("assigned_to", part).order("id").range(f, t),
        ),
        fetchAllPages<{ id: string; full_name: string | null }>((f, t) =>
          supabase.from("profiles").select("id, full_name").in("id", part).order("id").range(f, t),
        ),
      ]);
      for (const t of tasks) openTasksByUser.set(t.assigned_to, (openTasksByUser.get(t.assigned_to) ?? 0) + 1);
      for (const p of profiles) if (p.full_name) names.set(p.id, p.full_name);
    }),
  );

  return { leads, appts, openTasksByUser, names };
}
