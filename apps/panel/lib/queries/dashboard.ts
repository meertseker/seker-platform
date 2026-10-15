import { createServerSupabase } from "@/lib/supabase/server";
import { tlToKurus } from "@/lib/money";
import { LEAD_SOURCES, LOST_REASONS, type LeadSource, type LeadStatus, type LostReason } from "@/lib/constants";

export interface FunnelResult {
  leads: number;
  randevu: number;
  gorusme: number;
  kayit: number;
}

export interface SourceConversionRow {
  source: LeadSource;
  total: number;
  won: number;
}

export interface LostReasonRow {
  reason: LostReason;
  count: number;
}

export interface PaymentSummary {
  dueThisMonthKurus: number;
  paidThisMonthKurus: number;
  overdueKurus: number;
}

export interface ConsultantBreakdownRow {
  consultantId: string;
  consultantName: string;
  leads: number;
  won: number;
}

interface LeadStatusRow {
  id: string;
  status: LeadStatus;
}

interface DurumDegistiEvent {
  entity_id: string;
  payload: { to?: string } | null;
}

/** Görüşme yapıldı aşamasına ulaşmış sayılan durumlar (spec §11: gorusme_yapildi+ötesi). */
const GORUSME_OR_BEYOND: LeadStatus[] = ["gorusme_yapildi", "teklif", "kazanildi"];

/** Europe/Istanbul takviminde bugünün YYYY-MM-DD dizesini döner (DST yok, sabit +03:00). */
function istanbulToday(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
}

/** "YYYY-MM" ayını, timestamptz kolonları için Istanbul takvim ayının UTC başlangıç/bitiş ISO damgalarına çevirir. */
function monthIsoTimestampRange(monthIso: string): { start: string; end: string } {
  const [yearStr, monthStr] = monthIso.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1, -3)).toISOString();
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, -3)).toISOString();
  return { start, end };
}

/** "YYYY-MM" ayını, `date` tipi kolonlar (ör. due_date) için takvim gün sınırlarına çevirir. */
function monthIsoDateRange(monthIso: string): { startYmd: string; nextStartYmd: string } {
  const [yearStr, monthStr] = monthIso.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const ymd = (date: Date) => date.toISOString().slice(0, 10);
  return {
    startYmd: ymd(new Date(Date.UTC(year, monthIndex, 1))),
    nextStartYmd: ymd(new Date(Date.UTC(year, monthIndex + 1, 1))),
  };
}

function sumKurus<T extends string>(rows: Record<T, number | string | null>[], field: T): number {
  return rows.reduce((sum, row) => {
    const value = row[field];
    if (value == null) return sum;
    return sum + tlToKurus(Number(value));
  }, 0);
}

/** Seçili ayda oluşturulan lead'ler için huni: toplam, randevusu olan, görüşmeye ulaşan, kazanılan (spec §11). */
export async function getFunnel(monthIso: string): Promise<FunnelResult> {
  const supabase = await createServerSupabase();
  const { start, end } = monthIsoTimestampRange(monthIso);

  const { data: leadsData } = await supabase
    .from("leads")
    .select("id, status")
    .gte("created_at", start)
    .lt("created_at", end);

  const leads = (leadsData ?? []) as LeadStatusRow[];
  const ids = leads.map((lead) => lead.id);

  if (ids.length === 0) {
    return { leads: 0, randevu: 0, gorusme: 0, kayit: 0 };
  }

  const [appointmentsResult, eventsResult] = await Promise.all([
    supabase.from("appointments").select("lead_id").in("lead_id", ids),
    supabase
      .from("events")
      .select("entity_id, payload")
      .eq("entity_type", "lead")
      .eq("event_type", "durum_degisti")
      .in("entity_id", ids),
  ]);

  const randevuLeadIds = new Set(
    ((appointmentsResult.data ?? []) as { lead_id: string }[]).map((row) => row.lead_id),
  );

  const gorusmeLeadIds = new Set<string>();
  for (const event of (eventsResult.data ?? []) as DurumDegistiEvent[]) {
    const to = event.payload?.to;
    if (to && GORUSME_OR_BEYOND.includes(to as LeadStatus)) {
      gorusmeLeadIds.add(event.entity_id);
    }
  }

  const kayit = leads.filter((lead) => lead.status === "kazanildi").length;

  return {
    leads: leads.length,
    randevu: randevuLeadIds.size,
    gorusme: gorusmeLeadIds.size,
    kayit,
  };
}

