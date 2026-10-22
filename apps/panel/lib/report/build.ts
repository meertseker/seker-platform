// Rapor ekranının bütün hesabı (saf): yükleyicinin ham satırlarından bölümleri kurar. Saat okumaz; `now` dışarıdan gelir.
// Tanımlar docs/superpowers/specs/2026-10-20-rapor-paneli-design.md'de.
import { buildMarketingReport, type ReportLead, type ReportSpend } from "@/lib/ads/report";
import {
  CONVERSION_UPLOAD_STATUSES,
  ITEM_TYPES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  LOST_REASONS,
  OFFER_STATUSES,
  PROGRAMS,
  label,
  type LeadSource,
  type LeadStatus,
} from "@/lib/constants";
import { businessMinutesBetween, type BusinessHours } from "@/lib/lead-flow/business-hours";
import { summarizeVisits, VISIT_SOURCE_LABELS, type VisitRow, type VisitSummary } from "@/lib/queries/site-visits";
import { collectedKurus, receivableKurus } from "@/lib/queries/money";
import { inSeason } from "@/lib/queries/season";
import type { Role } from "@/lib/role-access";
import {
  agingOf,
  bump,
  change,
  costPer,
  kurus,
  mean,
  median,
  microsToKurus,
  normalizeTerm,
  ratio,
  sum,
  type Change,
  type Direction,
} from "./metrics";
import { formatInt } from "./format";
import { inRange, isoInRange, istanbulDay, lastMonths, formatMonth, type DayRange, type Period } from "./period";
import { col, type ReportTable, type Row } from "./table";

// ---- Ham satırlar ----

export type RawLead = {
  id: string;
  created_at: string;
  first_contact_at: string | null;
  last_activity_at: string | null;
  status: LeadStatus;
  lost_reason: string | null;
  source: string;
  channel: string | null;
  ad_platform: "google" | "meta" | null;
  gclid: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  landing_path: string | null;
  assigned_to: string | null;
  is_qualified: boolean | null;
  q_reached: boolean | null;
  converted_student_id: string | null;
};
export type RawAppt = { lead_id: string; created_at: string; scheduled_at: string; outcome: string | null };
export type RawOffer = {
  lead_id: string;
  created_at: string;
  status: string;
  list_price: number | string;
  offered_price: number | string;
  created_by: string | null;
};
export type RawEvent = {
  entity_type: string;
  entity_id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};
export type RawProfile = { id: string; full_name: string; role: string; is_active: boolean };
export type RawTask = { assigned_to: string; due_date: string; due_at: string | null };
export type RawStudent = { id: string; status: string; program: string | null; left_date: string | null };
export type RawCapacity = { program: string; capacity: number | null };
export type RawInstallment = {
  amount: number | string;
  due_date: string;
  status: string;
  paid_at: string | null;
  paid_amount: number | string | null;
  item_type: string | null;
  /** Taksitin planının sezonu (payment_plans.season). */
  season: string | null;
};
export type RawOverdue = { amount: number | string; days_overdue: number; item_type: string | null };
export type RawRefund = { amount: number | string; refund_date: string };
export type RawSpend = {
  date: string;
  platform: "google" | "meta";
  campaign_id: string;
  campaign_name: string;
  cost_micros: number;
  clicks: number;
  impressions: number;
};
export type RawContent = {
  owner_id: string;
  created_at: string;
  due_at: string | null;
  status: string;
  submitted_at: string | null;
  approved_at: string | null;
};
export type RawWa = { status: string; created_at: string };
export type RawUpload = { platform: string; status: string; conversion_at: string };
export type RawVisit = VisitRow & { day: string };

export type ManagerInput = {
  /** Para toplamlarının sezonu (aktif sezon). null: süzgeç yok, bütün sezonlar sayılır. */
  season: string | null;
  installments: RawInstallment[];
  overdue: RawOverdue[];
  refunds: RawRefund[];
  spend: RawSpend[];
  /** ad_objects'te açık (ENABLED/ACTIVE) kampanya sayısı; hiç kampanya nesnesi yoksa null. */
  activeCampaigns: number | null;
  adsConnected: { google: boolean; meta: boolean };
  visits: RawVisit[];
  content: RawContent[];
  wa: RawWa[];
  uploads: RawUpload[];
  pendingOffers: number;
};

export type ReportInput = {
  now: Date;
  period: Period;
  hours: BusinessHours;
  viewer: { id: string; role: Role };
  leads: RawLead[];
  appts: RawAppt[];
  offers: RawOffer[];
  events: RawEvent[];
  profiles: RawProfile[];
  openTasks: RawTask[];
  students: RawStudent[];
  capacities: RawCapacity[];
  /** Yalnız yönetici: para, reklam, site, içerik, otomasyon. Danışmanda null. */
  manager: ManagerInput | null;
};

// ---- Veli olguları ----

const STAGE_LABELS = ["Yeni aday", "Ulaşıldı", "Randevu", "Görüşme", "Teklif", "Kayıt"] as const;
const STATUS_RANK: Partial<Record<string, number>> = {
  yeni: 0,
  ulasildi: 1,
  randevu: 2,
  gorusme_yapildi: 3,
  teklif: 4,
  kazanildi: 5,
};
const DAY_MS = 86_400_000;

export type SourceKey = LeadSource | "google_reklam" | "instagram_reklam";

export const SOURCE_LABELS: Record<SourceKey, string> = {
  google_reklam: "Google reklamı",
  instagram_reklam: "Instagram reklamı",
  ...LEAD_SOURCES,
};

export type LeadFacts = {
  lead: RawLead;
  /** Ulaşılan en ileri aşama (0 yeni … 5 kayıt). */
  stage: number;
  /** Aşamaya giriş anları (ms); zamanı bilinmeyen aşama null. */
  times: (number | null)[];
  platform: "google" | "meta" | null;
  source: SourceKey;
  hasAppt: boolean;
};

/** K10: ücretli reklam platformu. gclid ya da source=reklam Google sayılır, Meta işareti olsa da. */
export function adPlatformOf(lead: Pick<RawLead, "gclid" | "source" | "ad_platform">): "google" | "meta" | null {
  if (lead.gclid || lead.source === "reklam" || lead.ad_platform === "google") return "google";
  if (lead.ad_platform === "meta") return "meta";
  return null;
}

export function sourceKeyOf(lead: Pick<RawLead, "gclid" | "source" | "ad_platform">): SourceKey {
  const platform = adPlatformOf(lead);
  if (platform === "google") return "google_reklam";
  if (platform === "meta") return "instagram_reklam";
  return (lead.source in LEAD_SOURCES ? lead.source : "diger") as LeadSource;
}

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

function minOf(...values: (number | null | undefined)[]): number | null {
  const list = values.filter((v): v is number => typeof v === "number");
  return list.length ? Math.min(...list) : null;
}

type Indexes = {
  apptsByLead: Map<string, RawAppt[]>;
  offersByLead: Map<string, RawOffer[]>;
  statusEvents: Map<string, { to: string; at: number }[]>;
  wonAt: Map<string, number>;
};

function statusTo(e: RawEvent): string | null {
  const to = e.payload?.to;
  return typeof to === "string" ? to : null;
}

