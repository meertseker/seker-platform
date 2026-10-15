"use client";

import { useState, useTransition } from "react";
import { createFeedback } from "@/actions/feedback";
import { FEEDBACK_KINDS, type FeedbackKind } from "@/lib/constants";

const KIND_HINTS: Record<FeedbackKind, string> = {
  hata: "Bir şey çalışmıyor ya da yanlış görünüyor",
  oneri: "Olmasını istediğiniz yeni bir şey",
};

const inputClass =
  "min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function FeedbackForm() {
  const [kind, setKind] = useState<FeedbackKind>("hata");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        startTransition(async () => {
          const result = await createFeedback({
            kind,
            title: data.get("title"),
            body: data.get("body"),
            page: data.get("page"),
          });
          if (result.ok) {
            form.reset();
            setMessage({ ok: true, text: "Teşekkürler, geri bildiriminiz yöneticiye iletildi." });
          } else {
            setMessage({ ok: false, text: result.error });
          }
        });
      }}
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-foreground">Ne bildirmek istiyorsunuz?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(FEEDBACK_KINDS) as FeedbackKind[]).map((key) => (
            <label
              key={key}
              className={`flex min-h-16 cursor-pointer flex-col justify-center rounded-xl border-2 px-4 py-3 ${
                kind === key ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-muted"
              }`}
            >
              <input
                type="radio"
                name="kind"
                value={key}
                checked={kind === key}
                onChange={() => setKind(key)}
                className="sr-only"
              />
              <span className="text-sm font-semibold text-foreground">{FEEDBACK_KINDS[key]}</span>
              <span className="text-xs text-muted-foreground">{KIND_HINTS[key]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1">
        <label htmlFor="fb-title" className="text-sm font-medium text-foreground">Başlık</label>
        <input id="fb-title" name="title" required minLength={3} maxLength={120} className={inputClass} placeholder="Kısaca özetleyin" />
      </div>

      <div className="space-y-1">
        <label htmlFor="fb-body" className="text-sm font-medium text-foreground">Açıklama</label>
        <textarea
          id="fb-body"
          name="body"
          required
          maxLength={4000}
          rows={5}
          className={inputClass}
          placeholder="Ne yapıyordunuz, ne bekliyordunuz, ne oldu?"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="fb-page" className="text-sm font-medium text-foreground">
          Hangi ekranda? <span className="font-normal text-muted-foreground">(isteğe bağlı)</span>
        </label>
        <input id="fb-page" name="page" maxLength={200} className={inputClass} placeholder="Örn. Takvim, Ödemeler" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 cursor-pointer rounded-xl bg-primary px-5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Gönderiliyor…" : "Gönder"}
        </button>
        {message ? (
          <p role="status" className={`text-sm ${message.ok ? "text-muted-foreground" : "font-medium text-red-700"}`}>
            {message.text}
          </p>
        ) : null}
      </div>
    </form>
  );
}
