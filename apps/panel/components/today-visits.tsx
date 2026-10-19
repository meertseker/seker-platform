"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAppointmentOutcome } from "@/actions/appointments";
import { APPOINTMENT_OUTCOMES, label, type AppointmentOutcome } from "@/lib/constants";

export interface TodayVisit {
  id: string;
  leadId: string;
  leadName: string;
  /** "10:00" ya da bugünden önceyse "18 Ekim 10:00". */
  when: string;
  /** Ziyaret dışı tür ("Telefon Görüşmesi") ya da null. */
  typeLabel: string | null;
  outcome: AppointmentOutcome;
  /** Saati geçti ama sonuç girilmedi. */
  overdue: boolean;
}

const BUTTON =
  "min-h-12 flex-1 cursor-pointer rounded-xl text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

/** Bugünkü (ve sonuçlanmamış eski) randevular: Geldi / Gelmedi. */
export function TodayVisits({ visits }: { visits: TodayVisit[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(id: string, outcome: AppointmentOutcome) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const result = await setAppointmentOutcome(id, outcome);
      setPendingId(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      {error ? (
        <p role="alert" className="rounded-2xl bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive-strong">
          {error}
        </p>
      ) : null}
      <ul className="flex flex-col gap-2.5">
        {visits.map((visit) => {
          const saving = isPending && pendingId === visit.id;
          const done = visit.outcome !== "bekliyor";
          return (
            <li
              key={visit.id}
              className={`flex flex-col gap-2.5 rounded-2xl border bg-surface p-3.5 ${
                visit.overdue ? "border-destructive/40" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/leads/${visit.leadId}`}
                  className="min-w-0 text-[15px] font-semibold text-foreground hover:text-primary-strong"
                >
                  <span className="tabular-nums">{visit.when}</span> · {visit.leadName}
                </Link>
                {done ? (
                  <span className="shrink-0 text-[12.5px] font-semibold text-muted-foreground">
                    {label(APPOINTMENT_OUTCOMES, visit.outcome)}
                  </span>
                ) : visit.overdue ? (
                  <span className="shrink-0 text-[12.5px] font-semibold text-destructive-strong">sonuç bekliyor</span>
                ) : visit.typeLabel ? (
                  <span className="shrink-0 text-[12.5px] text-muted-foreground">{visit.typeLabel}</span>
                ) : null}
              </div>
              {done ? null : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => submit(visit.id, "geldi")}
                    className={`${BUTTON} border border-accent/40 bg-surface text-accent hover:bg-accent-soft`}
                  >
                    {saving ? "Kaydediliyor…" : "Geldi"}
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => submit(visit.id, "gelmedi")}
                    className={`${BUTTON} border border-border bg-surface text-foreground hover:bg-muted`}
                  >
                    Gelmedi
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
