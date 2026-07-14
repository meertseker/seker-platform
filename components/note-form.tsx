"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addNote } from "@/actions/notes";

interface NoteFormProps {
  leadId: string;
}

export function NoteForm({ leadId }: NoteFormProps) {
  const router = useRouter();
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
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <div>
        <label htmlFor="note-body" className="text-sm font-medium text-foreground">
          Yeni not
        </label>
        <textarea
          id="note-body"
          name="body"
          rows={4}
          disabled={isPending}
          placeholder="Görüşme notunu yazın..."
          className="mt-2 block w-full resize-y rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted"
        />
      </div>

      {error ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="min-h-11 w-full cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {isPending ? "Ekleniyor..." : "Not Ekle"}
      </button>
    </form>
  );
}
