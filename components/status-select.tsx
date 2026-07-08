"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLeadStatus } from "@/actions/leads";
import {
  label,
  LEAD_STATUSES,
  LOST_REASONS,
  type LeadStatus,
  type LostReason,
} from "@/lib/constants";
import { canTransition, requiresLostReason } from "@/lib/lead-state";

const statusKeys = Object.keys(LEAD_STATUSES) as LeadStatus[];
const lostReasonKeys = Object.keys(LOST_REASONS) as LostReason[];

interface StatusSelectProps {
  leadId: string;
  status: LeadStatus;
  converted: boolean;
}

export function StatusSelect({ leadId, status, converted }: StatusSelectProps) {
  const router = useRouter();
  const [optimisticStatus, setOptimisticStatus] = useState<LeadStatus | null>(null);
  const [pendingStatus, setPendingStatus] = useState<LeadStatus | null>(null);
  const [lostReason, setLostReason] = useState<LostReason | "">("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selected = optimisticStatus ?? status;

  const options = useMemo(
    () =>
      statusKeys.filter(
        (to) => to === status || canTransition(status, to, { converted }).ok,
      ),
    [converted, status],
  );

  function submitStatus(to: LeadStatus, reason?: LostReason) {
    setError(null);
    startTransition(async () => {
      const result = await updateLeadStatus(leadId, to, reason);
      if (result.error) {
        setOptimisticStatus(null);
        setError(result.error);
        return;
      }

      setOptimisticStatus(to);
      setPendingStatus(null);
      setLostReason("");
      router.refresh();
    });
  }

  function handleChange(to: LeadStatus) {
    setOptimisticStatus(to === status ? null : to);
    setError(null);

    if (to === status) return;
    if (requiresLostReason(to)) {
      setPendingStatus(to);
      return;
    }

    submitStatus(to);
  }

  function closeModal() {
    if (isPending) return;
    setPendingStatus(null);
    setLostReason("");
    setOptimisticStatus(null);
  }

  return (
    <div className="space-y-2">
      <label className="sr-only" htmlFor={`status-${leadId}`}>
        Durum
      </label>
      <select
        id={`status-${leadId}`}
        value={selected}
        disabled={isPending || converted || options.length <= 1}
        onChange={(event) => handleChange(event.target.value as LeadStatus)}
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {label(LEAD_STATUSES, option)}
          </option>
        ))}
      </select>

      {isPending ? (
        <p className="text-xs font-medium text-zinc-500">Kaydediliyor...</p>
      ) : null}
      {converted ? (
        <p className="text-xs text-zinc-500">Öğrenciye dönüştürüldü.</p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </p>
      ) : null}

      {pendingStatus ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-zinc-950/40 p-4 sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`lost-title-${leadId}`}
        >
          <div className="w-full rounded-3xl bg-white p-5 shadow-xl sm:max-w-md">
            <h2
              id={`lost-title-${leadId}`}
              className="text-lg font-semibold text-zinc-950"
            >
              Kayıp nedeni seçin
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              Lead kaybedildi olarak işaretlenmeden önce neden zorunludur.
            </p>

            <div className="mt-4 space-y-2">
              {lostReasonKeys.map((reason) => (
                <label
                  key={reason}
                  className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-800"
                >
                  <input
                    type="radio"
                    name={`lost-reason-${leadId}`}
                    value={reason}
                    checked={lostReason === reason}
                    onChange={() => setLostReason(reason)}
                    className="h-4 w-4"
                  />
                  {label(LOST_REASONS, reason)}
                </label>
              ))}
            </div>

            {error ? (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={isPending}
                className="flex-1 rounded-xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 disabled:cursor-not-allowed disabled:text-zinc-400"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={isPending || !lostReason}
                onClick={() =>
                  lostReason
                    ? submitStatus(pendingStatus, lostReason)
                    : setError("Kayıp nedeni zorunludur")
                }
                className="flex-1 rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              >
                {isPending ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
