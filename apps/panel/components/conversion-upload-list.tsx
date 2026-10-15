"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { retryConversionUpload } from "@/actions/marketing";
import { CONVERSION_ACTIONS, CONVERSION_UPLOAD_STATUSES, label } from "@/lib/constants";
import type { UploadListItem } from "@/lib/queries/marketing";

const STATUS_CLASS: Record<string, string> = {
  bekliyor: "bg-amber-50 text-amber-800 ring-amber-200",
  gonderildi: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  hata: "bg-red-50 text-red-700 ring-red-200",
  atlandi: "bg-muted text-muted-foreground ring-border",
};

const dateFormatter = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "Europe/Istanbul" });

export function ConversionUploadList({ uploads }: { uploads: UploadListItem[] }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (uploads.length === 0) {
    return <p className="text-sm text-muted-foreground">Henüz Google&apos;a bildirilecek bir randevu veya kayıt yok.</p>;
  }

  return (
    <div className="space-y-3">
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
      <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
        {uploads.map((u) => (
          <li key={u.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Link href={`/leads/${u.leadId}`} className="font-semibold text-foreground hover:underline">{u.parentName}</Link>
              <p className="text-sm text-muted-foreground">
                {label(CONVERSION_ACTIONS, u.action)} · {dateFormatter.format(new Date(u.conversionAt))}
                {u.error ? <span className={`block break-words ${u.status === "gonderildi" ? "text-muted-foreground" : "text-red-700"}`}>{u.error}</span> : null}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_CLASS[u.status] ?? STATUS_CLASS.atlandi}`}>
                {label(CONVERSION_UPLOAD_STATUSES, u.status)}
              </span>
              {u.status === "hata" ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await retryConversionUpload(u.id);
                      setMessage(result.ok ? "Yarın sabahki senkronda tekrar gönderilecek." : result.error);
                    })
                  }
                  className="min-h-11 cursor-pointer rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Tekrar dene
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
