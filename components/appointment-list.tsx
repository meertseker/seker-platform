"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAppointmentOutcome } from "@/actions/appointments";
import {
  APPOINTMENT_OUTCOMES,
  APPOINTMENT_TYPES,
  label,
  type AppointmentOutcome,
  type AppointmentType,
} from "@/lib/constants";

export interface AppointmentListItem {
  id: string;
  scheduled_at: string;
  type: AppointmentType;
  outcome: AppointmentOutcome;
  outcome_note: string | null;
}

interface AppointmentListProps {
  appointments: AppointmentListItem[];
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

function outcomeClass(outcome: AppointmentOutcome) {
  switch (outcome) {
    case "geldi":
      return "bg-green-50 text-green-700 ring-green-200";
    case "gelmedi":
      return "bg-red-50 text-red-700 ring-red-200";
    case "ertelendi":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "iptal":
      return "bg-zinc-100 text-zinc-600 ring-zinc-200";
    default:
      return "bg-blue-50 text-blue-700 ring-blue-200";
  }
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function needsNote(outcome: AppointmentOutcome) {
  return outcome === "gelmedi" || outcome === "ertelendi";
}

export function AppointmentList({ appointments }: AppointmentListProps) {
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
      <p className="rounded-3xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
        Henüz randevu yok. İlk randevuyu ekleyin.
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
              className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <time
                    dateTime={appointment.scheduled_at}
                    className="text-base font-semibold text-zinc-950"
                  >
                    {formatDate(appointment.scheduled_at)}
                  </time>
                  <p className="mt-1 text-sm text-zinc-600">
                    {label(APPOINTMENT_TYPES, appointment.type)}
                  </p>
                  {appointment.outcome_note ? (
                    <p className="mt-2 rounded-2xl bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                      {appointment.outcome_note}
                    </p>
                  ) : null}
                </div>

                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ring-1 ${outcomeClass(
                    appointment.outcome,
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
                        className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-400"
                      >
                        {isSavingAppointment ? "Kaydediliyor..." : option.label}
                      </button>
                    ))}
                  </div>

                  {activeNoteDraft ? (
                    <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                      <label
                        htmlFor={`appointment-note-${appointment.id}`}
                        className="text-sm font-medium text-zinc-700"
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
                        className="mt-2 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 disabled:cursor-not-allowed disabled:bg-zinc-100"
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
                          className="rounded-xl bg-zinc-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                        >
                          {isSavingAppointment ? "Kaydediliyor..." : "Kaydet"}
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setNoteDraft(null)}
                          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-400"
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
