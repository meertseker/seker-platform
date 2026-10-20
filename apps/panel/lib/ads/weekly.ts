// Bu hafta: bütçe kapıları, reklam velisi hunisi ve ekip karnesi (saf modül).
// Yalnız reklam velileri (K6). Huni, ilk arama ve randevu toplantı haftasında gelen velilerle; ulaşma bir önceki
// haftanın (7 günü dolmuş) velileriyle; ziyarete gelme takvim haftasının randevularıyla hesaplanır.
// Şimdiki an dışarıdan verilir; modül saat okumaz.
import { LOST_REASONS, type LeadStatus } from "@/lib/constants";
import {
  addDaysToDateString,
  businessMinutesBetween,
  istanbulDateString,
  type BusinessHours,
} from "@/lib/lead-flow/business-hours";
import type { AdSettings } from "./ad-settings";

export type WeeklyLead = {
  id: string;
  createdAt: string;
  firstContactAt: string | null;
  status: LeadStatus;
  lostReason: string | null;
  isQualified: boolean;
  qReached: boolean | null;
  source: string;
  channel: string | null;
  adPlatform: "google" | "meta" | null;
  contentCode: string | null;
  assignedTo: string | null;
  hasAppointment: boolean;
};

export type WeeklyAppt = { leadId: string; scheduledAt: string; outcome: string | null; assignedTo: string | null };

/** Açık görev; `dueAt` yoksa `dueDate` günü bitene kadar gecikmiş sayılmaz. */
export type WeeklyTask = { assignedTo: string; dueDate: string; dueAt: string | null };

/**
 * K6: Google, Instagram reklamı ya da Instagram mesajı/yorumu ile gelen veli. Huni, kapı ve karne bunlarla.
 * K10: `source='reklam'` yalnız Google (gclid) içindir; `ad_platform` boş eski kayıtlar da Google sayılır.
 */
export function isAdSourced(l: Pick<WeeklyLead, "adPlatform" | "source" | "channel">): boolean {
  return l.adPlatform === "google" || l.adPlatform === "meta" || l.source === "reklam" || l.channel === "ig_dm" || l.channel === "ig_yorum";
}

/** K10: maliyete giren (ücretli) reklam velisi. Organik Instagram mesajı girmez. */
export function isPaidAd(l: Pick<WeeklyLead, "adPlatform" | "source">): boolean {
  return l.adPlatform === "google" || l.adPlatform === "meta" || l.source === "reklam";
}

// ---- Hafta (Pazartesi–Pazar, İstanbul) ----

function istanbulMidnightIso(day: string): string {
  return new Date(`${day}T00:00:00+03:00`).toISOString();
}

/** Pazartesi "YYYY-MM-DD" → [from, to) UTC ISO; to bir sonraki Pazartesi 00:00 (dahil değil). */
export function weekRange(weekStart: string): { from: string; to: string } {
  return { from: istanbulMidnightIso(weekStart), to: istanbulMidnightIso(addDaysToDateString(weekStart, 7)) };
}

/** İstanbul gününün içinde bulunduğu haftanın Pazartesisi. */
export function mondayOf(day: string): string {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addDaysToDateString(day, -((dow + 6) % 7));
}

/** Son tamamlanmış haftanın Pazartesisi (bu haftanın Pazartesisinden 7 gün önce). */
export function lastCompletedWeekStart(now: Date): string {
  return addDaysToDateString(mondayOf(istanbulDateString(now)), -7);
}

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

/** "2026-11-02" → "2–8 Kasım"; ay geçişinde "26 Ekim–1 Kasım". */
export function formatWeekLabel(weekStart: string): string {
  const end = addDaysToDateString(weekStart, 6);
  const [, m1, d1] = weekStart.split("-").map(Number);
  const [, m2, d2] = end.split("-").map(Number);
  return m1 === m2 ? `${d1}–${d2} ${MONTHS[m2 - 1]}` : `${d1} ${MONTHS[m1 - 1]}–${d2} ${MONTHS[m2 - 1]}`;
}

// ---- Yardımcılar ----

const NO_DATA = "veri yok";
const DAY_MS = 24 * 60 * 60 * 1000;
const APPT_STATUSES: LeadStatus[] = ["randevu", "gorusme_yapildi", "teklif", "kazanildi"];
const VISITED_STATUSES: LeadStatus[] = ["gorusme_yapildi", "teklif", "kazanildi"];

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function pct(n: number, d: number): number | null {
  return d === 0 ? null : (n / d) * 100;
}

