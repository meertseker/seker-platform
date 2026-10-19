"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Phone } from "lucide-react";
import { recordCall } from "@/actions/lead-flow";
import type { FollowupTimeline as Timeline, TimelineStep } from "@/lib/lead-flow/timeline";

interface FollowupTimelineProps {
  leadId: string;
  timeline: Timeline;
  /** Velide kayıtlı nitelik işaretleri (boşsa false); "Açmadı" bunları değiştirmeden yazar. */
  quals: { age: boolean; area: boolean; timing: boolean };
}

function StepRow({ step }: { step: TimelineStep }) {
  const dot =
    step.state === "done"
      ? "border-accent/30 bg-accent-soft text-accent"
      : step.state === "now"
        ? "border-primary bg-primary text-on-primary"
        : "border-border bg-surface text-muted-foreground";
  return (
    <li className="relative flex gap-3 pb-3.5 last:pb-0">
      <span
        aria-hidden
        className={`relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${dot}`}
      >
        {step.state === "done" ? <Check className="size-4" strokeWidth={2.6} /> : step.n}
      </span>
      <div className="min-w-0 pt-0.5">
        <p
          aria-current={step.state === "now" ? "step" : undefined}
          className={`text-[0.9375rem] ${
            step.state === "now" ? "font-bold text-foreground" : step.state === "done" ? "font-medium text-muted-foreground" : "font-medium text-foreground"
          }`}
        >
          {step.title}
          {step.state === "done" ? <span className="sr-only"> (yapıldı)</span> : null}
          {step.state === "next" ? <span className="sr-only"> (sırada)</span> : null}
        </p>
        <p className="text-sm text-muted-foreground">{step.sub}</p>
      </div>
    </li>
  );
}

/** Takip sırası: yapıldı / şimdi / sırada; "Ara · açtı" arama ekranına, "Açmadı" sırayı ilerletir. */
export function FollowupTimeline({ leadId, timeline, quals }: FollowupTimelineProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string[] | null>(null);

  if (timeline.state === "hidden") return null;

  if (timeline.state === "stopped") {
    return (
      <section className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm">
        <h2 className="text-sm font-semibold text-muted-foreground">Takip sırası</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent">
          <Check aria-hidden className="size-4" />
          Ulaşıldı · takip durdu
        </span>
      </section>
    );
  }

  function noAnswer() {
    setError(null);
    startTransition(async () => {
      const res = await recordCall({
        leadId,
        result: "ulasilamadi",
        quals: { ...quals, reached: false },
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setDone(res.done);
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Takip sırası</h2>
        <span className="text-xs text-muted-foreground">panel kurdu</span>
      </div>
      <ol className="relative mt-3 before:absolute before:bottom-3 before:left-3.5 before:top-3 before:w-px before:bg-border">
        {timeline.steps.map((step) => (
          <StepRow key={step.n} step={step} />
        ))}
      </ol>

      {done ? (
        <div className="mt-3 rounded-xl bg-accent-soft px-3 py-2.5 text-sm" role="status">
          <p className="font-semibold text-accent-strong">Panel şunları yaptı:</p>
          <ul className="mt-1 space-y-0.5">
            {done.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden className="font-bold text-accent">✓</span>
                <span className="text-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {timeline.state === "active" ? (
        <>
          {error ? (
            <p role="alert" className="mt-3 rounded-xl bg-destructive-soft px-3 py-2.5 text-sm font-medium text-destructive-strong">
              {error}
            </p>
          ) : null}
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <Link
              href={`/leads/${leadId}/ara`}
              className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-[1.0625rem] font-bold text-on-primary hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Phone aria-hidden className="size-5" />
              Ara · açtı
            </Link>
            <button
              type="button"
              onClick={noAnswer}
              disabled={pending}
              className="min-h-14 rounded-2xl border border-input bg-surface px-5 text-base font-semibold text-foreground hover:bg-muted disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {pending ? "Kaydediliyor…" : "Açmadı"}
            </button>
          </div>
        </>
      ) : (
        <p className="mt-3 rounded-xl bg-muted px-3 py-2.5 text-sm text-foreground">
          7 günde ulaşılamadı. Veli &quot;Kaybedildi · Ulaşılamadı&quot; oldu.
          {timeline.kontenjanPlanned
            ? " Panel 1 ay sonra bir kez \"kontenjan\" mesajıyla tekrar deneyecek."
            : null}
        </p>
      )}
    </section>
  );
}
