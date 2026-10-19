"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeTask } from "@/actions/tasks";

interface TaskCompleteButtonProps {
  id: string;
}

export function TaskCompleteButton({ id }: TaskCompleteButtonProps) {
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
