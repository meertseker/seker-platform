import type { Metadata } from "next";
import Link from "next/link";
import { TaskAssignBoard, type AssignSlot } from "@/components/task-assign-board";
import { requireRole } from "@/lib/auth";
import { formatWeekLabel } from "@/lib/ads/weekly";
import { aiEnabled, readWeekSuggestions } from "@/lib/ai/gorev-uret";
import { loadTeachers } from "@/lib/content/board";
import { allowedTaskWeeks, defaultTaskDue, SLOT_ORDER, SLOTS, slotOfCode } from "@/lib/content/slots";
import { createServerSupabase } from "@/lib/supabase/server";
import { requestNow } from "@/lib/time";

export const metadata: Metadata = { title: "Görev ver" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Görev ver: danışman ya da yönetici haftanın dört yuvasına öğretmen görevi açar. AI yalnız konu önerir.
 * Bu ekran para ve reklam sayısı göstermez (danışman da açar).
 */
export default async function GorevVerPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole("yonetici", "danisman");
  const params = await searchParams;
  const now = await requestNow();
  const [current, next] = allowedTaskWeeks(now);
  const week = params.hafta === next ? next : current;

  const supabase = await createServerSupabase();
  const [teachers, taskRows, suggestions] = await Promise.all([
    loadTeachers(supabase),
    supabase.from("content_items").select("code, kind, owner_id, topic").eq("week_start", week),
    readWeekSuggestions(supabase, week),
  ]);

  const names = new Map(teachers.map((t) => [t.id, t.name]));
  const rows = (taskRows.data ?? []) as { code: string; kind: string; owner_id: string; topic: string }[];
  const slots: AssignSlot[] = SLOT_ORDER.map((slot) => {
    const row = rows.find((r) => slotOfCode(r.code) === slot && SLOTS[slot].kind === r.kind);
    return {
      slot,
      label: SLOTS[slot].label,
      existing: row ? { code: row.code, owner: names.get(row.owner_id) ?? "Öğretmen", topic: row.topic } : null,
    };
  });

  const tabs = [
    { week: current, label: `Bu hafta · ${formatWeekLabel(current)}`, href: "/reklam/gorev-ver" },
    { week: next, label: `Gelecek hafta · ${formatWeekLabel(next)}`, href: `/reklam/gorev-ver?hafta=${next}` },
  ];

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1180px] flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="text-[32px] font-bold tracking-tight text-foreground">Görev ver</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Her yuva için bir öneri seçin ya da kendi konunuzu yazın, öğretmeni seçip gönderin. Öneriler yalnız konudur; videoyu ve
          yazıyı öğretmen hazırlar. Görev öğretmenin Görevim ekranına düşer ve bildirim gider.
        </p>
        <nav aria-label="Hafta" className="flex flex-wrap gap-1.5 text-[13px] font-semibold">
          {tabs.map((t) => (
            <Link
              key={t.week}
              href={t.href}
              aria-current={t.week === week ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full px-3 ${
                t.week === week ? "bg-foreground text-surface" : "border border-border bg-surface text-foreground hover:bg-muted"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      <TaskAssignBoard
        key={week}
        weekStart={week}
        teachers={teachers}
        slots={slots}
        initialSuggestions={suggestions}
        aiEnabled={aiEnabled()}
        defaultDue={defaultTaskDue(week, now)}
      />
    </div>
  );
}
