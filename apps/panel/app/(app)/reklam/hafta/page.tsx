import type { Metadata } from "next";
import Link from "next/link";
import { refreshWeekRecommendations } from "@/actions/recommendations";
import type { WeeklySlot } from "@/actions/weekly";
import { WeeklyFunnel } from "@/components/weekly-funnel";
import { WeeklyGates } from "@/components/weekly-gates";
import { WeeklyPlan, type PlanSlot } from "@/components/weekly-plan";
import { WeeklyRecommendations } from "@/components/weekly-recommendations";
import { WeeklyTeam } from "@/components/weekly-team";
import { requireRole } from "@/lib/auth";
import { getAdSettings } from "@/lib/ads/ad-settings";
import type { RecommendationRow } from "@/lib/ads/recommendations";
import {
  anyGateRed,
  computeFunnel,
  computeScorecard,
  computeWeekGates,
  formatWeekLabel,
  lastCompletedWeekStart,
  mondayOf,
} from "@/lib/ads/weekly";
import { loadTeachers } from "@/lib/content/board";
import { addDaysToDateString, formatDayTime } from "@/lib/lead-flow/business-hours";
import { getLeadFlowSettings } from "@/lib/lead-flow/settings";
import { loadWeekRecommendations } from "@/lib/queries/recommendations";
import { loadWeeklyData } from "@/lib/queries/weekly";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bu hafta" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const STEPS = [
  { href: "#kapilar", label: "1 Kapılar" },
  { href: "#kararlar", label: "2 Kararlar" },
  { href: "#huni", label: "3 Veliler nerede kaldı" },
  { href: "#ekip", label: "4 Ekip" },
  { href: "#gorevler", label: "5 Bu haftanın görevleri" },
];

const SLOTS: { slot: WeeklySlot; label: string; prefix: "R" | "S"; letter: string }[] = [
  { slot: "reels_a", label: "Reels A", prefix: "R", letter: "A" },
  { slot: "reels_b", label: "Reels B", prefix: "R", letter: "B" },
  { slot: "sayfa_google", label: "Sayfa · Google", prefix: "S", letter: "G" },
  { slot: "sayfa_instagram", label: "Sayfa · Instagram", prefix: "S", letter: "I" },
];

/** `?hafta=YYYY-MM-DD` geçerli bir Pazartesi ve en geç son tamamlanmış haftaysa o; değilse son tamamlanmış hafta. */
function pickWeek(raw: string | string[] | undefined, latest: string): string {
  const v = typeof raw === "string" ? raw : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) return latest;
  return mondayOf(v) === v && v <= latest ? v : latest;
}

export default async function BuHaftaPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole("yonetici");
  const params = await searchParams;
  const now = new Date();
  const latest = lastCompletedWeekStart(now);
  const weekStart = pickWeek(params.hafta, latest);
  const taskWeek = addDaysToDateString(weekStart, 7);

  // Öneriler kurallardan tazelenir (yalnız son tamamlanmış hafta); hata ekranı bozmaz.
  await refreshWeekRecommendations(weekStart);

  const supabase = await createServerSupabase();
  const [data, settings, { hours }, teachers, recs, taskRows, review] = await Promise.all([
    loadWeeklyData(supabase, weekStart),
    getAdSettings(supabase),
    getLeadFlowSettings(supabase),
    loadTeachers(supabase),
    loadWeekRecommendations(supabase, weekStart).catch((e: unknown): RecommendationRow[] => {
      console.error("[hafta] öneriler okunamadı:", e instanceof Error ? e.message : "bilinmeyen");
      return [];
    }),
    supabase.from("content_items").select("code, kind, owner_id").eq("week_start", taskWeek),
    supabase.from("weekly_reviews").select("topic, saved_at").eq("week_start", weekStart).maybeSingle(),
  ]);

  const gates = computeWeekGates(data, now, hours, settings);
  const red = anyGateRed(gates);
  const funnel = computeFunnel(data.leads, data.appts);
  const team = computeScorecard({
    leads: data.leads,
    reachLeads: data.reachLeads,
    tasks: data.openTasks,
    names: data.names,
    hours,
    now,
    gates: settings.gates,
  });

  const teacherNames = new Map(teachers.map((t) => [t.id, t.name]));
  const existing = (taskRows.data ?? []) as { code: string; kind: string; owner_id: string }[];
  const slots: PlanSlot[] = SLOTS.map((s) => {
    const row = existing.find(
      (r) => r.code.startsWith(`${s.prefix}-`) && r.code.endsWith(`-${s.letter}`) && r.kind === (s.prefix === "R" ? "reels" : "sayfa"),
    );
    return {
      slot: s.slot,
      label: s.label,
      existing: row ? { code: row.code, owner: teacherNames.get(row.owner_id) ?? "Öğretmen" } : null,
    };
  });

  const saved = review.data as { topic: string | null; saved_at: string } | null;
  const savedNote = saved ? `Toplantı kaydedildi · ${formatDayTime(new Date(saved.saved_at))}` : null;
  const prevWeek = addDaysToDateString(weekStart, -7);
  const nextWeek = taskWeek <= latest ? taskWeek : null;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1180px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-[13px] text-muted-foreground">Pazartesi toplantısı · {formatWeekLabel(weekStart)}</p>
          <h1 className="text-[32px] font-bold tracking-tight text-foreground">Bu hafta</h1>
          <nav aria-label="Hafta" className="flex flex-wrap gap-x-4 text-sm font-medium">
            <Link href={`/reklam/hafta?hafta=${prevWeek}`} className="inline-flex min-h-11 items-center text-primary hover:text-primary-strong">
              ‹ {formatWeekLabel(prevWeek)}
            </Link>
            {nextWeek ? (
              <Link
                href={nextWeek === latest ? "/reklam/hafta" : `/reklam/hafta?hafta=${nextWeek}`}
                className="inline-flex min-h-11 items-center text-primary hover:text-primary-strong"
              >
                {formatWeekLabel(nextWeek)} ›
              </Link>
            ) : null}
          </nav>
        </div>
        <nav aria-label="Toplantı adımları" className="flex flex-wrap gap-1.5 text-[13px] font-semibold">
          {STEPS.map((s, i) => (
            <a
              key={s.href}
              href={s.href}
              className={`inline-flex min-h-11 items-center rounded-full px-3 ${
                i === 0 ? "bg-foreground text-surface" : "border border-border bg-surface text-foreground hover:bg-muted"
              }`}
            >
              {s.label}
            </a>
          ))}
        </nav>
      </header>

      <WeeklyGates gates={gates} topLost={funnel.lostReasons[0] ?? null} />
      <WeeklyRecommendations recs={recs} redGates={red.labels} readOnly={weekStart !== latest} />
      <WeeklyFunnel funnel={funnel} />
      <WeeklyTeam rows={team} />
      <WeeklyPlan
        weekStart={weekStart}
        taskWeekLabel={formatWeekLabel(taskWeek)}
        defaultDue={`${addDaysToDateString(taskWeek, 3)}T17:00`}
        teachers={teachers}
        slots={slots}
        initialTopic={saved?.topic ?? ""}
        savedNote={savedNote}
      />
    </div>
  );
}
