import type { Metadata } from "next";
import { ContentTaskForm, type FormTask } from "@/components/content-task-form";
import { requireRole } from "@/lib/auth";
import { getContentRules } from "@/lib/content/settings";
import { videoMaxMb } from "@/lib/content/store";
import { dueLabel, isOpenTask, isOverdue, loadMyTasks, taskHeaderLabel, type MyTask } from "@/lib/queries/content";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Görevim" };
export const dynamic = "force-dynamic";

function toFormTask(t: MyTask, now: Date): FormTask {
  return {
    id: t.id,
    kind: t.kind,
    platform: t.platform,
    header: taskHeaderLabel(t),
    due: dueLabel(t.dueAt, now),
    overdue: isOverdue(t.dueAt, now),
    topic: t.topic,
    audience: t.audience,
    brief: t.brief,
    status: t.status,
    reviewNote: t.reviewNote,
    caption: t.caption ?? "",
    pageFields: t.pageFields,
    mediaPath: t.mediaPath,
    mediaMeta: t.mediaMeta,
    faceAnswer: t.faceAnswer,
  };
}

const STATUS_LABEL: Record<string, string> = { teslim: "Yöneticinin onayında", onaylandi: "Onaylandı" };

export default async function GorevimPage() {
  const profile = await requireRole("ogretmen");
  const supabase = await createServerSupabase();
  const now = new Date();
  const [tasks, rules] = await Promise.all([loadMyTasks(supabase, profile.id, now), getContentRules(supabase)]);
  const open = tasks.filter(isOpenTask);
  const submitted = tasks.filter((t) => !isOpenTask(t));
  const firstName = profile.full_name.split(" ")[0] ?? profile.full_name;

  return (
    <div className="flex flex-col gap-6">
      <ContentTaskForm
        firstName={firstName}
        tasks={open.map((t) => toFormTask(t, now))}
        banned={rules.banned}
        limits={rules.limits}
        videoMaxMb={videoMaxMb()}
      />

      {submitted.length > 0 ? (
        <section className="mx-auto flex w-full max-w-[34rem] flex-col gap-2 pb-4">
          <h2 className="text-[15px] font-bold text-foreground">Teslim ettiklerim</h2>
          <ul className="overflow-hidden rounded-2xl border border-border bg-surface text-sm">
            {submitted.map((t) => (
              <li key={t.id} className="flex flex-col gap-0.5 border-b border-border px-3.5 py-3 last:border-b-0">
                <span className="font-semibold text-foreground">{taskHeaderLabel(t)}</span>
                <span className="text-foreground">{t.topic}</span>
                <span className={t.status === "onaylandi" ? "text-accent" : "text-warning"}>
                  {STATUS_LABEL[t.status] ?? t.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
