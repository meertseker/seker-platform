"use client";

import { FormEvent, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addNote } from "@/actions/notes";

interface NoteFormProps {
  leadId: string;
  onSuccess?: () => void;
  rows?: number;
  /** Panel içinde tek ana buton olarak dolu gösterilir. */
  primary?: boolean;
}

const PRIMARY_BUTTON =
  "min-h-14 w-full cursor-pointer rounded-xl bg-primary px-5 py-3 text-base font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const OUTLINE_BUTTON =
  "min-h-12 w-full cursor-pointer rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto";

export function NoteForm({ leadId, onSuccess, rows = 3, primary = false }: NoteFormProps) {
  const router = useRouter();
  const fieldId = useId();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = String(formData.get("body") ?? "").trim();

    if (!body) {
      setError("Not boş olamaz.");
      return;
    }

    startTransition(async () => {
      const result = await addNote(leadId, body);
      if (result.error) {
        setError(result.error);
        return;
      }

      form.reset();
      router.refresh();
      onSuccess?.();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor={fieldId} className="text-sm font-medium text-foreground">
          Not
        </label>
        <textarea
          id={fieldId}
          name="body"
          rows={rows}
          disabled={isPending}
          placeholder="Görüşmede ne konuştunuz?"
          className="mt-2 block w-full resize-y rounded-xl border border-input bg-surface px-4 py-3 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-muted"
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className={primary ? PRIMARY_BUTTON : OUTLINE_BUTTON}
      >
        {isPending ? "Kaydediliyor..." : "Notu kaydet"}
      </button>
    </form>
  );
}
