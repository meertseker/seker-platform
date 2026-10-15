import { createServerSupabase } from "@/lib/supabase/server";
import type { ConversionAction, ConversionUploadStatus } from "@/lib/constants";
import { buildMarketingReport, type MarketingReport, type ReportLead, type ReportSpend } from "@/lib/ads/report";

export interface UploadListItem {
  id: string;
  leadId: string;
  parentName: string;
  action: ConversionAction;
  status: ConversionUploadStatus;
  error: string | null;
  conversionAt: string;
}

/** YYYY-MM-DD gününün İstanbul'daki başlangıcı (UTC ISO). */
function istanbulDayStartIso(ymd: string): string {
  return new Date(`${ymd}T00:00:00+03:00`).toISOString();
}

function nextDay(ymd: string): string {
  return new Date(new Date(`${ymd}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
}

const PAGE_SIZE = 1000; // PostgREST max_rows

type PageResult = { data: unknown[] | null; error: { message: string } | null };

/** PostgREST max_rows sınırını aşmamak için kısa sayfa gelene kadar .range() ile okur. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<PageResult>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const chunk = (data ?? []) as T[];
    all.push(...chunk);
    if (chunk.length < PAGE_SIZE) return all;
  }
}

export async function getMarketingData(
  from: string,
  to: string,
): Promise<{ report: MarketingReport; uploads: UploadListItem[] }> {
  const supabase = await createServerSupabase();

  type LeadRow = ReportLead & { appointments: { id: string }[] | null };
  const [rows, spend, uploadsResult] = await Promise.all([
    fetchAll<LeadRow>((f, t) =>
      supabase
        .from("leads")
        .select("id, source, gclid, utm_campaign, status, converted_student_id, appointments(id)")
        .gte("created_at", istanbulDayStartIso(from))
        .lt("created_at", istanbulDayStartIso(nextDay(to)))
        .order("created_at")
        .order("id")
        .range(f, t),
    ),
    fetchAll<ReportSpend>((f, t) =>
      supabase
        .from("ad_spend_daily")
        .select("campaign_id, campaign_name, cost_micros")
        .gte("date", from)
        .lte("date", to)
        .order("date")
        .order("campaign_id")
        .range(f, t),
    ),
    // Son 50 yükleme: tek sayfa (limit < max_rows), sayfalama gerekmez.
    supabase
      .from("conversion_uploads")
      .select("id, lead_id, conversion_action, status, error, conversion_at, lead:leads(parent_name)")
      .order("conversion_at", { ascending: false })
      .limit(50),
  ]);
  if (uploadsResult.error) throw new Error(uploadsResult.error.message);

  const appointmentLeadIds = new Set(rows.filter((l) => l.appointments?.length).map((l) => l.id));
  const leads: ReportLead[] = rows.map((row) => ({
    id: row.id,
    source: row.source,
    gclid: row.gclid,
    utm_campaign: row.utm_campaign,
    status: row.status,
    converted_student_id: row.converted_student_id,
  }));

  const report = buildMarketingReport(
    leads,
    appointmentLeadIds,
    spend,
  );

  type UploadRow = {
    id: string; lead_id: string; conversion_action: ConversionAction; status: ConversionUploadStatus;
    error: string | null; conversion_at: string; lead: { parent_name: string } | { parent_name: string }[] | null;
  };
  const uploads = ((uploadsResult.data ?? []) as unknown as UploadRow[]).map((row) => {
    const lead = Array.isArray(row.lead) ? row.lead[0] : row.lead;
    return {
      id: row.id,
      leadId: row.lead_id,
      parentName: lead?.parent_name ?? "—",
      action: row.conversion_action,
      status: row.status,
      error: row.error,
      conversionAt: row.conversion_at,
    };
  });

  return { report, uploads };
}
