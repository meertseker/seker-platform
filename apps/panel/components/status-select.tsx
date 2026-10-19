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

/**
 * Seçim hemen kaydedilmez: klavyede ok tuşlarıyla gezinirken her adım kaydolmasın diye
 * değişiklik "Kaydet" ile onaylanır. Kayıp seçilince neden listesi aynı yerde açılır.
 */
export function StatusSelect({ leadId, status, converted, onChanged }: StatusSelectProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<LeadStatus>(status);
  const [lostReason, setLostReason] = useState<LostReason | "">("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const changed = draft !== status;
  const needsReason = changed && requiresLostReason(draft);

  const options = useMemo(
    () =>
      statusKeys.filter(
        (to) => to === status || canTransition(status, to, { converted }).ok,
      ),
    [converted, status],
  );

  function submit() {
    if (!changed) return;
    if (needsReason && !lostReason) {
      setError("Kayıp nedeni seçin.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateLeadStatus(leadId, draft, needsReason ? (lostReason as LostReason) : undefined);
      if (result.error) {
        setError(result.error);
        return;
      }
      setLostReason("");
      router.refresh();
      onChanged?.();
    });
  }

  function cancel() {
    setDraft(status);
    setLostReason("");
    setError(null);
  }

  return (
    <div className="space-y-3">
      <label className="sr-only" htmlFor={`status-${leadId}`}>
        Durum
      </label>
      <select
        id={`status-${leadId}`}
        value={draft}
        disabled={isPending || converted || options.length <= 1}
        onChange={(event) => {
          setDraft(event.target.value as LeadStatus);
          setError(null);
        }}
        className="min-h-12 w-full rounded-xl border border-input bg-surface px-3 py-2 text-base font-medium text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {label(LEAD_STATUSES, option)}
          </option>
        ))}
      </select>

      {converted ? (
        <p className="text-sm text-muted-foreground">Öğrenciye dönüştürüldü.</p>
      ) : null}

      {needsReason ? (
        <fieldset className="space-y-2">
          <legend className="text-base font-semibold text-foreground">Kayıp nedeni</legend>
          {lostReasonKeys.map((reason) => (
            <label
              key={reason}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-border px-3 py-2 text-base font-medium text-foreground has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
            >
              <input
                type="radio"
                name={`lost-reason-${leadId}`}
                value={reason}
                checked={lostReason === reason}
                onChange={() => {
                  setLostReason(reason);
                  setError(null);
                }}
                className="size-5 accent-primary"
              />
              {label(LOST_REASONS, reason)}
            </label>
          ))}
        </fieldset>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl bg-destructive-soft px-3 py-2 text-sm font-medium text-destructive-strong">
          {error}
        </p>
      ) : null}

      {changed ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={cancel}
            disabled={isPending}
            className="min-h-12 flex-1 cursor-pointer rounded-xl border border-border bg-surface px-4 py-3 text-base font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPending || (needsReason && !lostReason)}
            className="min-h-12 flex-1 cursor-pointer rounded-xl bg-primary px-4 py-3 text-base font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Kaydediliyor..." : `${label(LEAD_STATUSES, draft)} olarak kaydet`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
