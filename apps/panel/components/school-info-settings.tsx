"use client";

import { useState, useTransition } from "react";
import { saveSchoolInfo } from "@/actions/school-info";

const MAX = 20_000;
const countFormatter = new Intl.NumberFormat("tr-TR");

/** Ayarlar → Okul bilgileri. AI konu önerileri bu metne dayanır; metin veliye ya da reklama gitmez. */
export function SchoolInfoSettings({ initialText }: { initialText: string }) {
  const [text, setText] = useState(initialText);
  const [saved, setSaved] = useState(initialText);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const dirty = text.trim() !== saved.trim();

  function handleSave() {
    setMessage(null);
    start(async () => {
      try {
        const res = await saveSchoolInfo(text);
        if ("error" in res) {
          setMessage({ kind: "error", text: res.error });
          return;
        }
        setSaved(text);
        setMessage({ kind: "ok", text: "Kaydedildi" });
      } catch {
        setMessage({ kind: "error", text: "Kaydedilemedi, tekrar deneyin." });
      }
    });
  }

  return (
    <section aria-labelledby="okul-bilgileri-baslik" className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
      <h2 id="okul-bilgileri-baslik" className="text-xl font-semibold text-foreground">
        Okul bilgileri
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Okulun tanıtım yazılarını, artılarını ve broşür metinlerini buraya yapıştırın. Görev verirken çıkan konu önerileri bu
        metne dayanır. Metin veliye ya da reklama gitmez.
      </p>
      <label htmlFor="okul-bilgileri" className="sr-only">
        Okul bilgileri metni
      </label>
      <textarea
        id="okul-bilgileri"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX}
        rows={14}
        placeholder="Örn. Bahçemiz 600 m². Her gün İngilizce. Kapıdan kapıya servis…"
        className="mt-3 block w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-base text-foreground outline-none placeholder:text-placeholder focus:border-primary focus:ring-2 focus:ring-primary/30"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || !dirty}
          className="min-h-11 cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </button>
        <span className="text-[13px] text-muted-foreground">
          {countFormatter.format(text.length)} / {countFormatter.format(MAX)} karakter
        </span>
        {message ? (
          <span
            role={message.kind === "error" ? "alert" : "status"}
            className={`text-sm font-medium ${message.kind === "error" ? "text-destructive-strong" : "text-accent"}`}
          >
            {message.text}
          </span>
        ) : null}
      </div>
    </section>
  );
}
