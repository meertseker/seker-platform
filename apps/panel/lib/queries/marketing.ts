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

export async function getMarketingData(
  from: string,
  to: string,
): Promise<{ report: MarketingReport; uploads: UploadListItem[] }> {
  const supabase = await createServerSupabase();

  const [leadsResult, spendResult, uploadsResult] = await Promise.all([
    supabase
      .from("leads")
      .select("id, source, gclid, utm_campaign, status, converted_student_id, appointments(id)")
      .gte("created_at", istanbulDayStartIso(from))
      .lt("created_at", istanbulDayStartIso(nextDay(to))),
    supabase.from("ad_spend_daily").select("campaign_id, campaign_name, cost_micros").gte("date", from).lte("date", to),
    supabase
      .from("conversion_uploads")
      .select("id, lead_id, conversion_action, status, error, conversion_at, lead:leads(parent_name)")
      .order("conversion_at", { ascending: false })
      .limit(50),
  ]);

  if (leadsResult.error) throw new Error(leadsResult.error.message);
  if (spendResult.error) throw new Error(spendResult.error.message);

  type LeadRow = ReportLead & { appointments: { id: string }[] | null };
  const rows = (leadsResult.data ?? []) as unknown as LeadRow[];
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
    (spendResult.data ?? []) as ReportSpend[],
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