const showMinutes = (v: number | null) => (v === null ? NO_DATA : `${Math.round(v)} dk`);
const showPct = (v: number | null) => (v === null ? NO_DATA : `%${Math.round(v)}`);

/** Ulaşıldı: nitelik sorusunda "ulaşıldı" işaretli ya da "ulaşılamadı" dışında yeni'den ilerlemiş. */
function isReached(l: WeeklyLead): boolean {
  return l.qReached === true || (l.status !== "yeni" && l.lostReason !== "ulasilamadi");
}

function hasAppt(l: WeeklyLead): boolean {
  return l.hasAppointment || APPT_STATUSES.includes(l.status);
}

/**
 * İlk arama bekleyişi (mesai dakikası). Aranmamış veli şimdiye kadar beklediği süreyle (alt sınır) girer:
 * hiç aranmayan veli ortancayı iyi göstermesin.
 */
function firstCallMinutes(leads: WeeklyLead[], now: Date, hours: BusinessHours): number[] {
  return leads.map((l) =>
    businessMinutesBetween(new Date(l.createdAt), l.firstContactAt ? new Date(l.firstContactAt) : now, hours),
  );
}

function reachRate(leads: WeeklyLead[]): number | null {
  return pct(leads.filter(isReached).length, leads.length);
}

function apptRate(leads: WeeklyLead[]): number | null {
  const qualified = leads.filter((l) => l.isQualified);
  return pct(qualified.filter(hasAppt).length, qualified.length);
}

function isTaskOverdue(t: WeeklyTask, now: Date): boolean {
  return t.dueAt ? Date.parse(t.dueAt) < now.getTime() : t.dueDate < istanbulDateString(now);
}

// ---- Kapılar ----

export type Gate = {
  key: "firstCall" | "reach" | "appt" | "show";
  label: string;
  value: number | null;
  display: string;
  target: string;
  tone: "green" | "red" | "none";
};

/** Yükleyicinin ek verisi (`computeWeekGates` hepsini geçirir). */
export type GateInputs = {
  /** Toplantı haftasının Pazartesisi: ziyarete gelme bu takvim haftasıyla süzülür, ulaşma hedef satırı önceki haftayı adlandırır. */
  weekStart?: string;
  /** Bir önceki haftada gelen reklam velileri (ulaşma kapısı). */
  reachLeads?: WeeklyLead[];
  /** Takvim haftasına düşen, reklam velilerinin randevuları (ziyarete gelme kapısı). */
  weekAppts?: WeeklyAppt[];
};

function tone(value: number | null, ok: (v: number) => boolean): Gate["tone"] {
  if (value === null) return "none";
  return ok(value) ? "green" : "red";
}

/**
 * Dört bütçe kapısı. Payda 0 ise "veri yok" (gri), kırmızı sayılmaz.
 * - İlk arama: `leads` (toplantı haftası) mesai dakikası ortancası; aranmamış veli şimdiye kadarki beklemesiyle.
 * - Ulaşma: `inputs.reachLeads` (önceki hafta, hepsi 7 günü doldurmuş). Verilmezse `leads` içinden 7 günü dolanlar.
 * - Randevu: `leads` içindeki nitelikliler.
 * - Ziyarete gelme: `inputs.weekAppts` (verilmezse `leads`'in `appts`'ı); `weekStart` varsa takvim haftasıyla süzülür.
 *   geldi / (geldi + gelmedi). Saati geçmiş, sonucu girilmemiş randevular hedef satırında sayılır.
 */
