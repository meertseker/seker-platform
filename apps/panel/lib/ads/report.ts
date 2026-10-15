import { LEAD_SOURCES, label, type LeadSource, type LeadStatus } from "@/lib/constants";

export interface ReportLead {
  id: string;
  source: LeadSource;
  gclid: string | null;
  utm_campaign: string | null;
  status: LeadStatus;
  converted_student_id: string | null;
}

export interface ReportSpend {
  campaign_id: string;
  campaign_name: string;
  cost_micros: number;
}

export interface ReportRow {
  key: string;
  kind: "kampanya" | "kaynak";
  label: string;
  spendKurus: number;
  leads: number;
  randevu: number;
  kayit: number;
  costPerLeadKurus: number | null;
  costPerKayitKurus: number | null;
}

export interface MarketingReport {
  rows: ReportRow[];
  total: ReportRow;
}

const UNKNOWN_CAMPAIGN = "kampanya:bilinmiyor";
const REACHED_RANDEVU: LeadStatus[] = ["randevu", "gorusme_yapildi", "teklif", "kazanildi"];
const MICROS_PER_KURUS = 10_000;
const DAY_MS = 86400000;
const MAX_RANGE_DAYS = 366;
const DEFAULT_RANGE_DAYS = 29;

function emptyRow(key: string, kind: ReportRow["kind"], rowLabel: string): ReportRow {
  return { key, kind, label: rowLabel, spendKurus: 0, leads: 0, randevu: 0, kayit: 0, costPerLeadKurus: null, costPerKayitKurus: null };
}

function withCosts(row: ReportRow): ReportRow {
  return {
    ...row,
    costPerLeadKurus: row.spendKurus > 0 && row.leads > 0 ? Math.round(row.spendKurus / row.leads) : null,
    costPerKayitKurus: row.spendKurus > 0 && row.kayit > 0 ? Math.round(row.spendKurus / row.kayit) : null,
  };
}

/** Kampanya + kaynak bazında harcama → aday → randevu → kayıt tablosu. */
export function buildMarketingReport(
  leads: ReportLead[],
  appointmentLeadIds: Set<string>,
  spend: ReportSpend[],
): MarketingReport {
  const rows = new Map<string, ReportRow>();
  const microsByCampaign = new Map<string, number>();

  for (const s of spend) {
    const key = `kampanya:${s.campaign_id}`;
    microsByCampaign.set(s.campaign_id, (microsByCampaign.get(s.campaign_id) ?? 0) + Math.round(Number(s.cost_micros)));
    if (!rows.has(key)) rows.set(key, emptyRow(key, "kampanya", s.campaign_name));
  }
  // Mikro toplam tam sayı olarak biriktirilir, kuruşa tek seferde çevrilir.
  for (const [campaignId, micros] of microsByCampaign) {
    rows.get(`kampanya:${campaignId}`)!.spendKurus = Math.round(micros / MICROS_PER_KURUS);
  }

  for (const lead of leads) {
    const isAd = Boolean(lead.gclid) || lead.source === "reklam";
    const campaign = isAd ? (lead.utm_campaign?.trim() ?? "") : "";
    let key: string;
    if (isAd) key = campaign ? `kampanya:${campaign}` : UNKNOWN_CAMPAIGN;
    else key = `kaynak:${lead.source}`;
    const row =
      rows.get(key) ??
      (key === UNKNOWN_CAMPAIGN
        ? emptyRow(key, "kampanya", "Google Ads · kampanya bilinmiyor")
        : isAd
          ? emptyRow(key, "kampanya", campaign)
          : emptyRow(key, "kaynak", label(LEAD_SOURCES, lead.source)));
    row.leads += 1;
    if (appointmentLeadIds.has(lead.id) || REACHED_RANDEVU.includes(lead.status)) row.randevu += 1;
    if (lead.status === "kazanildi" || lead.converted_student_id) row.kayit += 1;
    rows.set(key, row);
  }

  const all = [...rows.values()].map(withCosts);
  const campaigns = all.filter((r) => r.kind === "kampanya").sort((a, b) => b.spendKurus - a.spendKurus || b.leads - a.leads);
  const sources = all.filter((r) => r.kind === "kaynak").sort((a, b) => b.leads - a.leads || a.label.localeCompare(b.label, "tr"));

  const total = withCosts(
    all.reduce(
      (acc, r) => ({
        ...acc,
        spendKurus: acc.spendKurus + r.spendKurus,
        leads: acc.leads + r.leads,
        randevu: acc.randevu + r.randevu,
        kayit: acc.kayit + r.kayit,
      }),
      emptyRow("toplam", "kaynak", "Toplam"),
    ),
  );

  return { rows: [...campaigns, ...sources], total };
}

function addDays(ymd: string, days: number): string {
  return new Date(new Date(`${ymd}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

function isYmd(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** URL'deki ?bas=&bit= değerlerini güvenli bir tarih aralığına çevirir. */
export function normalizeRange(bas: string | undefined, bit: string | undefined, today: string): { from: string; to: string } {
  if (!isYmd(bas) || !isYmd(bit)) return { from: addDays(today, -DEFAULT_RANGE_DAYS), to: today };
  const [start, to] = bas <= bit ? [bas, bit] : [bit, bas];
  let from = start;
  if (addDays(from, MAX_RANGE_DAYS - 1) < to) from = addDays(to, -(MAX_RANGE_DAYS - 1));
  return { from, to };
}