/** Kazanma olayının velisi: durum → kazanildi ya da öğrenciye dönüştürme (`payload.leadId`). */
export function wonLeadIdOf(e: RawEvent): string | null {
  if (e.entity_type === "lead" && e.event_type === "durum_degisti" && statusTo(e) === "kazanildi") return e.entity_id;
  if (e.entity_type === "student" && e.event_type === "ogrenciye_donusturuldu") {
    const id = e.payload?.leadId;
    return typeof id === "string" ? id : null;
  }
  return null;
}

function buildIndexes(input: Pick<ReportInput, "appts" | "offers" | "events">): Indexes {
  const apptsByLead = new Map<string, RawAppt[]>();
  for (const a of input.appts) apptsByLead.set(a.lead_id, [...(apptsByLead.get(a.lead_id) ?? []), a]);
  const offersByLead = new Map<string, RawOffer[]>();
  for (const o of input.offers) offersByLead.set(o.lead_id, [...(offersByLead.get(o.lead_id) ?? []), o]);
  const statusEvents = new Map<string, { to: string; at: number }[]>();
  const wonAt = new Map<string, number>();
  for (const e of input.events) {
    const at = ms(e.created_at);
    if (at === null) continue;
    if (e.entity_type === "lead" && e.event_type === "durum_degisti") {
      const to = statusTo(e);
      if (to) statusEvents.set(e.entity_id, [...(statusEvents.get(e.entity_id) ?? []), { to, at }]);
    }
    const won = wonLeadIdOf(e);
    if (won) wonAt.set(won, Math.min(wonAt.get(won) ?? Infinity, at));
  }
  return { apptsByLead, offersByLead, statusEvents, wonAt };
}

function firstStatusAt(events: { to: string; at: number }[], status: string): number | null {
  return minOf(...events.filter((e) => e.to === status).map((e) => e.at));
}

/** Velinin ulaştığı en ileri aşama ve aşamalara giriş anları (tanımlar tasarım belgesinde). */
export function leadFactsOf(lead: RawLead, ix: Indexes): LeadFacts {
  const events = ix.statusEvents.get(lead.id) ?? [];
  const history = Math.max(STATUS_RANK[lead.status] ?? 0, ...events.map((e) => STATUS_RANK[e.to] ?? 0));
  const appts = (ix.apptsByLead.get(lead.id) ?? []).filter((a) => a.outcome !== "iptal");
  const visited = appts.filter((a) => a.outcome === "geldi");
  const offers = ix.offersByLead.get(lead.id) ?? [];
  const won = lead.status === "kazanildi" || !!lead.converted_student_id;

  const t1 = minOf(ms(lead.first_contact_at), firstStatusAt(events, "ulasildi"));
  const t2 = minOf(...appts.map((a) => ms(a.created_at)), firstStatusAt(events, "randevu"));
  const t3 = minOf(...visited.map((a) => ms(a.scheduled_at)), firstStatusAt(events, "gorusme_yapildi"));
  const t4 = minOf(...offers.map((o) => ms(o.created_at)), firstStatusAt(events, "teklif"));
  const t5 = ix.wonAt.get(lead.id) ?? null;

  const reached = [
    true,
    t1 !== null || lead.q_reached === true || history >= 1,
    appts.length > 0 || history >= 2,
    visited.length > 0 || history >= 3,
    offers.length > 0 || history >= 4,
    won,
  ];
  let stage = 0;
  reached.forEach((r, i) => {
    if (r) stage = i;
  });

  return {
    lead,
    stage,
    times: [ms(lead.created_at), t1, t2, t3, t4, won ? t5 : null],
    platform: adPlatformOf(lead),
    source: sourceKeyOf(lead),
    hasAppt: appts.length > 0,
  };
}

// ---- Bölümler ----

export type Kpi = {
  key: string;
  label: string;
  value: number | null;
  kind: "int" | "tl";
  change: Change | null;
  goodWhen: Direction;
  helper: string;
  href?: string;
};

export type TrendSeries = { key: string; label: string; values: number[]; kind: "int" | "tl" };
export type Trend = { months: string[]; series: TrendSeries[] };

export type SummarySection = { headline: string; kpis: Kpi[]; trend: Trend; tables: ReportTable[] };

export type FunnelStep = {
  label: string;
  n: number;
  prevN: number;
  ofTotal: number | null;
  fromPrev: number | null;
  medianDaysFromPrev: number | null;
  worst: boolean;
};
export type FunnelSection = {
  total: number;
  steps: FunnelStep[];
  open: { status: LeadStatus; label: string; n: number; stale: number }[];
  openTotal: number;
  staleTotal: number;
  tables: ReportTable[];
};

export type SourcesSection = {
  hasAdData: boolean;
  adNote: string | null;
  platforms: { key: string; label: string; spendKurus: number; leads: number; kayit: number; costPerLead: number | null; costPerKayit: number | null }[];
  bars: { label: string; leads: number; kayit: number }[];
  tables: ReportTable[];
};

export type FrontOfficeSection = { ownOnly: boolean; tables: ReportTable[] };
export type LostSection = { total: number; prevTotal: number; bars: { label: string; n: number; prevN: number }[]; tables: ReportTable[] };
export type OffersSection = { created: number; approved: number; avgDiscount: number | null; pending: number; tables: ReportTable[] };

export type MoneyBlock = {
  /** Tahsilat ve vadesi gelen bu sezonun planlarından; geciken bütün sezonlar (Gecikenler ile aynı). */
  season: string | null;
  expectedKurus: number;
  collectedKurus: number;
  dueCollectedRatio: number | null;
  refundsKurus: number;
  overdueKurus: number;
  overdueCount: number;
  aging: { key: string; label: string; count: number; amountKurus: number }[];
  trend: Trend;
};
export type StudentsSection = {
  active: number;
  left: number;
  programs: { program: string; label: string; active: number; capacity: number | null }[];
  money: MoneyBlock | null;
  tables: ReportTable[];
};
export type ContentSection = { given: number; submitted: number; approved: number; onTime: number | null; late: number; tables: ReportTable[] };
export type SiteSection = {
  current: VisitSummary;
  previous: VisitSummary;
  webLeads: number;
  conversion: number | null;
  tables: ReportTable[];
};
export type AutomationSection = { waSent: number; waFailed: number; uploadsSent: number; uploadsFailed: number; uploadsPending: number; tables: ReportTable[] };

export type Report = {
  period: Period;
  role: Role;
  summary: SummarySection;
  funnel: FunnelSection;
  sources: SourcesSection;
  frontOffice: FrontOfficeSection;
  lost: LostSection;
  offers: OffersSection | null;
  students: StudentsSection;
  content: ContentSection | null;
  site: SiteSection | null;
  automation: AutomationSection | null;
};

