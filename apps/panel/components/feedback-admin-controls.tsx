"use client";

import { useState, useTransition } from "react";
import { updateFeedbackStatus } from "@/actions/feedback";
import { FEEDBACK_STATUSES, type FeedbackStatus } from "@/lib/constants";

const inputClass =
  "min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function FeedbackAdminControls({
  id,
  status,
  adminNote,
}: {
  id: string;
  status: FeedbackStatus;
  adminNote: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      className="mt-3 grid gap-2 sm:grid-cols-[12rem_1fr_auto] sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await updateFeedbackStatus({
            id,
            status: data.get("status"),
            adminNote: data.get("adminNote"),
          });
          setMessage(result.ok ? { ok: true, text: "Kaydedildi" } : { ok: false, text: result.error });
        });
      }}
    >
      <label className="space-y-1 text-xs font-medium text-muted-foreground">
        Durum
        <select name="status" defaultValue={status} className={inputClass}>
          {(Object.keys(FEEDBACK_STATUSES) as FeedbackStatus[]).map((key) => (
            <option key={key} value={key}>{FEEDBACK_STATUSES[key]}</option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-xs font-medium text-muted-foreground">
        Not (isteğe bağlı)
        <input name="adminNote" defaultValue={adminNote ?? ""} maxLength={2000} className={inputClass} placeholder="Geri bildirim sahibine not" />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 cursor-pointer rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Kaydediliyor…" : "Kaydet"}
      </button>
      {message ? (
        <p role="status" className={`text-xs sm:col-span-3 ${message.ok ? "text-muted-foreground" : "font-medium text-red-700"}`}>
          {message.text}
        </p>
      ) : null}
    </form>
  );
}
