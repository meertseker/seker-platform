"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAppointment } from "@/actions/appointments";
import {
  APPOINTMENT_TYPES,
  label,
  type AppointmentType,
} from "@/lib/constants";

interface AppointmentFormProps {
  leadId: string;
}

interface PendingAppointment {
  scheduledAt: string;
  type: AppointmentType;
}

interface ConflictInfo {
  leadName: string;
  at: string;
}

const typeKeys = Object.keys(APPOINTMENT_TYPES) as AppointmentType[];

const conflictDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});

export function AppointmentForm({ leadId }: AppointmentFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [pendingAppointment, setPendingAppointment] =
    useState<PendingAppointment | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitAppointment(next: PendingAppointment, force = false) {
    setError(null);
    startTransition(async () => {
      const result = await createAppointment(
        leadId,
        next.scheduledAt,
        next.type,
        force,
      );

      if (result.conflict) {
        setPendingAppointment(next);
        setConflict(result.conflict);
        return;
      }

      if (result.error) {
        setError(result.error);
        return;
      }

      setConflict(null);
      setPendingAppointment(null);
      router.refresh();
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const scheduledAt = String(formData.get("scheduledAt") ?? "");
    const type = String(formData.get("type") ?? "") as AppointmentType;

    if (!scheduledAt) {
      setError("Randevu tarihi ve saati zorunludur.");
      return;
    }

    if (!typeKeys.includes(type)) {
      setError("Randevu türü seçin.");
      return;
    }

    submitAppointment({ scheduledAt, type });
    form.reset();
  }

  function confirmConflict() {
    if (!pendingAppointment) return;
    submitAppointment(pendingAppointment, true);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <div>
        <h3 className="text-lg font-semibold text-foreground">Yeni randevu</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Okul ziyareti veya telefon görüşmesi için tarih belirleyin.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label
            htmlFor="appointment-scheduled-at"
            className="text-sm font-medium text-foreground"
          >
            Tarih ve saat
          </label>
          <input
            id="appointment-scheduled-at"
            name="scheduledAt"
            type="datetime-local"
            disabled={isPending}
            className="mt-2 block min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted"
          />
        </div>

        <div>
          <label
            htmlFor="appointment-type"
            className="text-sm font-medium text-foreground"
          >
            Tür
          </label>
          <select
            id="appointment-type"
            name="type"
            defaultValue="okul_ziyareti"
            disabled={isPending}
            className="mt-2 block min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted"
          >
            {typeKeys.map((type) => (
              <option key={type} value={type}>
                {label(APPOINTMENT_TYPES, type)}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="min-h-11 cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Kaydediliyor..." : "Randevu Ekle"}
        </button>
      </div>

      {conflict ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            Bu saate yakın başka randevu var: {conflict.leadName} —{" "}
            {conflictDateFormatter.format(new Date(conflict.at))}. Yine de
            kaydet?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={confirmConflict}
              className="min-h-11 cursor-pointer rounded-xl bg-amber-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              Yine de kaydet
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setConflict(null);
                setPendingAppointment(null);
              }}
              className="min-h-11 cursor-pointer rounded-xl border border-amber-200 bg-surface px-3 py-2 text-sm font-semibold text-amber-900 transition-colors hover:border-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              Vazgeç
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}
