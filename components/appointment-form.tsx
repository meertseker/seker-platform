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
      className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div>
        <h3 className="text-lg font-semibold text-zinc-950">Yeni randevu</h3>
        <p className="mt-1 text-sm text-zinc-600">
          Okul ziyareti veya telefon görüşmesi için tarih belirleyin.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label
            htmlFor="appointment-scheduled-at"
            className="text-sm font-medium text-zinc-700"
          >
            Tarih ve saat
          </label>
          <input
            id="appointment-scheduled-at"
            name="scheduledAt"
            type="datetime-local"
            disabled={isPending}
            className="mt-2 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 disabled:cursor-not-allowed disabled:bg-zinc-100"
          />
        </div>

        <div>
          <label
            htmlFor="appointment-type"
            className="text-sm font-medium text-zinc-700"
          >
            Tür
          </label>
          <select
            id="appointment-type"
            name="type"
            defaultValue="okul_ziyareti"
            disabled={isPending}
            className="mt-2 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 disabled:cursor-not-allowed disabled:bg-zinc-100"
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
          className="rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {isPending ? "Kaydediliyor..." : "Randevu Ekle"}
        </button>
      </div>

      {conflict ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            Bu saate yakın başka randevu var: {conflict.leadName} — yine de
            kaydet?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={confirmConflict}
              className="rounded-xl bg-amber-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-amber-400"
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
              className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-900 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:text-amber-400"
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