/** Tüm lead'lerin kaynak bazında toplam ve kazanılan sayıları (spec §11). */
export async function getSourceConversion(): Promise<SourceConversionRow[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("leads").select("source, status");
  const rows = (data ?? []) as { source: LeadSource; status: LeadStatus }[];

  const counts = new Map<LeadSource, { total: number; won: number }>(
    (Object.keys(LEAD_SOURCES) as LeadSource[]).map((source) => [source, { total: 0, won: 0 }]),
  );

  for (const row of rows) {
    const entry = counts.get(row.source) ?? { total: 0, won: 0 };
    entry.total += 1;
    if (row.status === "kazanildi") entry.won += 1;
    counts.set(row.source, entry);
  }

  return Array.from(counts.entries()).map(([source, entry]) => ({ source, ...entry }));
}

/** Kaybedilen lead'lerin lost_reason dağılımı, sayıya göre azalan sırada (spec §11). */
export async function getLostReasons(): Promise<LostReasonRow[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("leads").select("lost_reason").eq("status", "kaybedildi");
  const rows = (data ?? []) as { lost_reason: LostReason | null }[];

  const counts = new Map<LostReason, number>(
    (Object.keys(LOST_REASONS) as LostReason[]).map((reason) => [reason, 0]),
  );

  for (const row of rows) {
    if (row.lost_reason) counts.set(row.lost_reason, (counts.get(row.lost_reason) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

/** Seçili ayda vadesi gelen toplam, seçili ayda tahsil edilen toplam ve tüm zamanların geciken toplamı (spec §11). */
export async function getPaymentSummary(monthIso: string): Promise<PaymentSummary> {
  const supabase = await createServerSupabase();
  const { start, end } = monthIsoTimestampRange(monthIso);
  const { startYmd, nextStartYmd } = monthIsoDateRange(monthIso);
  const today = istanbulToday();

  const [dueResult, paidResult, overdueResult] = await Promise.all([
    supabase
      .from("installments")
      .select("amount")
      .neq("status", "iptal")
      .gte("due_date", startYmd)
      .lt("due_date", nextStartYmd),
    supabase
      .from("installments")
      .select("paid_amount")
      .eq("status", "odendi")
      .gte("paid_at", start)
      .lt("paid_at", end),
    supabase.from("installments").select("amount").eq("status", "bekliyor").lt("due_date", today),
  ]);

  return {
    dueThisMonthKurus: sumKurus((dueResult.data ?? []) as { amount: number }[], "amount"),
    paidThisMonthKurus: sumKurus((paidResult.data ?? []) as { paid_amount: number | null }[], "paid_amount"),
    overdueKurus: sumKurus((overdueResult.data ?? []) as { amount: number }[], "amount"),
  };
}

/** Danışman bazında lead ve kazanılan sayıları. Yalnız yönetici tarafından çağrılmalıdır (spec §4, §11). */
export async function getConsultantBreakdown(): Promise<ConsultantBreakdownRow[]> {
  const supabase = await createServerSupabase();
  const [{ data: profiles }, { data: leadsData }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
    supabase.from("leads").select("assigned_to, status").not("assigned_to", "is", null),
  ]);

  const rows = (leadsData ?? []) as { assigned_to: string; status: LeadStatus }[];
  const counts = new Map<string, { leads: number; won: number }>();

  for (const row of rows) {
    const entry = counts.get(row.assigned_to) ?? { leads: 0, won: 0 };
    entry.leads += 1;
    if (row.status === "kazanildi") entry.won += 1;
    counts.set(row.assigned_to, entry);
  }

  return ((profiles ?? []) as { id: string; full_name: string }[]).map((profile) => {
    const entry = counts.get(profile.id) ?? { leads: 0, won: 0 };
    return {
      consultantId: profile.id,
      consultantName: profile.full_name,
      leads: entry.leads,
      won: entry.won,
    };
  });
}
