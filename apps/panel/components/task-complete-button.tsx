"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { completeTask } from "@/actions/tasks";

interface TaskCompleteButtonProps {
  id: string;
  /** 44 px simge düğmesi (Bugün listesindeki satırlar için). */
  compact?: boolean;
}

export function TaskCompleteButton({ id, compact = false }: TaskCompleteButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onComplete() {
    setError(null);
    startTransition(async () => {
      const result = await completeTask(id);

      if (result.error) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  if (compact) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          disabled={isPending}
          onClick={onComplete}
          aria-label="Görevi tamamla"
          title="Görevi tamamla"
          className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border bg-surface text-accent transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check aria-hidden className="size-5" />
        </button>
        {error ? <p role="alert" className="text-xs font-medium text-red-700">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={onComplete}
        className="min-h-11 cursor-pointer rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Tamamlanıyor..." : "Tamamla"}
      </button>
      {error ? <p role="alert" className="text-xs font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
