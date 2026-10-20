// Bu hafta: bütçe kapıları, reklam velisi hunisi ve ekip karnesi (saf modül).
// Hesaplar haftada gelen reklam velileri (K6) ve onların randevuları üzerinden yapılır.
// Şimdiki an dışarıdan verilir; modül saat okumaz.
import { LOST_REASONS, type LeadStatus } from "@/lib/constants";
import {
  addDaysToDateString,
  businessMinutesBetween,
  istanbulDateString,
  type BusinessHours,
} from "@/lib/lead-flow/business-hours";
import { DEFAULT_AD_SETTINGS, type AdSettings } from "./ad-settings";

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

/** K6: Google, Instagram reklamı ya da Instagram mesajı/yorumu ile gelen veli. Huni, kapı ve karne bunlarla. */
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

// ---- Yardımcılar ----

const DAY_MS = 24 * 60 * 60 * 1000;
const NO_DATA = "veri yok";
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

/** Ulaşma kapısına girer mi: gelişinden 7 gün geçti ya da geldiği hafta bitti. `now` yoksa hepsi girer. */
function reachEligible(l: WeeklyLead, now: Date | undefined): boolean {
  if (!now) return true;
  const created = new Date(l.createdAt);
  const weekEnd = Date.parse(weekRange(mondayOf(istanbulDateString(created))).to);
  return now.getTime() - created.getTime() >= 7 * DAY_MS || now.getTime() >= weekEnd;
}

function firstCallMinutes(leads: WeeklyLead[], hours: BusinessHours): number[] {
  return leads
    .filter((l) => l.firstContactAt)
    .map((l) => businessMinutesBetween(new Date(l.createdAt), new Date(l.firstContactAt as string), hours));
}

function reachRate(leads: WeeklyLead[], now: Date | undefined): number | null {
  const eligible = leads.filter((l) => reachEligible(l, now));
  return pct(eligible.filter(isReached).length, eligible.length);
}

function apptRate(leads: WeeklyLead[]): number | null {
  const qualified = leads.filter((l) => l.isQualified);
  return pct(qualified.filter(hasAppt).length, qualified.length);
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

function tone(value: number | null, ok: (v: number) => boolean): Gate["tone"] {
  if (value === null) return "none";
  return ok(value) ? "green" : "red";
}

/**
 * Dört bütçe kapısı. Payda 0 ise "veri yok" (gri), kırmızı sayılmaz.
 * Randevuya gelme: verilen randevulardan sonucu "geldi" olanların geldi + gelmedi içindeki payı.
 */
export function computeGates(leads: WeeklyLead[], appts: WeeklyAppt[], now: Date, hours: BusinessHours, s: AdSettings): Gate[] {
  const ad = leads.filter(isAdSourced);
  const adIds = new Set(ad.map((l) => l.id));
  const g = s.gates;

  const firstCall = median(firstCallMinutes(ad, hours));
  const reach = reachRate(ad, now);
  const appt = apptRate(ad);
  const done = appts.filter((a) => adIds.has(a.leadId) && (a.outcome === "geldi" || a.outcome === "gelmedi"));
  const show = pct(done.filter((a) => a.outcome === "geldi").length, done.length);

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
      target: `hedef en az %${g.reachPct}`,
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
      target: `hedef en az %${g.showPct}`,
      tone: tone(show, (v) => v >= g.showPct),
    },
  ];
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

/** Haftada gelen reklam velilerinin bugünkü aşaması; en büyük oransal düşüş `worst`. */
export function computeFunnel(leads: WeeklyLead[], appts: WeeklyAppt[]): Funnel {
  const ad = leads.filter(isAdSourced);
  const visitedIds = new Set(appts.filter((a) => a.outcome === "geldi").map((a) => a.leadId));

  const counts: [string, number][] = [
    ["Gelen veli", ad.length],
    ["Ulaşılan", ad.filter(isReached).length],
    ["Nitelikli", ad.filter((l) => l.isQualified).length],
    ["Randevu", ad.filter(hasAppt).length],
    ["Ziyarete gelen", ad.filter((l) => visitedIds.has(l.id) || VISITED_STATUSES.includes(l.status)).length],
    ["Kayıt", ad.filter((l) => l.status === "kazanildi").length],
  ];

  const rates = counts.map(([, n], i) => {
    const prev = i === 0 ? 0 : counts[i - 1][1];
    return i === 0 || prev === 0 ? null : Math.max(0, prev - n) / prev;
  });
  let worstIdx = -1;
  rates.forEach((r, i) => {
    if (r !== null && r > 0 && (worstIdx === -1 || r > (rates[worstIdx] as number))) worstIdx = i;
  });
  const steps = counts.map(([label, n], i) => ({
    label,
    n,
    dropPct: rates[i] === null ? null : Math.round((rates[i] as number) * 100),
    worst: i === worstIdx,
  }));

  const byPlatform = { google: 0, meta: 0, organik: 0 };
  for (const l of ad) {
    if (l.adPlatform === "meta") byPlatform.meta += 1;
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
  flags: { apptRed: boolean; tasksWarn: boolean };
};

/**
 * Kişi başına (veli `assignedTo`) ortanca ilk arama, ulaşma, nitelikliden randevu ve açık görev.
 * `opts.now` verilirse ulaşma kapıdaki 7 gün kuralıyla, verilmezse tüm velilerle hesaplanır.
 * Randevu oranı kapı eşiğinin altındaysa kırmızı; açık görevi olan turuncu.
 */
export function computeScorecard(
  leads: WeeklyLead[],
  appts: WeeklyAppt[],
  openTasksByUser: Map<string, number>,
  names: Map<string, string>,
  hours: BusinessHours,
  opts: { now?: Date; gates?: AdSettings["gates"] } = {},
): ScorecardRow[] {
  void appts; // Karne randevu oranını velinin randevu durumundan alır.
  const gates = opts.gates ?? DEFAULT_AD_SETTINGS.gates;
  const byUser = new Map<string, WeeklyLead[]>();
  for (const l of leads) {
    if (!l.assignedTo || !isAdSourced(l)) continue;
    const list = byUser.get(l.assignedTo) ?? [];
    list.push(l);
    byUser.set(l.assignedTo, list);
  }

  return [...byUser.entries()]
    .map(([userId, own]) => {
      const appt = apptRate(own);
      const openTasks = openTasksByUser.get(userId) ?? 0;
      return {
        userId,
        name: names.get(userId) ?? "Bilinmeyen kişi",
        firstCallMedian: showMinutes(median(firstCallMinutes(own, hours))),
        reachPct: showPct(reachRate(own, opts.now)),
        apptPct: showPct(appt),
        openTasks,
        flags: { apptRed: appt !== null && appt < gates.apptPct, tasksWarn: openTasks > 0 },
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
}
