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
        className="w-full rounded-xl bg-zinc-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
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
          <div className="w-full rounded-3xl bg-white p-5 shadow-xl sm:max-w-md">
            <h2 id={`convert-title-${leadId}`} className="text-lg font-semibold text-zinc-950">
              Öğrenciye dönüştür
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              Onaylı teklif bilgileriyle öğrenci kaydı açılır ve ödeme planı sihirbazı başlatılır.
            </p>

            <label className="mt-4 block text-sm font-medium text-zinc-700" htmlFor="start-date">
              Başlangıç tarihi
            </label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-3 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
            />

            {error ? (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="flex-1 rounded-xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 disabled:cursor-not-allowed disabled:text-zinc-400"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={isPending || !startDate}
                className="flex-1 rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
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
