"use client";

import { FormEvent, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAppointment } from "@/actions/appointments";
import { useToast } from "@/components/toast";
import {
  APPOINTMENT_TYPES,
  label,
  type AppointmentType,
} from "@/lib/constants";

interface AppointmentFormProps {
  leadId: string;
  onSuccess?: () => void;
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

export function AppointmentForm({ leadId, onSuccess }: AppointmentFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [pendingAppointment, setPendingAppointment] =
    useState<PendingAppointment | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const showToast = useToast();

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
      // Form yalnız kayıt başarılıysa temizlenir; hata olursa yazılanlar kalır.
      formRef.current?.reset();
      showToast({ text: result.warning ?? "Randevu kaydedildi" });
      router.refresh();
      onSuccess?.();
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
  }

  function confirmConflict() {
    if (!pendingAppointment) return;
    submitAppointment(pendingAppointment, true);
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
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
            className="mt-2 block min-h-12 w-full rounded-xl border border-input bg-surface px-3 py-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-muted"
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
            className="mt-2 block min-h-12 w-full rounded-xl border border-input bg-surface px-3 py-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-muted"
          >
            {typeKeys.map((type) => (
              <option key={type} value={type}>
                {label(APPOINTMENT_TYPES, type)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="min-h-14 w-full cursor-pointer rounded-xl bg-primary px-5 py-3 text-base font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Kaydediliyor..." : "Randevuyu kaydet"}
      </button>

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
              className="min-h-12 cursor-pointer rounded-xl bg-amber-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
              className="min-h-12 cursor-pointer rounded-xl border border-amber-200 bg-surface px-3 py-2 text-sm font-semibold text-amber-900 transition-colors hover:border-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              Vazgeç
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}
