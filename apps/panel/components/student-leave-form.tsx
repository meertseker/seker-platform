"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markStudentLeft } from "@/actions/students";

interface StudentLeaveFormProps {
  studentId: string;
}

function todayInIstanbul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function StudentLeaveForm({ studentId }: StudentLeaveFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [leftDate, setLeftDate] = useState(() => todayInIstanbul());
  const [leaveReason, setLeaveReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await markStudentLeft(studentId, leftDate, leaveReason);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Öğrenci Ayrıldı</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ayrılış işaretlendiğinde bekleyen taksitler otomatik iptal edilir.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="min-h-11 cursor-pointer rounded-xl border border-red-200 bg-destructive-soft px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:border-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:cursor-not-allowed disabled:opacity-50"
        >
          {open ? "Vazgeç" : "Öğrenci Ayrıldı"}
        </button>
      </div>

      {open ? (
        <div className="mt-5 space-y-3">
          <label className="block text-sm font-medium text-foreground">
            Ayrılış tarihi
            <input
              type="date"
              value={leftDate}
              onChange={(event) => setLeftDate(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-input bg-surface px-3 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="block text-sm font-medium text-foreground">
            Neden
            <textarea
              rows={3}
              value={leaveReason}
              onChange={(event) => setLeaveReason(event.target.value)}
              placeholder="Ayrılış nedenini yazın..."
              className="mt-2 block w-full resize-y rounded-2xl border border-input bg-surface px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </label>

          {error ? (
            <p role="alert" className="rounded-xl bg-destructive-soft px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="min-h-11 cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Kaydediliyor..." : "Ayrılışı Kaydet"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