export const SECTION_IDS = [
  "ozet",
  "huni",
  "kaynaklar",
  "on-buro",
  "kayip",
  "teklifler",
  "ogrenciler",
  "icerik",
  "site",
  "otomasyon",
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export const SECTION_TITLES: Record<SectionId, string> = {
  ozet: "Özet",
  huni: "Aday hunisi",
  kaynaklar: "Kaynaklar ve reklam",
  "on-buro": "Ön büro",
  kayip: "Kayıp nedenleri",
  teklifler: "Teklifler",
  ogrenciler: "Öğrenciler ve tahsilat",
  icerik: "İçerik",
  site: "Site trafiği",
  otomasyon: "Otomasyonlar",
};

/** Bölüm → tabloları; rolün göremediği bölüm hiç yer almaz (ekran ve dosya aynı listeyi kullanır). */
export function sectionTables(report: Report): { id: SectionId; title: string; tables: ReportTable[] }[] {
  const map: Record<SectionId, ReportTable[] | null> = {
    ozet: report.summary.tables,
    huni: report.funnel.tables,
    kaynaklar: report.sources.tables,
    "on-buro": report.frontOffice.tables,
    kayip: report.lost.tables,
    teklifler: report.offers?.tables ?? null,
    ogrenciler: report.students.tables,
    icerik: report.content?.tables ?? null,
    site: report.site?.tables ?? null,
    otomasyon: report.automation?.tables ?? null,
  };
  return SECTION_IDS.filter((id) => map[id] !== null).map((id) => ({ id, title: SECTION_TITLES[id], tables: map[id] ?? [] }));
}

// ---- Yardımcılar ----

function cohort(facts: LeadFacts[], range: DayRange): LeadFacts[] {
  return facts.filter((f) => isoInRange(f.lead.created_at, range));
}

function wonInRange(events: RawEvent[], range: DayRange): Set<string> {
  const out = new Set<string>();
  for (const e of events) {
    const id = wonLeadIdOf(e);
    if (id && isoInRange(e.created_at, range)) out.add(id);
  }
  return out;
}

/** Dönemde kaybedilen veliler: velinin dönemdeki son "kaybedildi" olayının nedeni. */
function lostInRange(events: RawEvent[], range: DayRange, leadsById: Map<string, RawLead>): Map<string, string> {
  const out = new Map<string, { at: number; reason: string }>();
  for (const e of events) {
    if (e.entity_type !== "lead" || e.event_type !== "durum_degisti" || statusTo(e) !== "kaybedildi") continue;
    if (!isoInRange(e.created_at, range)) continue;
    const at = ms(e.created_at) ?? 0;
    const payloadReason = e.payload?.lostReason;
    const reason =
      (typeof payloadReason === "string" && payloadReason) || leadsById.get(e.entity_id)?.lost_reason || "diger";
    const prev = out.get(e.entity_id);
    if (!prev || at >= prev.at) out.set(e.entity_id, { at, reason });
  }
  return new Map([...out].map(([id, v]) => [id, v.reason]));
}

function apptsCreated(appts: RawAppt[], range: DayRange): RawAppt[] {
  return appts.filter((a) => a.outcome !== "iptal" && isoInRange(a.created_at, range));
}

function apptsScheduled(appts: RawAppt[], range: DayRange): RawAppt[] {
  return appts.filter((a) => isoInRange(a.scheduled_at, range));
}

function spendIn(spend: RawSpend[], range: DayRange): RawSpend[] {
  return spend.filter((s) => inRange(s.date, range));
}

function spendKurus(rows: RawSpend[]): number {
  return microsToKurus(sum(rows.map((r) => Number(r.cost_micros) || 0)));
}

function monthOfIso(iso: string): string {
  return istanbulDay(iso).slice(0, 7);
}

// ---- Özet ----

function buildSummary(input: ReportInput, facts: LeadFacts[]): SummarySection {
  const { period, manager } = input;
  const prev = period.prev;
  const curLeads = cohort(facts, period).length;
  const prevLeads = cohort(facts, prev).length;
  const curWon = wonInRange(input.events, period);
  const prevWon = wonInRange(input.events, prev);
  const visited = (r: DayRange) => apptsScheduled(input.appts, r).filter((a) => a.outcome === "geldi").length;
  const active = input.students.filter((s) => s.status === "aktif").length;

  const kpis: Kpi[] = [
    {
      key: "aday",
      label: "Yeni aday",
      value: curLeads,
      kind: "int",
      change: change(curLeads, prevLeads),
      goodWhen: "up",
      helper: "Dönemde panele düşen veli",
      href: "/pipeline",
    },
    {
      key: "randevu",
      label: "Verilen randevu",
      value: apptsCreated(input.appts, period).length,
      kind: "int",
      change: change(apptsCreated(input.appts, period).length, apptsCreated(input.appts, prev).length),
      goodWhen: "up",
      helper: "Dönemde yazılan, iptal edilmemiş randevu",
      href: "/takvim",
    },
    {
      key: "ziyaret",
      label: "Ziyarete gelen",
      value: visited(period),
      kind: "int",
      change: change(visited(period), visited(prev)),
      goodWhen: "up",
      helper: "Randevusu dönemde olan ve gelen veli",
    },
    {
      key: "kayit",
      label: "Yeni kayıt",
      value: curWon.size,
      kind: "int",
      change: change(curWon.size, prevWon.size),
      goodWhen: "up",
      helper: "Dönemde kazanıldı ya da öğrenciye dönüştürüldü",
    },
    {
      key: "ogrenci",
      label: "Aktif öğrenci",
      value: active,
      kind: "int",
      change: null,
      goodWhen: "up",
      helper: "Bugün kayıtlı ve ayrılmamış (dönemden bağımsız)",
      href: "/ogrenciler",
    },
  ];

  if (manager) {
    const paid = (r: DayRange) =>
      sum(
        seasonInstallments(manager)
          .filter((i) => i.status === "odendi" && isoInRange(i.paid_at, r))
          .map(collectedKurus),
      );
    const spendCur = spendKurus(spendIn(manager.spend, period));
    const spendPrev = spendKurus(spendIn(manager.spend, prev));
    const paidLeads = (r: DayRange) => cohort(facts, r).filter((f) => f.platform !== null).length;
    const cplCur = costPer(spendCur, paidLeads(period));
    const cplPrev = costPer(spendPrev, paidLeads(prev));
    kpis.push(
      {
        key: "tahsilat",
        label: "Tahsil edilen",
        value: paid(period),
        kind: "tl",
        change: change(paid(period), paid(prev)),
        goodWhen: "up",
        helper: manager.season ? `Dönemde ödendi işaretlenen taksitler · ${manager.season} sezonu` : "Dönemde ödendi işaretlenen taksitler",
        href: "/odemeler",
      },
      {
        key: "harcama",
        label: "Reklam harcaması",
        value: spendCur,
        kind: "tl",
        change: change(spendCur, spendPrev),
        goodWhen: "none",
        helper: "Google ve Instagram, dönemdeki günler",
        href: "/reklam/kampanyalar",
      },
      {
        key: "cpl",
        label: "Aday başı maliyet",
        value: cplCur,
        kind: "tl",
        change: cplCur !== null && cplPrev !== null ? change(cplCur, cplPrev) : null,
        goodWhen: "down",
        helper: "Harcama ÷ reklamdan gelen aday",
      },
    );
  }

  const leadChange = change(curLeads, prevLeads);
  const comparison =
    leadChange.diff === 0
      ? `önceki dönemle (${prev.label}) aynı sayıda aday`
      : `önceki döneme (${prev.label}) göre ${formatInt(Math.abs(leadChange.diff))} aday ${leadChange.diff > 0 ? "fazla" : "az"}`;
  const headline =
    curLeads === 0 && curWon.size === 0
      ? `${period.phrase} yeni aday ya da kayıt yok.`
      : `${period.phrase} ${formatInt(curLeads)} aday geldi, ${formatInt(curWon.size)} kayıt oldu; ${comparison}.`;

  // Son 12 ay: aylık yeni aday ve yeni kayıt.
  const months = lastMonths(period.to, 12);
  const leadByMonth = new Map<string, number>();
  for (const f of facts) bump(leadByMonth, monthOfIso(f.lead.created_at));
  const wonByMonth = new Map<string, Set<string>>();
  for (const e of input.events) {
    const id = wonLeadIdOf(e);
    if (!id) continue;
    const m = monthOfIso(e.created_at);
    wonByMonth.set(m, (wonByMonth.get(m) ?? new Set()).add(id));
  }
  const trend: Trend = {
    months,
    series: [
      { key: "aday", label: "Yeni aday", values: months.map((m) => leadByMonth.get(m) ?? 0), kind: "int" },
      { key: "kayit", label: "Yeni kayıt", values: months.map((m) => wonByMonth.get(m)?.size ?? 0), kind: "int" },
    ],
  };

  const tables: ReportTable[] = [
    {
      id: "ozet",
      title: `Özet · ${period.label}`,
      columns: [col("metrik", "Metrik", "text"), col("deger", "Bu dönem"), col("onceki", `Önceki dönem (${prev.label})`), col("degisim", "Değişim", "pct")],
      rows: kpis.map((k) => {
        const tl = (v: number | null) => (v === null ? null : k.kind === "tl" ? v / 100 : v);
        return {
          metrik: k.kind === "tl" ? `${k.label} (₺)` : k.label,
          deger: tl(k.value),
          onceki: k.change ? tl(k.change.previous) : null,
          degisim: k.change?.pct ?? null,
        };
      }),
    },
    {
      id: "ozet-12-ay",
      title: "Son 12 ay: yeni aday ve kayıt",
      columns: [col("ay", "Ay", "text"), col("aday", "Yeni aday"), col("kayit", "Yeni kayıt")],
      rows: months.map((m, i) => ({ ay: formatMonth(m), aday: trend.series[0].values[i], kayit: trend.series[1].values[i] })),
    },
  ];

  return { headline, kpis, trend, tables };
}

// ---- Huni ----

function buildFunnel(input: ReportInput, facts: LeadFacts[]): FunnelSection {
  const cur = cohort(facts, input.period);
  const prev = cohort(facts, input.period.prev);
  const counts = STAGE_LABELS.map((_, i) => cur.filter((f) => f.stage >= i).length);
  const prevCounts = STAGE_LABELS.map((_, i) => prev.filter((f) => f.stage >= i).length);

  const waits = STAGE_LABELS.map((_, i) => {
    if (i === 0) return null;
    const days: number[] = [];
    for (const f of cur) {
      const at = f.times[i];
      if (at === null || f.stage < i) continue;
      // Önceki aşamalardan zamanı bilinen en yakını.
      let before: number | null = null;
      for (let j = i - 1; j >= 0 && before === null; j--) before = f.times[j];
      if (before !== null && at >= before) days.push((at - before) / DAY_MS);
    }
    return median(days);
  });

  const fromPrev = counts.map((n, i) => (i === 0 ? null : ratio(n, counts[i - 1])));
  let worst = -1;
  fromPrev.forEach((r, i) => {
    if (r !== null && r < 1 && (worst === -1 || r < (fromPrev[worst] as number))) worst = i;
  });

  const steps: FunnelStep[] = STAGE_LABELS.map((stepLabel, i) => ({
    label: stepLabel,
    n: counts[i],
    prevN: prevCounts[i],
    ofTotal: ratio(counts[i], counts[0]),
    fromPrev: fromPrev[i],
    medianDaysFromPrev: waits[i],
    worst: i === worst,
  }));

  // Şu an açık veliler (dönemden bağımsız): yükleyici açık velilerin hepsini getirir.
  const now = input.now.getTime();
  const openStatuses: LeadStatus[] = ["yeni", "ulasildi", "randevu", "gorusme_yapildi", "teklif", "beklemede"];
  const open = openStatuses.map((status) => {
    const list = input.leads.filter((l) => l.status === status);
    const stale = list.filter((l) => {
      const last = ms(l.last_activity_at) ?? ms(l.created_at) ?? now;
      return now - last > 7 * DAY_MS;
    }).length;
    return { status, label: LEAD_STATUSES[status], n: list.length, stale };
  });

  const tables: ReportTable[] = [
    {
      id: "huni",
      title: `Aday hunisi · ${input.period.label} gelen veliler`,
      columns: [
        col("asama", "Aşama", "text"),
        col("adet", "Veli"),
        col("pay", "Gelenlere oranı", "pct"),
        col("gecis", "Önceki adımdan geçen", "pct"),
        col("bekleme", "Ortanca bekleme", "days"),
        col("onceki", `Önceki dönem (${input.period.prev.label})`),
      ],
      rows: steps.map((s) => ({
        asama: s.label,
        adet: s.n,
        pay: s.ofTotal,
        gecis: s.fromPrev,
        bekleme: s.medianDaysFromPrev,
        onceki: s.prevN,
      })),
      emptyText: "Bu dönemde gelen veli yok.",
    },
    {
      id: "huni-acik",
      title: "Şu an açık veliler",
      columns: [col("asama", "Aşama", "text"), col("adet", "Veli"), col("bekleyen", "7 günden uzun dokunulmamış")],
      rows: open.map((o) => ({ asama: o.label, adet: o.n, bekleyen: o.stale })),
      total: { asama: "Toplam", adet: sum(open.map((o) => o.n)), bekleyen: sum(open.map((o) => o.stale)) },
    },
  ];
  if (cur.length === 0) tables[0].rows = [];

  return {
    total: counts[0],
    steps,
    open,
    openTotal: sum(open.map((o) => o.n)),
    staleTotal: sum(open.map((o) => o.stale)),
    tables,
  };
}

// ---- Kaynaklar ve reklam ----

function buildSources(input: ReportInput, facts: LeadFacts[]): SourcesSection {
  const cur = cohort(facts, input.period);
  const manager = input.manager;

  // Kaynak tablosu.
  const bySource = new Map<SourceKey, LeadFacts[]>();
  for (const f of cur) bySource.set(f.source, [...(bySource.get(f.source) ?? []), f]);
  const sourceRows = [...bySource.entries()]
    .map(([key, list]) => ({
      key,
      kaynak: SOURCE_LABELS[key] ?? key,
      aday: list.length,
      ulasilan: list.filter((f) => f.stage >= 1).length,
      randevu: list.filter((f) => f.stage >= 2).length,
      kayit: list.filter((f) => f.stage >= 5).length,
    }))
    .sort((a, b) => b.aday - a.aday || a.kaynak.localeCompare(b.kaynak, "tr"));
  const sourceTable: ReportTable = {
    id: "kaynaklar",
    title: `Kaynak başına veli · ${input.period.label}`,
    columns: [
      col("kaynak", "Kaynak", "text"),
      col("aday", "Aday"),
      col("ulasilan", "Ulaşılan"),
      col("randevu", "Randevu"),
      col("kayit", "Kayıt"),
      col("oran", "Kayıt oranı", "pct"),
    ],
    rows: sourceRows.map((r) => ({
      kaynak: r.kaynak,
      aday: r.aday,
      ulasilan: r.ulasilan,
      randevu: r.randevu,
      kayit: r.kayit,
      oran: ratio(r.kayit, r.aday),
    })),
    total: {
      kaynak: "Toplam",
      aday: cur.length,
      ulasilan: cur.filter((f) => f.stage >= 1).length,
      randevu: cur.filter((f) => f.stage >= 2).length,
      kayit: cur.filter((f) => f.stage >= 5).length,
      oran: ratio(cur.filter((f) => f.stage >= 5).length, cur.length),
    },
    emptyText: "Bu dönemde gelen veli yok.",
  };

  // Arama kelimesi (yalnız ücretli reklam velileri).
  const paid = cur.filter((f) => f.platform !== null);
  const byTerm = new Map<string, LeadFacts[]>();
  for (const f of paid) {
    const term = normalizeTerm(f.lead.utm_term) ?? "(kelime bilinmiyor)";
    byTerm.set(term, [...(byTerm.get(term) ?? []), f]);
  }
  const keywordTable: ReportTable = {
    id: "kelimeler",
    title: "Arama kelimesi başına veli",
    columns: [col("kelime", "Arama kelimesi", "text"), col("aday", "Aday"), col("randevu", "Randevu"), col("kayit", "Kayıt"), col("oran", "Kayıt oranı", "pct")],
    rows: [...byTerm.entries()]
      .map(([kelime, list]) => {
        const kayit = list.filter((f) => f.stage >= 5).length;
        return { kelime, aday: list.length, randevu: list.filter((f) => f.stage >= 2).length, kayit, oran: ratio(kayit, list.length) };
      })
      .sort((a, b) => b.aday - a.aday || b.kayit - a.kayit || a.kelime.localeCompare(b.kelime, "tr")),
    emptyText: "Bu dönemde reklamdan gelen veli yok; kelime kırılımı reklam velileriyle dolar.",
  };

  const tables: ReportTable[] = [sourceTable];
  const platforms: SourcesSection["platforms"] = [];
  let adNote: string | null = null;
  let hasAdData = paid.length > 0;

  if (manager) {
    const spend = spendIn(manager.spend, input.period);
    hasAdData = hasAdData || spend.length > 0;
    for (const [key, platformLabel] of [
      ["google", "Google"],
      ["meta", "Instagram (Meta)"],
    ] as const) {
      const rows = spend.filter((s) => (s.platform ?? "google") === key);
      const leads = paid.filter((f) => f.platform === key);
      const spendK = spendKurus(rows);
      const kayit = leads.filter((f) => f.stage >= 5).length;
      if (rows.length === 0 && leads.length === 0 && key === "meta") continue;
      platforms.push({
        key,
        label: platformLabel,
        spendKurus: spendK,
        leads: leads.length,
        kayit,
        costPerLead: costPer(spendK, leads.length),
        costPerKayit: costPer(spendK, kayit),
      });
    }
    const platformRows = platforms.map((p) => {
      const rows = spend.filter((s) => (s.platform ?? "google") === p.key);
      const leads = paid.filter((f) => f.platform === p.key);
      return {
        platform: p.label,
        harcama: p.spendKurus,
        tiklama: sum(rows.map((r) => Number(r.clicks) || 0)),
        gosterim: sum(rows.map((r) => Number(r.impressions) || 0)),
        aday: p.leads,
        randevu: leads.filter((f) => f.stage >= 2).length,
        kayit: p.kayit,
        cpl: p.costPerLead,
        cpk: p.costPerKayit,
      };
    });
    const totalSpend = sum(platforms.map((p) => p.spendKurus));
    const totalKayit = sum(platforms.map((p) => p.kayit));
    tables.push({
      id: "reklam-platform",
      title: "Reklam harcaması ve maliyet",
      columns: [
        col("platform", "Platform", "text"),
        col("harcama", "Harcama", "tl"),
        col("tiklama", "Tıklama"),
        col("gosterim", "Gösterim"),
        col("aday", "Aday"),
        col("randevu", "Randevu"),
        col("kayit", "Kayıt"),
        col("cpl", "Aday başı", "tl"),
        col("cpk", "Kayıt başı", "tl"),
      ],
      rows: platformRows,
      total: {
        platform: "Toplam",
        harcama: totalSpend,
        tiklama: sum(platformRows.map((r) => r.tiklama)),
        gosterim: sum(platformRows.map((r) => r.gosterim)),
        aday: paid.length,
        randevu: paid.filter((f) => f.stage >= 2).length,
        kayit: totalKayit,
        cpl: costPer(totalSpend, paid.length),
        cpk: costPer(totalSpend, totalKayit),
      },
      emptyText: "Henüz reklam verisi yok.",
    });

    // Kampanya kırılımı Pazarlama ekranıyla aynı hesapla.
    const reportLeads: ReportLead[] = cur.map((f) => ({
      id: f.lead.id,
      source: f.lead.source as LeadSource,
      gclid: f.lead.gclid,
      utm_campaign: f.lead.utm_campaign,
      status: f.lead.status,
      converted_student_id: f.lead.converted_student_id,
      ad_platform: f.lead.ad_platform,
      is_qualified: f.lead.is_qualified,
    }));
    const apptIds = new Set(cur.filter((f) => f.hasAppt).map((f) => f.lead.id));
    const reportSpend: ReportSpend[] = spend.map((s) => ({
      platform: s.platform,
      campaign_id: s.campaign_id,
      campaign_name: s.campaign_name,
      cost_micros: Number(s.cost_micros) || 0,
    }));
    const marketing = buildMarketingReport(reportLeads, apptIds, reportSpend);
    tables.push({
      id: "kampanyalar",
      title: "Kampanya başına",
      columns: [
        col("kampanya", "Kampanya", "text"),
        col("platform", "Platform", "text"),
        col("harcama", "Harcama", "tl"),
        col("aday", "Aday"),
        col("randevu", "Randevu"),
        col("kayit", "Kayıt"),
        col("cpl", "Aday başı", "tl"),
        col("cpk", "Kayıt başı", "tl"),
      ],
      rows: marketing.rows
        .filter((r) => r.kind === "kampanya")
        .map((r) => ({
          kampanya: r.label,
          platform: r.platform === "meta" ? "Instagram" : "Google",
          harcama: r.spendKurus,
          aday: r.leads,
          randevu: r.randevu,
          kayit: r.kayit,
          cpl: r.costPerLeadKurus,
          cpk: r.costPerKayitKurus,
        })),
      emptyText: "Bu dönemde kampanya harcaması ya da kampanyadan gelen veli yok.",
    });

    if (!hasAdData) {
      adNote = !manager.adsConnected.google && !manager.adsConnected.meta
        ? "Henüz reklam verisi yok. Google Ads bağlantısı kurulmadı; harcama Pazarlama ekranından CSV ile yüklenebilir."
        : manager.activeCampaigns === 0
          ? "Henüz reklam verisi yok. Kampanyalar şu an duraklatılmış; açılınca harcama ve veliler burada görünür."
          : "Henüz reklam verisi yok. Bu dönemde harcama ya da reklamdan gelen veli kaydı bulunmuyor.";
    } else if (manager.activeCampaigns === 0) {
      adNote = "Kampanyalar şu an duraklatılmış; aşağıdaki sayılar dönemin geçmiş günlerine ait.";
    }
  } else if (!hasAdData) {
    adNote = "Bu dönemde reklamdan gelen veli yok.";
  }

  tables.push(keywordTable);

  const bars = sourceRows.map((r) => ({ label: r.kaynak, leads: r.aday, kayit: r.kayit }));
  return { hasAdData, adNote, platforms, bars, tables };
}

// ---- Ön büro ----

function buildFrontOffice(input: ReportInput, facts: LeadFacts[]): FrontOfficeSection {
  const { period, now, hours, viewer } = input;
  const cur = cohort(facts, period);
  const leadsById = new Map(input.leads.map((l) => [l.id, l]));
  const won = wonInRange(input.events, period);
  const scheduled = apptsScheduled(input.appts, period);
  const nowMs = now.getTime();

  const staff = input.profiles.filter((p) => p.is_active && (p.role === "danisman" || p.role === "yonetici"));
  const ids = new Set<string>([...staff.map((p) => p.id), ...cur.map((f) => f.lead.assigned_to ?? "")].filter(Boolean));

  const rowFor = (match: (assignee: string | null) => boolean, name: string): Row => {
    const own = cur.filter((f) => match(f.lead.assigned_to));
    const firstCall = own.map((f) =>
      businessMinutesBetween(new Date(f.lead.created_at), f.lead.first_contact_at ? new Date(f.lead.first_contact_at) : now, hours),
    );
    const matured = own.filter((f) => nowMs - Date.parse(f.lead.created_at) >= 7 * DAY_MS);
    const reached7 = matured.filter((f) => {
      const fc = ms(f.lead.first_contact_at);
      if (fc !== null) return fc - Date.parse(f.lead.created_at) <= 7 * DAY_MS;
      return f.stage >= 1;
    });
    const ownAppts = scheduled.filter((a) => match(leadsById.get(a.lead_id)?.assigned_to ?? null));
    const done = ownAppts.filter((a) => a.outcome === "geldi" || a.outcome === "gelmedi");
    const tasks = input.openTasks.filter((t) => match(t.assigned_to));
    const overdue = tasks.filter((t) => (t.due_at ? Date.parse(t.due_at) < nowMs : t.due_date < istanbulDay(now.toISOString())));
    return {
      kisi: name,
      aday: own.length,
      ilkArama: median(firstCall),
      ulasma7: ratio(reached7.length, matured.length),
      randevu: ratio(own.filter((f) => f.stage >= 2).length, own.length),
      gelme: ratio(done.filter((a) => a.outcome === "geldi").length, done.length),
      kayit: [...won].filter((id) => match(leadsById.get(id)?.assigned_to ?? null)).length,
      acikGorev: tasks.length,
      gecikenGorev: overdue.length,
    };
  };

  const names = new Map(input.profiles.map((p) => [p.id, p.full_name]));
  const ownOnly = viewer.role !== "yonetici";
  const people = [...ids]
    .filter((id) => !ownOnly || id === viewer.id)
    .map((id) => rowFor((a) => a === id, names.get(id) ?? "Bilinmeyen kişi"))
    .filter((r) => ownOnly || (r.aday as number) > 0 || (r.acikGorev as number) > 0 || (r.kayit as number) > 0)
    .sort((a, b) => String(a.kisi).localeCompare(String(b.kisi), "tr"));
  if (!ownOnly) {
    const unassigned = rowFor((a) => a === null, "Atanmamış");
    if ((unassigned.aday as number) > 0) people.push(unassigned);
  }
  const total = rowFor(() => true, "Okul toplamı");

  return {
    ownOnly,
    tables: [
      {
        id: "on-buro",
        title: `Ön büro · ${period.label}`,
        columns: [
          col("kisi", "Kişi", "text"),
          col("aday", "Gelen aday"),
          col("ilkArama", "İlk arama (ortanca)", "minutes"),
          col("ulasma7", "7 günde ulaşma", "pct"),
          col("randevu", "Randevuya dönen", "pct"),
          col("gelme", "Randevuya gelme", "pct"),
          col("kayit", "Kayıt"),
          col("acikGorev", "Açık görev"),
          col("gecikenGorev", "Geciken görev"),
        ],
        rows: people,
        total,
        emptyText: "Bu dönemde atanmış veli yok.",
      },
    ],
  };
}

// ---- Kayıp nedenleri ----

function buildLost(input: ReportInput): LostSection {
  const leadsById = new Map(input.leads.map((l) => [l.id, l]));
  const cur = lostInRange(input.events, input.period, leadsById);
  const prev = lostInRange(input.events, input.period.prev, leadsById);
  const count = (m: Map<string, string>) => {
    const out = new Map<string, number>();
    for (const reason of m.values()) bump(out, reason);
    return out;
  };
  const c = count(cur);
  const p = count(prev);
  const reasons = [...new Set([...c.keys(), ...p.keys()])];
  const bars = reasons
    .map((r) => ({ key: r, label: label(LOST_REASONS, r), n: c.get(r) ?? 0, prevN: p.get(r) ?? 0 }))
    .sort((a, b) => b.n - a.n || b.prevN - a.prevN);
  return {
    total: cur.size,
    prevTotal: prev.size,
    bars: bars.map(({ label: l, n, prevN }) => ({ label: l, n, prevN })),
    tables: [
      {
        id: "kayip",
        title: `Kayıp nedenleri · ${input.period.label}`,
        columns: [col("neden", "Neden", "text"), col("adet", "Veli"), col("pay", "Pay", "pct"), col("onceki", `Önceki dönem (${input.period.prev.label})`)],
        rows: bars.map((b) => ({ neden: b.label, adet: b.n, pay: ratio(b.n, cur.size), onceki: b.prevN })),
        total: { neden: "Toplam", adet: cur.size, pay: cur.size > 0 ? 1 : null, onceki: prev.size },
        emptyText: "Bu dönemde kaybedilen veli yok.",
      },
    ],
  };
}

// ---- Teklifler (yönetici) ----

export function discountOf(o: Pick<RawOffer, "list_price" | "offered_price">): number | null {
  const list = Number(o.list_price);
  const offered = Number(o.offered_price);
  if (!(list > 0) || !Number.isFinite(offered)) return null;
  return 1 - offered / list;
}

function buildOffers(input: ReportInput, pending: number): OffersSection {
  const list = input.offers.filter((o) => isoInRange(o.created_at, input.period));
  const byStatus = new Map<string, number>();
  for (const o of list) bump(byStatus, o.status);
  const names = new Map(input.profiles.map((p) => [p.id, p.full_name]));
  const byCreator = new Map<string, RawOffer[]>();
  for (const o of list) byCreator.set(o.created_by ?? "", [...(byCreator.get(o.created_by ?? "") ?? []), o]);
  const avgDiscount = mean(list.map(discountOf).filter((d): d is number => d !== null));

  return {
    created: list.length,
    approved: byStatus.get("onaylandi") ?? 0,
    avgDiscount,
    pending,
    tables: [
      {
        id: "teklifler",
        title: `Teklifler · ${input.period.label}`,
        columns: [col("durum", "Bugünkü durum", "text"), col("adet", "Teklif")],
        rows: Object.keys(OFFER_STATUSES)
          .map((s) => ({ durum: label(OFFER_STATUSES, s), adet: byStatus.get(s) ?? 0 }))
          .filter((r) => r.adet > 0),
        total: { durum: "Toplam", adet: list.length },
        emptyText: "Bu dönemde teklif verilmedi.",
      },
      {
        id: "teklif-kisi",
        title: "Teklifi veren",
        columns: [col("kisi", "Kişi", "text"), col("adet", "Teklif"), col("onay", "Onaylanan"), col("indirim", "Ortalama indirim", "pct")],
        rows: [...byCreator.entries()]
          .map(([id, offers]) => ({
            kisi: names.get(id) ?? "Bilinmeyen kişi",
            adet: offers.length,
            onay: offers.filter((o) => o.status === "onaylandi").length,
            indirim: mean(offers.map(discountOf).filter((d): d is number => d !== null)),
          }))
          .sort((a, b) => b.adet - a.adet),
        emptyText: "Bu dönemde teklif verilmedi.",
      },
    ],
  };
}

// ---- Öğrenciler ve tahsilat ----

/**
 * Para toplamlarına giren taksitler: yalnız seçili (aktif) sezonun planları. Geçmiş sezonun ödemeleri bu yılın
 * aylık rakamlarına karışmaz. Geciken (v_overdue_installments) bilinçli olarak sezon ayırmaz.
 */
export function seasonInstallments(m: Pick<ManagerInput, "installments" | "season">): RawInstallment[] {
  return m.installments.filter((i) => inSeason(i.season, m.season));
}

function buildStudents(input: ReportInput): StudentsSection {
  const active = input.students.filter((s) => s.status === "aktif");
  const left = input.students.filter((s) => inRange(s.left_date, input.period)).length;
  const capacity = new Map(input.capacities.map((c) => [c.program, c.capacity]));
  const programKeys = [...new Set([...Object.keys(PROGRAMS), ...active.map((s) => s.program ?? "belirsiz")])];
  const programs = programKeys
    .map((program) => ({
      program,
      label: program === "belirsiz" ? "Program girilmemiş" : label(PROGRAMS, program),
      active: active.filter((s) => (s.program ?? "belirsiz") === program).length,
      capacity: capacity.get(program) ?? null,
    }))
    .filter((p) => p.active > 0 || p.capacity !== null);

  const tables: ReportTable[] = [
    {
      id: "programlar",
      title: "Aktif öğrenci ve doluluk (bugün)",
      columns: [col("program", "Program", "text"), col("aktif", "Aktif öğrenci"), col("kontenjan", "Kontenjan"), col("doluluk", "Doluluk", "pct")],
      rows: programs.map((p) => ({
        program: p.label,
        aktif: p.active,
        kontenjan: p.capacity,
        doluluk: p.capacity ? ratio(p.active, p.capacity) : null,
      })),
      total: {
        program: "Toplam",
        aktif: active.length,
        kontenjan: programs.some((p) => p.capacity !== null) ? sum(programs.map((p) => p.capacity ?? 0)) : null,
        doluluk: null,
      },
      emptyText: "Aktif öğrenci yok.",
    },
  ];

  let money: MoneyBlock | null = null;
  const m = input.manager;
  if (m) {
    const range = input.period;
    const live = seasonInstallments(m).filter((i) => i.status !== "iptal");
    const due = live.filter((i) => inRange(i.due_date, range));
    const paid = live.filter((i) => i.status === "odendi" && isoInRange(i.paid_at, range));
    // Tek tanımlar (lib/queries/money): alacak iptal hariç tutar, tahsilat ödenen tutar.
    const expectedKurus = sum(due.map(receivableKurus));
    const collected = sum(paid.map(collectedKurus));
    const dueCollected = sum(due.map(collectedKurus));
    const refundsKurus = sum(m.refunds.filter((r) => inRange(r.refund_date, range)).map((r) => kurus(r.amount)));
    const overdueRows = m.overdue.map((o) => ({ days: Number(o.days_overdue) || 0, amountKurus: kurus(o.amount), item: o.item_type }));
    const aging = agingOf(overdueRows);
    const months = lastMonths(range.to, 12);
    const expByMonth = new Map<string, number>();
    const colByMonth = new Map<string, number>();
    for (const i of live) {
      bump(expByMonth, i.due_date.slice(0, 7), receivableKurus(i));
      if (i.status === "odendi" && i.paid_at) bump(colByMonth, monthOfIso(i.paid_at), collectedKurus(i));
    }
    money = {
      season: m.season,
      expectedKurus,
      collectedKurus: collected,
      dueCollectedRatio: ratio(dueCollected, expectedKurus),
      refundsKurus,
      overdueKurus: sum(overdueRows.map((o) => o.amountKurus)),
      overdueCount: overdueRows.length,
      aging,
      trend: {
        months,
        series: [
          { key: "beklenen", label: "Beklenen", values: months.map((mm) => expByMonth.get(mm) ?? 0), kind: "tl" },
          { key: "tahsil", label: "Tahsil edilen", values: months.map((mm) => colByMonth.get(mm) ?? 0), kind: "tl" },
        ],
      },
    };

    const items = [...new Set([...due, ...paid].map((i) => i.item_type ?? "diger").concat(overdueRows.map((o) => o.item ?? "diger")))];
    tables.push(
      {
        id: "tahsilat",
        title: m.season ? `Tahsilat · ${range.label} · ${m.season} sezonu` : `Tahsilat · ${range.label}`,
        columns: [col("kalem", "Kalem", "text"), col("beklenen", "Vadesi gelen", "tl"), col("tahsil", "Tahsil edilen", "tl"), col("geciken", "Geciken (bugün)", "tl")],
        rows: items
          .map((item) => ({
            kalem: label(ITEM_TYPES, item),
            beklenen: sum(due.filter((i) => (i.item_type ?? "diger") === item).map(receivableKurus)),
            tahsil: sum(paid.filter((i) => (i.item_type ?? "diger") === item).map(collectedKurus)),
            geciken: sum(overdueRows.filter((o) => (o.item ?? "diger") === item).map((o) => o.amountKurus)),
          }))
          .sort((a, b) => b.beklenen - a.beklenen),
        total: { kalem: "Toplam", beklenen: expectedKurus, tahsil: collected, geciken: money.overdueKurus },
        emptyText: "Bu dönemde vadesi gelen ya da ödenen taksit yok.",
      },
      {
        id: "yaslandirma",
        title: "Geciken taksitler (bugün)",
        columns: [col("sure", "Gecikme", "text"), col("adet", "Taksit"), col("tutar", "Tutar", "tl")],
        rows: aging.map((a) => ({ sure: a.label, adet: a.count, tutar: a.amountKurus })),
        total: { sure: "Toplam", adet: overdueRows.length, tutar: money.overdueKurus },
      },
      {
        id: "tahsilat-12-ay",
        title: m.season ? `Son 12 ay: beklenen ve tahsil edilen · ${m.season} sezonu` : "Son 12 ay: beklenen ve tahsil edilen",
        columns: [col("ay", "Ay", "text"), col("beklenen", "Vadesi gelen", "tl"), col("tahsil", "Tahsil edilen", "tl"), col("oran", "Oran", "pct")],
        rows: months.map((mm, i) => {
          const e = money!.trend.series[0].values[i];
          const c = money!.trend.series[1].values[i];
          return { ay: formatMonth(mm), beklenen: e, tahsil: c, oran: ratio(c, e) };
        }),
      },
    );
  }

  return {
    active: active.length,
    left,
    programs,
    money,
    tables,
  };
}

// ---- İçerik (yönetici) ----

function buildContent(input: ReportInput, items: RawContent[]): ContentSection {
  const range = input.period;
  const nowMs = input.now.getTime();
  const names = new Map(input.profiles.map((p) => [p.id, p.full_name]));
  const isLate = (c: RawContent) => (c.status === "taslak" || c.status === "duzeltme") && c.due_at !== null && Date.parse(c.due_at) < nowMs;
  const stats = (list: RawContent[]) => {
    const submitted = list.filter((c) => isoInRange(c.submitted_at, range));
    const withDue = submitted.filter((c) => c.due_at);
    return {
      verilen: list.filter((c) => isoInRange(c.created_at, range)).length,
      teslim: submitted.length,
      onay: list.filter((c) => isoInRange(c.approved_at, range)).length,
      zamaninda: ratio(withDue.filter((c) => Date.parse(c.submitted_at!) <= Date.parse(c.due_at!)).length, withDue.length),
      geciken: list.filter(isLate).length,
    };
  };
  const owners = [...new Set(items.map((c) => c.owner_id))];
  const rows = owners
    .map((id) => ({ kisi: names.get(id) ?? "Öğretmen", ...stats(items.filter((c) => c.owner_id === id)) }))
    .filter((r) => r.verilen + r.teslim + r.onay + r.geciken > 0)
    .sort((a, b) => a.kisi.localeCompare(b.kisi, "tr"));
  const total = stats(items);
  return {
    given: total.verilen,
    submitted: total.teslim,
    approved: total.onay,
    onTime: total.zamaninda,
    late: total.geciken,
    tables: [
      {
        id: "icerik",
        title: `İçerik görevleri · ${range.label}`,
        columns: [
          col("kisi", "Öğretmen", "text"),
          col("verilen", "Verilen"),
          col("teslim", "Teslim edilen"),
          col("onay", "Onaylanan"),
          col("zamaninda", "Zamanında teslim", "pct"),
          col("geciken", "Şu an geciken"),
        ],
        rows,
        total: { kisi: "Toplam", ...total },
        emptyText: "Bu dönemde içerik görevi hareketi yok.",
      },
    ],
  };
}

// ---- Site trafiği (yönetici) ----

function buildSite(input: ReportInput, visits: RawVisit[], facts: LeadFacts[]): SiteSection {
  const current = summarizeVisits(visits.filter((v) => inRange(v.day, input.period)));
  const previous = summarizeVisits(visits.filter((v) => inRange(v.day, input.period.prev)));
  const webLeads = cohort(facts, input.period).filter((f) => !!f.lead.landing_path).length;
  const prevSources = new Map(previous.sources.map((s) => [s.label, s.visits]));
  const allSourceLabels = Object.values(VISIT_SOURCE_LABELS);
  return {
    current,
    previous,
    webLeads,
    conversion: ratio(webLeads, current.visits),
    tables: [
      {
        id: "site-ozet",
        title: `Site trafiği · ${input.period.label}`,
        columns: [col("metrik", "Metrik", "text"), col("deger", "Bu dönem"), col("onceki", `Önceki dönem (${input.period.prev.label})`)],
        rows: [
          { metrik: "Ziyaret", deger: current.visits, onceki: previous.visits },
          { metrik: "Sayfa görüntüleme", deger: current.pageViews, onceki: previous.pageViews },
          { metrik: "Siteden gelen başvuru", deger: webLeads, onceki: cohort(facts, input.period.prev).filter((f) => !!f.lead.landing_path).length },
        ],
      },
      {
        id: "site-kaynak",
        title: "Ziyaretin geldiği yer",
        columns: [col("kaynak", "Kaynak", "text"), col("ziyaret", "Ziyaret"), col("pay", "Pay", "pct"), col("onceki", "Önceki dönem")],
        rows: current.sources
          .map((s) => ({ kaynak: s.label, ziyaret: s.visits, pay: ratio(s.visits, current.visits), onceki: prevSources.get(s.label) ?? 0 }))
          .sort((a, b) => b.ziyaret - a.ziyaret || allSourceLabels.indexOf(a.kaynak) - allSourceLabels.indexOf(b.kaynak)),
        emptyText: "Bu dönemde sayılmış ziyaret yok.",
      },
      {
        id: "site-sayfa",
        title: "En çok bakılan sayfalar",
        columns: [col("sayfa", "Sayfa", "text"), col("goruntuleme", "Görüntüleme"), col("giris", "Siteye bu sayfadan giren")],
        rows: current.pages.map((p) => ({ sayfa: p.path, goruntuleme: p.views, giris: p.entrances })),
        emptyText: "Bu dönemde sayılmış sayfa görüntüleme yok.",
      },
    ],
  };
}

// ---- Otomasyonlar (yönetici) ----

const WA_STATUS: Record<string, string> = {
  gonderildi: "Gönderildi",
  hata: "Hata",
  atlandi: "Atlandı",
  bekliyor: "Sırada",
  gonderiliyor: "Gönderiliyor",
};

function buildAutomation(input: ReportInput, wa: RawWa[], uploads: RawUpload[]): AutomationSection {
  const waIn = wa.filter((w) => isoInRange(w.created_at, input.period));
  const upIn = uploads.filter((u) => isoInRange(u.conversion_at, input.period));
  const waCounts = new Map<string, number>();
  for (const w of waIn) bump(waCounts, w.status);
  const platforms = ["google", "meta"];
  const statuses = Object.keys(CONVERSION_UPLOAD_STATUSES);
  return {
    waSent: waCounts.get("gonderildi") ?? 0,
    waFailed: waCounts.get("hata") ?? 0,
    uploadsSent: upIn.filter((u) => u.status === "gonderildi").length,
    uploadsFailed: upIn.filter((u) => u.status === "hata").length,
    uploadsPending: upIn.filter((u) => u.status === "bekliyor").length,
    tables: [
      {
        id: "whatsapp",
        title: `WhatsApp grup mesajları · ${input.period.label}`,
        columns: [col("durum", "Durum", "text"), col("adet", "Mesaj")],
        rows: Object.keys(WA_STATUS)
          .map((s) => ({ durum: WA_STATUS[s], adet: waCounts.get(s) ?? 0 }))
          .filter((r) => r.adet > 0),
        total: { durum: "Toplam", adet: waIn.length },
        emptyText: "Bu dönemde gruba mesaj düşmedi.",
      },
      {
        id: "donusum-bildirimi",
        title: "Reklam platformuna bildirilen dönüşümler",
        columns: [col("platform", "Platform", "text"), ...statuses.map((s) => col(s, label(CONVERSION_UPLOAD_STATUSES, s)))],
        rows: platforms
          .filter((p) => upIn.some((u) => u.platform === p))
          .map((p) => {
            const list = upIn.filter((u) => u.platform === p);
            return {
              platform: p === "meta" ? "Instagram (Meta)" : "Google",
              ...Object.fromEntries(statuses.map((s) => [s, list.filter((u) => u.status === s).length])),
            };
          }),
        emptyText: "Bu dönemde reklam platformuna bildirilecek dönüşüm olmadı.",
      },
    ],
  };
}

// ---- Giriş noktası ----

export function buildReport(input: ReportInput): Report {
  const ix = buildIndexes(input);
  const facts = input.leads.map((l) => leadFactsOf(l, ix));
  const m = input.manager;
  return {
    period: input.period,
    role: input.viewer.role,
    summary: buildSummary(input, facts),
    funnel: buildFunnel(input, facts),
    sources: buildSources(input, facts),
    frontOffice: buildFrontOffice(input, facts),
    lost: buildLost(input),
    offers: m ? buildOffers(input, m.pendingOffers) : null,
    students: buildStudents(input),
    content: m ? buildContent(input, m.content) : null,
    site: m ? buildSite(input, m.visits, facts) : null,
    automation: m ? buildAutomation(input, m.wa, m.uploads) : null,
  };
}
