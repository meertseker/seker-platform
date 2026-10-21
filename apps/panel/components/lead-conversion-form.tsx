"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { convertLeadToStudent } from "@/actions/students";
import { offerPlanQuery } from "@/lib/offer-plan";

interface LeadConversionFormProps {
  leadId: string;
}

function todayInIstanbul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Onaylı teklifle öğrenci kaydı açar ve ödeme planı sihirbazına yönlendirir (panel içinde gösterilir). */
export function LeadConversionForm({ leadId }: LeadConversionFormProps) {
  const router = useRouter();
  const defaultDate = useMemo(() => todayInIstanbul(), []);
  const [startDate, setStartDate] = useState(defaultDate);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await convertLeadToStudent(leadId, startDate);
      if (result.error || !result.studentId || !result.offer) {
        setError(result.error ?? "Öğrenciye dönüştürülemedi");
        return;
      }

      const params = offerPlanQuery(result.offer);
      router.push(`/ogrenciler/${result.studentId}?${params.toString()}`);
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground" htmlFor={`start-date-${leadId}`}>
          Okula başlama tarihi
        </label>
        <input
          id={`start-date-${leadId}`}
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
          className="mt-2 min-h-12 w-full rounded-xl border border-input bg-surface px-3 py-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={isPending || !startDate}
        className="min-h-14 w-full cursor-pointer rounded-xl bg-primary px-5 py-3 text-base font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Kayıt açılıyor..." : "Öğrenci kaydını aç"}
      </button>
    </div>
  );
}
