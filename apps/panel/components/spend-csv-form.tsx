"use client";

import { useState, useTransition } from "react";
import { importSpendCsv } from "@/actions/marketing";

export function SpendCsvForm() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-center"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await importSpendCsv(formData);
          setMessage(
            result.ok
              ? `${result.count} satır harcama içeri alındı.${result.warnings.length ? ` Atlanan: ${result.warnings.join("; ")}` : ""}`
              : result.error,
          );
        });
      }}
    >
      <label htmlFor="spend-csv" className="text-sm font-medium text-foreground">Harcama CSV&apos;si</label>
      <input id="spend-csv" name="file" type="file" accept=".csv,.tsv,.txt,text/csv" required className="text-sm" />
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 cursor-pointer rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Yükleniyor…" : "Yükle"}
      </button>
      {message ? <p role="status" className="text-sm text-muted-foreground sm:ml-2">{message}</p> : null}
    </form>
  );
}
