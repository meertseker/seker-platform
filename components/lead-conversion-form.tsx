"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { convertLeadToStudent } from "@/actions/students";

interface LeadConversionFormProps {
  leadId: string;
  canConvert: boolean;
}

function todayInIstanbul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function LeadConversionForm({ leadId, canConvert }: LeadConversionFormProps) {
  const router = useRouter();
  const defaultDate = useMemo(() => todayInIstanbul(), []);
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(defaultDate);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!canConvert) return null;

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await convertLeadToStudent(leadId, startDate);
      if (result.error || !result.studentId || !result.offer) {
        setError(result.error ?? "Öğrenciye dönüştürülemedi");
        return;
      }

      const params = new URLSearchParams({
        plan: "1",
        total: String(result.offer.totalTl),
        count: String(result.offer.installmentCount),
        offer: result.offer.sourceOfferId,
      });
      router.push(`/ogrenciler/${result.studentId}?${params.toString()}`);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 w-full cursor-pointer rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Öğrenciye Dönüştür
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-zinc-950/40 p-4 sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`convert-title-${leadId}`}
        >
          <div className="w-full rounded-2xl border border-border bg-surface p-5 shadow-xl sm:max-w-md">
            <h2 id={`convert-title-${leadId}`} className="text-lg font-semibold text-foreground">
              Öğrenciye dönüştür
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Onaylı teklif bilgileriyle öğrenci kaydı açılır ve ödeme planı sihirbazı başlatılır.
            </p>

            <label className="mt-4 block text-sm font-medium text-foreground" htmlFor="start-date">
              Başlangıç tarihi
            </label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
            />

            {error ? (
              <p className="mt-3 rounded-xl bg-destructive-soft px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="min-h-11 flex-1 cursor-pointer rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={isPending || !startDate}
                className="min-h-11 flex-1 cursor-pointer rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? "Dönüştürülüyor..." : "Dönüştür"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
