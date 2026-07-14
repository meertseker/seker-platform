"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAppointmentOutcome } from "@/actions/appointments";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { APPOINTMENT_OUTCOME_STYLES, badgeClass } from "@/lib/status-styles";
import {
  APPOINTMENT_OUTCOMES,
  APPOINTMENT_TYPES,
  label,
  type AppointmentOutcome,
  type AppointmentType,
} from "@/lib/constants";

export interface AppointmentListItem {
  id: string;
  leadId?: string;
  leadName?: string;
  leadPhone?: string;
  scheduled_at: string;
  type: AppointmentType;
  outcome: AppointmentOutcome;
  outcome_note: string | null;
}

interface AppointmentListProps {
  appointments: AppointmentListItem[];
  emptyText?: string;
  compactTime?: boolean;
}

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});

const outcomeOptions = (Object.keys(APPOINTMENT_OUTCOMES) as AppointmentOutcome[])
  .filter((value) => value !== "bekliyor")
  .map((value) => ({ value, label: label(APPOINTMENT_OUTCOMES, value) }));

interface NoteDraft {
  id: string;
  outcome: AppointmentOutcome;
  note: string;
}

const OUTCOME_BUTTON_BASE =
  "min-h-11 cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function outcomeButtonClass(outcome: AppointmentOutcome) {
  if (outcome === "geldi") {
    return `${OUTCOME_BUTTON_BASE} bg-accent text-white hover:bg-accent-strong focus-visible:ring-offset-2`;
  }
  if (outcome === "gelmedi" || outcome === "iptal") {
    return `${OUTCOME_BUTTON_BASE} border border-border bg-surface text-slate-700 hover:border-red-300 hover:text-red-700`;
  }
  return `${OUTCOME_BUTTON_BASE} border border-border bg-surface text-slate-700 hover:border-slate-300 hover:text-foreground`;
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}

function needsNote(outcome: AppointmentOutcome) {
  return outcome === "gelmedi" || outcome === "ertelendi";
}

export function AppointmentList({
  appointments,
  emptyText = "Henüz randevu yok. İlk randevuyu ekleyin.",
  compactTime = false,
}: AppointmentListProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<NoteDraft | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitOutcome(id: string, outcome: AppointmentOutcome, note?: string) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const result = await setAppointmentOutcome(id, outcome, note?.trim() || undefined);
      setPendingId(null);

      if (result.error) {
        setError(result.error);
        return;
      }

      setNoteDraft(null);
      router.refresh();
    });
  }

  function updateOutcome(id: string, outcome: AppointmentOutcome) {
    if (needsNote(outcome)) {
      setError(null);
      setNoteDraft({ id, outcome, note: "" });
      return;
    }

    submitOutcome(id, outcome);
  }

  if (appointments.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <ul className="space-y-3">
        {appointments.map((appointment) => {
          const activeNoteDraft =
            noteDraft?.id === appointment.id ? noteDraft : null;
          const isSavingAppointment = pendingId === appointment.id && isPending;

          return (
            <li
              key={appointment.id}
              className="rounded-2xl border border-border bg-surface p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Clock aria-hidden className="size-4 text-muted-foreground" />
                    <time
                      dateTime={appointment.scheduled_at}
                      className="text-base font-semibold text-foreground tabular-nums"
                    >
                      {compactTime
                        ? formatTime(appointment.scheduled_at)
                        : formatDate(appointment.scheduled_at)}
                    </time>
                  </div>
                  {appointment.leadId ? (
                    <div className="mt-1 flex items-center gap-2">
                      <Link
                        href={`/leads/${appointment.leadId}`}
                        className="text-sm font-semibold text-foreground transition-colors hover:underline"
                      >
                        {appointment.leadName ?? "Lead detayına git"}
                      </Link>
                      {appointment.leadPhone ? (
                        <WhatsAppButton phone={appointment.leadPhone} compact />
                      ) : null}
                    </div>
                  ) : null}
                  <p className="mt-1 text-sm text-muted-foreground">
                    {label(APPOINTMENT_TYPES, appointment.type)}
                  </p>
                  {appointment.outcome_note ? (
                    <p className="mt-2 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                      {appointment.outcome_note}
                    </p>
                  ) : null}
                </div>

                <span
                  className={`w-fit ${badgeClass(
                    APPOINTMENT_OUTCOME_STYLES[appointment.outcome],
                  )}`}
                >
                  {label(APPOINTMENT_OUTCOMES, appointment.outcome)}
                </span>
              </div>

              {appointment.outcome === "bekliyor" ? (
                <>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {outcomeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        disabled={isPending}
                        onClick={() => updateOutcome(appointment.id, option.value)}
                        className={outcomeButtonClass(option.value)}
                      >
                        {isSavingAppointment ? "Kaydediliyor..." : option.label}
                      </button>
                    ))}
                  </div>

                  {activeNoteDraft ? (
                    <div className="mt-3 rounded-2xl border border-border bg-muted p-3">
                      <label
                        htmlFor={`appointment-note-${appointment.id}`}
                        className="text-sm font-medium text-foreground"
                      >
                        Kısa not (opsiyonel)
                      </label>
                      <input
                        id={`appointment-note-${appointment.id}`}
                        type="text"
                        value={activeNoteDraft.note}
                        disabled={isPending}
                        onChange={(event) =>
                          setNoteDraft({
                            ...activeNoteDraft,
                            note: event.target.value,
                          })
                        }
                        className="mt-2 block min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted"
                        placeholder="Örn. veli tekrar aranacak"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            submitOutcome(
                              activeNoteDraft.id,
                              activeNoteDraft.outcome,
                              activeNoteDraft.note,
                            )
                          }
                          className="min-h-11 cursor-pointer rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSavingAppointment ? "Kaydediliyor..." : "Kaydet"}
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setNoteDraft(null)}
                          className="min-h-11 cursor-pointer rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Vazgeç
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