export function computeGates(
  leads: WeeklyLead[],
  appts: WeeklyAppt[],
  now: Date,
  hours: BusinessHours,
  s: AdSettings,
  inputs: GateInputs = {},
): Gate[] {
  const ad = leads.filter(isAdSourced);
  const g = s.gates;

  const firstCall = median(firstCallMinutes(ad, now, hours));

  const reachCohort = inputs.reachLeads
    ? inputs.reachLeads.filter(isAdSourced)
    : ad.filter((l) => now.getTime() - Date.parse(l.createdAt) >= 7 * DAY_MS);
  const reach = reachRate(reachCohort);
  const reachWeek = inputs.weekStart ? ` · ${formatWeekLabel(addDaysToDateString(inputs.weekStart, -7))} haftası` : "";

  const appt = apptRate(ad);

  const adIds = new Set(ad.map((l) => l.id));
  let showAppts = inputs.weekAppts ?? appts.filter((a) => adIds.has(a.leadId));
  if (inputs.weekStart) {
    const range = weekRange(inputs.weekStart);
    const [from, to] = [Date.parse(range.from), Date.parse(range.to)];
    showAppts = showAppts.filter((a) => {
      const at = Date.parse(a.scheduledAt);
      return at >= from && at < to;
    });
  }
  const done = showAppts.filter((a) => a.outcome === "geldi" || a.outcome === "gelmedi");
  const show = pct(done.filter((a) => a.outcome === "geldi").length, done.length);
  const unresolvedPast = showAppts.filter(
    (a) => (a.outcome === null || a.outcome === "bekliyor") && Date.parse(a.scheduledAt) < now.getTime(),
  ).length;

  return [
    {
      key: "firstCall",
      label: "İlk arama süresi",
      value: firstCall,
      display: showMinutes(firstCall),
      target: `hedef en fazla ${g.firstCallMin} dk (ideal 5)`,
      tone: tone(firstCall, (v) => v <= g.firstCallMin),
    },
    {
      key: "reach",
      label: "Ulaşılan veli",
      value: reach,
      display: showPct(reach),
      target: `hedef en az %${g.reachPct}${reachWeek}`,
      tone: tone(reach, (v) => v >= g.reachPct),
    },
    {
      key: "appt",
      label: "Randevu verilen",
      value: appt,
      display: showPct(appt),
      target: `hedef en az %${g.apptPct} · nitelikli velilerden`,
      tone: tone(appt, (v) => v >= g.apptPct),
    },
    {
      key: "show",
      label: "Ziyarete gelen",
      value: show,
      display: showPct(show),
      target: `hedef en az %${g.showPct}${unresolvedPast > 0 ? ` · sonucu girilmemiş ${unresolvedPast}` : ""}`,
      tone: tone(show, (v) => v >= g.showPct),
    },
  ];
}

/** Yükleyici çıktısıyla kapılar (önerilen çağrı): haftayı, ulaşma kohortunu ve takvim haftası randevularını geçirir. */
export function computeWeekGates(
  data: { weekStart: string; leads: WeeklyLead[]; appts: WeeklyAppt[]; reachLeads: WeeklyLead[]; weekAppts: WeeklyAppt[] },
  now: Date,
  hours: BusinessHours,
  s: AdSettings,
): Gate[] {
  return computeGates(data.leads, data.appts, now, hours, s, {
    weekStart: data.weekStart,
    reachLeads: data.reachLeads,
    weekAppts: data.weekAppts,
  });
}

export function anyGateRed(gates: Gate[]): { red: boolean; labels: string[] } {
  const labels = gates.filter((g) => g.tone === "red").map((g) => g.label);
  return { red: labels.length > 0, labels };
}

// ---- Huni ----

export type FunnelStep = { label: string; n: number; dropPct: number | null; worst: boolean };

export type Funnel = {
  steps: FunnelStep[];
  byPlatform: { google: number; meta: number; organik: number };
  lostReasons: { reason: string; label: string; n: number }[];
};

const FUNNEL_LABELS = ["Gelen veli", "Ulaşılan", "Nitelikli", "Randevu", "Ziyarete gelen", "Kayıt"];

/**
 * Haftada gelen reklam velilerinin bugünkü aşaması. Her veli ulaştığı en ileri aşamaya yerleşir ve önceki tüm
 * adımlarda da sayılır (adım = "bu aşamada ya da ilerisinde"), böylece adımlar hiç artmaz. En büyük oransal düşüş `worst`.
 */
