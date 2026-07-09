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
        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-400"
      >
        {isPending ? "Tamamlanıyor..." : "Tamamla"}
      </button>
      {error ? <p className="text-xs font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
