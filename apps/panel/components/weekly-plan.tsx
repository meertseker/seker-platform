"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { saveWeeklyReview, type WeeklySlot } from "@/actions/weekly";

export type PlanSlot = { slot: WeeklySlot; label: string; existing: { code: string; owner: string } | null };

interface Props {
  weekStart: string;
  /** Görevlerin açılacağı hafta ("19–25 Ekim"). */
  taskWeekLabel: string;
  /** Varsayılan teslim: görev haftasının Perşembesi 17:00 ("YYYY-MM-DDTHH:MM"). */
  defaultDue: string;
  teachers: { id: string; name: string }[];
  slots: PlanSlot[];
  initialTopic: string;
  savedNote: string | null;
}

type Done = { created: { code: string; owner: string }[]; waLinks: { owner: string; url: string }[] };

const fieldClass =
  "block min-h-12 w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-muted placeholder:text-placeholder";

/** 5 · Bu haftanın konusu ve görevleri. Görevler toplantıdan sonraki haftaya açılır; toplantı kaydedilir. */
export function WeeklyPlan({ weekStart, taskWeekLabel, defaultDue, teachers, slots, initialTopic, savedNote }: Props) {
  const router = useRouter();
  const [topic, setTopic] = useState(initialTopic);
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [dues, setDues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDone(null);
    startTransition(async () => {
      try {
        const res = await saveWeeklyReview({
          weekStart,
          topic,
          tasks: slots
            .filter((s) => !s.existing)
            .map((s) => ({ slot: s.slot, ownerId: owners[s.slot] || null, dueAt: dues[s.slot] ?? defaultDue })),
        });
        if ("error" in res) {
          setError(res.error);
          router.refresh();
          return;
        }
        setDone({ created: res.created, waLinks: res.waLinks });
        setOwners({});
        router.refresh();
      } catch {
        setError("Kaydedilemedi, tekrar deneyin.");
      }
    });
  }

  return (
    <section id="gorevler" aria-labelledby="gorevler-baslik" className="flex scroll-mt-4 flex-col gap-2.5">
      <h2 id="gorevler-baslik" className="text-xl font-bold text-foreground">
        5 · Bu haftanın konusu ve görevleri
      </h2>
      <p className="text-sm text-muted-foreground">
        Görevler {taskWeekLabel} haftası için açılır. Öğretmen seçilmeyen görev açılmaz.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
        <label htmlFor="hafta-konu" className="text-[13px] text-muted-foreground">
          Konu (velinin bir sorusu ya da kaygısı)
        </label>
        <input
          id="hafta-konu"
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={200}
          required
          placeholder="Örn. Çalışan anneye uygun saatler"
          className={fieldClass}
        />
        {teachers.length === 0 ? (
          <p className="text-sm text-warning">Etkin öğretmen yok; görev açılamaz. Toplantı yine kaydedilir.</p>
        ) : null}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-2 text-sm">
          {slots.map((s) => (
            <fieldset key={s.slot} className="flex min-w-0 flex-col gap-2 rounded-xl border border-border px-3 py-2.5">
              <legend className="px-1 font-bold text-foreground">{s.label}</legend>
              {s.existing ? (
                <p className="text-muted-foreground">
                  <b className="text-foreground">{s.existing.code}</b> açık · {s.existing.owner}
                </p>
              ) : (
                <>
                  <label className="flex flex-col gap-1 text-muted-foreground">
                    Öğretmen
                    <select
                      value={owners[s.slot] ?? ""}
                      onChange={(e) => setOwners((o) => ({ ...o, [s.slot]: e.target.value }))}
                      disabled={teachers.length === 0}
                      className={fieldClass}
                    >
                      <option value="">Görev yok</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-muted-foreground">
                    Teslim
                    <input
                      type="datetime-local"
                      value={dues[s.slot] ?? defaultDue}
                      onChange={(e) => setDues((d) => ({ ...d, [s.slot]: e.target.value }))}
                      disabled={!owners[s.slot]}
                      className={fieldClass}
                    />
                  </label>
                </>
              )}
            </fieldset>
          ))}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-[50px] cursor-pointer items-center justify-center self-start rounded-xl bg-primary px-5 text-base font-bold text-on-primary hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Kaydediliyor…" : done ? "✓ Görevler gönderildi, toplantı kaydedildi" : "Görevleri gönder ve toplantıyı kaydet"}
        </button>
        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive-strong">
            {error}
          </p>
        ) : null}
        {done ? (
          <div role="status" className="flex flex-col gap-2 rounded-xl border border-accent/30 bg-accent-soft p-3 text-sm text-foreground">
            <p className="font-semibold text-accent">✓ Görevler gönderildi, toplantı kaydedildi</p>
            {done.created.length > 0 ? (
              <p>Açılan görevler: {done.created.map((c) => `${c.code} (${c.owner})`).join(", ")}. Öğretmenlere panel bildirimi gitti.</p>
            ) : (
              <p>Yeni görev açılmadı.</p>
            )}
            {done.waLinks.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {done.waLinks.map((w) => (
                  <a
                    key={w.url}
                    href={w.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-on-primary hover:bg-accent-strong"
                  >
                    {w.owner}: WhatsApp&apos;tan haber ver
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        ) : savedNote ? (
          <p className="text-[13px] text-muted-foreground">{savedNote}</p>
        ) : null}
      </form>
    </section>
  );
}
