// Rapor verisini oturum (RLS) istemcisiyle okur. Bütün sorgular paralel; satırlar sayfa sayfa (PostgREST max_rows),
// `.in()` listeleri 100'lük parçalarla. Yönetici olmayanda para, reklam, site, içerik ve otomasyon tabloları hiç sorgulanmaz.
import type { SupabaseClient } from "@supabase/supabase-js";
import { readAdsConfig } from "@/lib/ads/config";
import { readMetaConfig } from "@/lib/ads/meta/config";
import { chunk, fetchAllPages, IN_CHUNK } from "@/lib/content/board";
import { getLeadFlowSettings } from "@/lib/lead-flow/settings";
import type { Role } from "@/lib/role-access";
import {
  buildReport,
  type ManagerInput,
  type RawAppt,
  type RawCapacity,
  type RawContent,
  type RawEvent,
  type RawInstallment,
  type RawLead,
  type RawOffer,
  type RawOverdue,
  type RawProfile,
  type RawRefund,
  type RawSpend,
  type RawStudent,
  type RawTask,
  type RawUpload,
  type RawVisit,
  type RawWa,
  type Report,
} from "./build";
import { isoBounds, lastMonths, type Period } from "./period";

const LEAD_COLUMNS =
  "id, created_at, first_contact_at, last_activity_at, status, lost_reason, source, channel, ad_platform, gclid, utm_campaign, utm_term, landing_path, assigned_to, is_qualified, q_reached, converted_student_id";

/** Raporun okuduğu en eski gün: önceki dönemin başı ya da 12 aylık grafiğin ilk ayı. */
export function earliestDay(period: Period): string {
  const trendStart = `${lastMonths(period.to, 12)[0]}-01`;
  return [period.prev.from, period.from, trendStart].sort()[0];
}

type Q = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;

function all<T>(page: (from: number, to: number) => Q): Promise<T[]> {
  return fetchAllPages<T>(page);
}

async function loadManager(db: SupabaseClient, sinceDay: string, period: Period): Promise<ManagerInput> {
  const since = isoBounds({ from: sinceDay, to: sinceDay }).start;
  const prevStart = isoBounds(period.prev).start;
  const visitFrom = [period.prev.from, period.from].sort()[0];

  type InstallmentRow = Omit<RawInstallment, "item_type"> & { plan: { item_type: string } | { item_type: string }[] | null };
  type OverdueRow = RawOverdue;
  const [installments, overdue, refunds, spend, campaigns, visits, content, wa, uploads, pending] = await Promise.all([
    all<InstallmentRow>((f, t) =>
      db
        .from("installments")
        .select("amount, due_date, status, paid_at, paid_amount, plan:payment_plans(item_type)")
        .or(`due_date.gte.${sinceDay},paid_at.gte.${since}`)
        .order("id")
        .range(f, t),
    ),
    all<OverdueRow>((f, t) =>
      db.from("v_overdue_installments").select("amount, days_overdue, item_type").order("installment_id").range(f, t),
    ),
    all<RawRefund>((f, t) => db.from("refunds").select("amount, refund_date").gte("refund_date", sinceDay).order("id").range(f, t)),
    all<RawSpend>((f, t) =>
      db
        .from("ad_spend_daily")
        .select("date, platform, campaign_id, campaign_name, cost_micros, clicks, impressions")
        .gte("date", sinceDay)
        .lte("date", period.to)
        .order("date")
        .order("platform")
        .order("level")
        .order("object_id")
        .range(f, t),
    ),
    all<{ status: string | null }>((f, t) =>
      db.from("ad_objects").select("status").eq("level", "campaign").order("platform").order("object_id").range(f, t),
    ),
    all<RawVisit>((f, t) =>
      db
        .from("site_visit_daily")
        .select("day, path, source, device, pageviews, entrances")
        .gte("day", visitFrom)
        .lte("day", period.to)
        .order("day")
        .order("path")
        .order("source")
        .order("device")
        .range(f, t),
    ),
    all<RawContent>((f, t) =>
      db
        .from("content_items")
        .select("owner_id, created_at, due_at, status, submitted_at, approved_at")
        .order("id")
        .range(f, t),
    ),
    all<RawWa>((f, t) => db.from("wa_outbox").select("status, created_at").gte("created_at", prevStart).order("id").range(f, t)),
    all<RawUpload>((f, t) =>
      db.from("conversion_uploads").select("platform, status, conversion_at").gte("conversion_at", prevStart).order("id").range(f, t),
    ),
    db.from("offers").select("id", { count: "exact", head: true }).eq("status", "onay_bekliyor"),
  ]);

  const activeStatuses = new Set(["ENABLED", "ACTIVE"]);
  return {
    installments: installments.map((i) => {
      const plan = Array.isArray(i.plan) ? i.plan[0] : i.plan;
      return { amount: i.amount, due_date: i.due_date, status: i.status, paid_at: i.paid_at, paid_amount: i.paid_amount, item_type: plan?.item_type ?? null };
    }),
    overdue,
    refunds,
    spend,
    activeCampaigns: campaigns.length === 0 ? null : campaigns.filter((c) => activeStatuses.has((c.status ?? "").toUpperCase())).length,
    adsConnected: { google: readAdsConfig() !== null, meta: readMetaConfig() !== null },
    visits,
    content,
    wa,
    uploads,
    pendingOffers: pending.count ?? 0,
  };
}

