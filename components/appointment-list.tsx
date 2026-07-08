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

const outcomeOptions: { value: AppointmentOutcome; label: string }[] = [
  { value: "geldi", label: "Geldi" },
  { value: "gelmedi", label: "Gelmedi" },
  { value: "ertelendi", label: "Ertelendi" },
  { value: "iptal", label: "İptal" },
];

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

export function AppointmentList({ appointments }: AppointmentListProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateOutcome(id: string, outcome: AppointmentOutcome) {
    setError(null);
    const needsNote = outcome === "gelmedi" || outcome === "ertelendi";
    const note = needsNote
      ? window.prompt("Kısa not ekleyin (opsiyonel):")?.trim()
      : undefined;

    setPendingId(id);
    startTransition(async () => {
      const result = await setAppointmentOutcome(id, outcome, note || undefined);
      setPendingId(null);

      if (result.error) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
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
        {appointments.map((appointment) => (
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
              <div className="mt-4 flex flex-wrap gap-2">
                {outcomeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={isPending}
                    onClick={() => updateOutcome(appointment.id, option.value)}
                    className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-400"
                  >
                    {pendingId === appointment.id && isPending
                      ? "Kaydediliyor..."
                      : option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
