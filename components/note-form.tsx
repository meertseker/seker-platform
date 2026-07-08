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
      className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div>
        <label htmlFor="note-body" className="text-sm font-medium text-zinc-800">
          Yeni not
        </label>
        <textarea
          id="note-body"
          name="body"
          rows={4}
          disabled={isPending}
          placeholder="Görüşme notunu yazın..."
          className="mt-2 block w-full resize-y rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 disabled:cursor-not-allowed disabled:bg-zinc-100"
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
        className="w-full rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 sm:w-auto"
      >
        {isPending ? "Ekleniyor..." : "Not Ekle"}
      </button>
    </form>
  );
}
