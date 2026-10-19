// Veli kartındaki takip sırası (saf modül). Adım 1 ilk aramadır; 2..6 takip:<id>:n görevlerinden gelir
// (followups.ts), 7. satır kapanıştır. Henüz açılmamış adımlar genel tarifle "sırada" gösterilir.
import { formatDayTime } from "./business-hours";
import { FOLLOWUP_STEPS } from "./followups";

export type TimelineTask = { ruleKey: string; status: string; dueAt: string | null; createdAt: string };

export type TimelineInput = {
  leadId: string;
  status: string;
  lostReason: string | null;
  firstContactAt: string | null;
  /** Son başarılı ulaşma (randevu / geri ara kaydı); sonrası yeni sıra sayılır. */
  lastReachAt: string | null;
  tasks: TimelineTask[];
};

export type TimelineStep = { n: number; title: string; sub: string; state: "done" | "now" | "next" };

export type FollowupTimeline =
  | {
      state: "active";
      steps: TimelineStep[];
      /** Şimdiki takip görevinin saati; gelmeden "Açmadı" kapalıdır. İlk aramada null. */
      nextAttemptAt: string | null;
    }
  | { state: "closed"; steps: TimelineStep[]; kontenjanPlanned: boolean }
  | { state: "stopped" }
  | { state: "hidden" };

const LAST_STEP = FOLLOWUP_STEPS + 1;

const DEFS: [title: string, sub: string][] = [
  ["1. arama", "İlk arama"],
  ["2. deneme", "3 saat sonra"],
  ["3. deneme", "Ertesi gün 10:00"],
  ["4. deneme", "Ertesi gün 18:30 · akşam"],
  ["5. deneme + WhatsApp", "3. gün 10:00 · iki ziyaret saati önerilir"],
  ["Son deneme", "7. gün 10:00"],
  ["Kapanır: Ulaşılamadı", "Kayıp nedeni kendiliğinden yazılır"],
];

const REACHED_STATUSES = ["randevu", "gorusme_yapildi", "teklif", "kazanildi"];

function stepOf(ruleKey: string): number {
  const n = Number(ruleKey.split(":").pop());
  return Number.isInteger(n) && n > 1 && n <= LAST_STEP ? n : 0;
}

export function buildFollowupTimeline(input: TimelineInput): FollowupTimeline {
  const prefix = `takip:${input.leadId}:`;
  const since = input.lastReachAt ? Date.parse(input.lastReachAt) : -Infinity;
  const tasks = input.tasks
    .filter((t) => t.ruleKey.startsWith(prefix) && stepOf(t.ruleKey) > 0 && Date.parse(t.createdAt) > since)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const maxStep = tasks.reduce((m, t) => Math.max(m, stepOf(t.ruleKey)), 0);
  const firstAttemptAt = input.lastReachAt
    ? (tasks[0]?.createdAt ?? null)
    : (input.firstContactAt ?? tasks[0]?.createdAt ?? null);

  const build = (current: number): TimelineStep[] =>
    DEFS.map(([title, generic], i) => {
      const n = i + 1;
      const task = n > 1 && n <= LAST_STEP ? tasks.findLast((t) => stepOf(t.ruleKey) === n) : undefined;
      const at = n === 1 ? firstAttemptAt : (task?.dueAt ?? null);
      if (n < current) {
        const sub = n === DEFS.length ? generic : at ? `${formatDayTime(new Date(at))} · açmadı` : "Açmadı";
        return { n, title, sub, state: "done" };
      }
      if (n === current) {
        return { n, title: `${title} · şimdi`, sub: at ? formatDayTime(new Date(at)) : generic, state: "now" };
      }
      return { n, title, sub: generic, state: "next" };
    });

  if (input.status === "kaybedildi") {
    const closedBySequence =
      input.lostReason === "ulasilamadi" && maxStep === LAST_STEP && !tasks.some((t) => t.status === "acik");
    if (!closedBySequence) return { state: "hidden" };
    return {
      state: "closed",
      steps: build(DEFS.length + 1),
      // Gelecek zaman cümlesi yalnız görev hâlâ açıkken doğrudur.
      kontenjanPlanned: input.tasks.some(
        (t) => t.ruleKey === `kontenjan:${input.leadId}` && t.status === "acik",
      ),
    };
  }
  if (input.status === "beklemede") return { state: "hidden" };
  if (REACHED_STATUSES.includes(input.status)) return { state: "stopped" };
  if (maxStep > 0) {
    const current = tasks.findLast((t) => stepOf(t.ruleKey) === maxStep);
    return { state: "active", steps: build(maxStep), nextAttemptAt: current?.dueAt ?? null };
  }
  if (input.lastReachAt || input.status === "ulasildi") return { state: "stopped" };
  if (!input.firstContactAt) return { state: "active", steps: build(1), nextAttemptAt: null };
  return { state: "hidden" };
}
