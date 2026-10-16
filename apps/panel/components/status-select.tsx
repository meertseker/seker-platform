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
  onChanged?: () => void;
}

export function StatusSelect({ leadId, status, converted, onChanged }: StatusSelectProps) {
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
      onChanged?.();
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
        className="min-h-12 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {label(LEAD_STATUSES, option)}
          </option>
        ))}
      </select>

      {isPending ? (
        <p className="text-sm font-medium text-muted-foreground">Kaydediliyor...</p>
      ) : null}
      {converted ? (
        <p className="text-sm text-muted-foreground">Öğrenciye dönüştürüldü.</p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      {pendingStatus ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-4 sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`lost-title-${leadId}`}
        >
          <div className="w-full rounded-2xl border border-border bg-surface p-5 shadow-xl sm:max-w-md">
            <h2
              id={`lost-title-${leadId}`}
              className="text-lg font-semibold text-foreground"
            >
              Kayıp nedeni seçin
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Veliyi kaybedildi olarak işaretlemeden önce bir neden seçin.
            </p>

            <div className="mt-4 space-y-2">
              {lostReasonKeys.map((reason) => (
                <label
                  key={reason}
                  className="flex items-center gap-3 rounded-2xl border border-border px-3 py-2 text-sm font-medium text-foreground"
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
                className="min-h-12 flex-1 cursor-pointer rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
                className="min-h-12 flex-1 cursor-pointer rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