/** Velileri tek listede toplar: dönemde/grafikte gelenler, şu an açık olanlar ve olaylarla anılan eski veliler. */
async function loadLeads(db: SupabaseClient, since: string): Promise<{ recent: RawLead[]; open: RawLead[] }> {
  const [recent, open] = await Promise.all([
    all<RawLead>((f, t) => db.from("leads").select(LEAD_COLUMNS).gte("created_at", since).order("created_at").order("id").range(f, t)),
    all<RawLead>((f, t) =>
      db
        .from("leads")
        .select(LEAD_COLUMNS)
        .lt("created_at", since)
        .not("status", "in", "(kazanildi,kaybedildi)")
        .order("id")
        .range(f, t),
    ),
  ]);
  return { recent, open };
}

async function loadLeadsById(db: SupabaseClient, ids: string[]): Promise<RawLead[]> {
  const parts = await Promise.all(
    chunk(ids, IN_CHUNK).map((part) =>
      all<RawLead>((f, t) => db.from("leads").select(LEAD_COLUMNS).in("id", part).order("id").range(f, t)),
    ),
  );
  return parts.flat();
}

export async function loadReport(
  db: SupabaseClient,
  opts: { period: Period; now: Date; viewer: { id: string; role: Role } },
): Promise<Report> {
  const { period, now, viewer } = opts;
  const sinceDay = earliestDay(period);
  const since = isoBounds({ from: sinceDay, to: sinceDay }).start;
  const isManager = viewer.role === "yonetici";

  const [leads, appts, offers, events, profiles, openTasks, students, capacities, settings, manager] = await Promise.all([
    loadLeads(db, since),
    all<RawAppt>((f, t) =>
      db
        .from("appointments")
        .select("lead_id, created_at, scheduled_at, outcome")
        .or(`created_at.gte.${since},scheduled_at.gte.${since}`)
        .order("id")
        .range(f, t),
    ),
    all<RawOffer>((f, t) =>
      db
        .from("offers")
        .select("lead_id, created_at, status, list_price, offered_price, created_by")
        .gte("created_at", since)
        .order("id")
        .range(f, t),
    ),
    all<RawEvent>((f, t) =>
      db
        .from("events")
        .select("entity_type, entity_id, event_type, payload, created_at")
        .in("entity_type", ["lead", "student"])
        .in("event_type", ["durum_degisti", "ogrenciye_donusturuldu"])
        .gte("created_at", since)
        .order("id")
        .range(f, t),
    ),
    all<RawProfile>((f, t) => db.from("profiles").select("id, full_name, role, is_active").order("id").range(f, t)),
    all<RawTask>((f, t) =>
      db.from("tasks").select("assigned_to, due_date, due_at").eq("status", "acik").order("id").range(f, t),
    ),
    all<RawStudent>((f, t) => db.from("students").select("id, status, program, left_date").order("id").range(f, t)),
    db
      .from("price_list_items")
      .select("program, capacity, price_lists!inner(is_active)")
      .eq("price_lists.is_active", true)
      .then((r) => ((r.data ?? []) as RawCapacity[]).map((c) => ({ program: c.program, capacity: c.capacity }))),
    getLeadFlowSettings(db),
    isManager ? loadManager(db, sinceDay, period) : Promise.resolve(null),
  ]);

  // Olaylarda ya da randevularda anılıp listede olmayan eski veliler (ör. geçen yıl gelip bu ay kaybedilen).
  const known = new Set([...leads.recent, ...leads.open].map((l) => l.id));
  const referenced = new Set<string>();
  for (const e of events) {
    const id = e.entity_type === "lead" ? e.entity_id : typeof e.payload?.leadId === "string" ? (e.payload.leadId as string) : null;
    if (id && !known.has(id)) referenced.add(id);
  }
  for (const a of appts) if (!known.has(a.lead_id)) referenced.add(a.lead_id);
  const extra = referenced.size > 0 ? await loadLeadsById(db, [...referenced]) : [];

  return buildReport({
    now,
    period,
    hours: settings.hours,
    viewer,
    leads: [...leads.recent, ...leads.open, ...extra],
    appts,
    offers,
    events,
    profiles,
    openTasks,
    students,
    capacities,
    manager,
  });
}