export function computeFunnel(leads: WeeklyLead[], appts: WeeklyAppt[]): Funnel {
  const ad = leads.filter(isAdSourced);
  const visitedIds = new Set(appts.filter((a) => a.outcome === "geldi").map((a) => a.leadId));

  const stageOf = (l: WeeklyLead): number => {
    if (l.status === "kazanildi") return 5;
    if (visitedIds.has(l.id) || VISITED_STATUSES.includes(l.status)) return 4;
    if (hasAppt(l)) return 3;
    if (l.isQualified) return 2;
    if (isReached(l)) return 1;
    return 0;
  };
  const stages = ad.map(stageOf);
  const counts = FUNNEL_LABELS.map((_, i) => stages.filter((st) => st >= i).length);

  const rates = counts.map((n, i) => (i === 0 || counts[i - 1] === 0 ? null : (counts[i - 1] - n) / counts[i - 1]));
  let worstIdx = -1;
  rates.forEach((r, i) => {
    if (r !== null && r > 0 && (worstIdx === -1 || r > (rates[worstIdx] as number))) worstIdx = i;
  });
  const steps = FUNNEL_LABELS.map((label, i) => ({
    label,
    n: counts[i],
    dropPct: rates[i] === null ? null : Math.round((rates[i] as number) * 100),
    worst: i === worstIdx,
  }));

  const byPlatform = { google: 0, meta: 0, organik: 0 };
  for (const l of ad) {
    if (l.adPlatform === "meta") byPlatform.meta += 1;
    // K10: source='reklam' yalnız Google (gclid) için kalır; ad_platform boş eski kayıtlar da Google sayılır.
    else if (l.adPlatform === "google" || l.source === "reklam") byPlatform.google += 1;
    else byPlatform.organik += 1;
  }

  const lost = new Map<string, number>();
  for (const l of ad) {
    if (l.status === "kaybedildi" && l.lostReason) lost.set(l.lostReason, (lost.get(l.lostReason) ?? 0) + 1);
  }
  const lostReasons = [...lost.entries()]
    .map(([reason, n]) => ({ reason, label: LOST_REASONS[reason as keyof typeof LOST_REASONS] ?? reason, n }))
    .sort((a, b) => b.n - a.n);

  return { steps, byPlatform, lostReasons };
}

// ---- Ekip karnesi ----

export type ScorecardRow = {
  userId: string;
  name: string;
  firstCallMedian: string;
  reachPct: string;
  apptPct: string;
  openTasks: number;
  overdueTasks: number;
  flags: { apptRed: boolean; tasksWarn: boolean };
};

export type ScorecardInput = {
  /** Toplantı haftasında gelen veliler: ilk arama ve randevu. */
  leads: WeeklyLead[];
  /** Bir önceki haftada gelen veliler: ulaşma (kapıyla aynı kohort). */
  reachLeads: WeeklyLead[];
  /** Kişilerin açık görevleri. */
  tasks: WeeklyTask[];
  names: Map<string, string>;
  hours: BusinessHours;
  now: Date;
  gates: AdSettings["gates"];
};

/**
 * Kişi başına (veli `assignedTo`) ortanca ilk arama, ulaşma, nitelikliden randevu ve açık görev; yalnız reklam velileri.
 * Randevu oranı kapı eşiğinin altındaysa kırmızı; süresi geçmiş açık görevi olan turuncu.
 */
export function computeScorecard(input: ScorecardInput): ScorecardRow[] {
  const { hours, now, gates } = input;
  const group = (leads: WeeklyLead[]) => {
    const map = new Map<string, WeeklyLead[]>();
    for (const l of leads) {
      if (!l.assignedTo || !isAdSourced(l)) continue;
      map.set(l.assignedTo, [...(map.get(l.assignedTo) ?? []), l]);
    }
    return map;
  };
  const week = group(input.leads);
  const prev = group(input.reachLeads);
  const userIds = [...new Set([...week.keys(), ...prev.keys()])];

  return userIds
    .map((userId) => {
      const own = week.get(userId) ?? [];
      const appt = apptRate(own);
      const tasks = input.tasks.filter((t) => t.assignedTo === userId);
      const overdueTasks = tasks.filter((t) => isTaskOverdue(t, now)).length;
      return {
        userId,
        name: input.names.get(userId) ?? "Bilinmeyen kişi",
        firstCallMedian: showMinutes(median(firstCallMinutes(own, now, hours))),
        reachPct: showPct(reachRate(prev.get(userId) ?? [])),
        apptPct: showPct(appt),
        openTasks: tasks.length,
        overdueTasks,
        flags: { apptRed: appt !== null && appt < gates.apptPct, tasksWarn: overdueTasks > 0 },
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
}
