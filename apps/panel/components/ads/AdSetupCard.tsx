"use client";

// Z6 "Test ve Büyütme kampanyaları" kartı (K18): tek seferlik kurulum ya da "Sadece göster".

import { useState, useTransition } from "react";
import { setupMetaCampaigns } from "@/actions/ad-setup";
import type { AdSetup } from "@/lib/ads/ad-setup";
import { setupCardState } from "@/lib/ads/ad-template-form";
import type { SetupResult } from "@/lib/ads/setup-gate";
import { SetupResultNote } from "./SetupResultNote";

const card = "space-y-3 rounded-2xl border border-border bg-surface p-4 sm:p-6";
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function AdSetupCard({ setup, writeEnabled }: { setup: AdSetup | null; writeEnabled: boolean }) {
  const state = setupCardState(setup, writeEnabled);
  const [result, setResult] = useState<SetupResult | null>(null);
  const [pending, startTransition] = useTransition();
  const ready = state.label === "Hazır";

  function run(mode: "kur" | "goster") {
    if (pending) return;
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await setupMetaCampaigns({ mode }));
      } catch {
        setResult({ error: "İşlem yapılamadı, tekrar deneyin." });
      }
    });
  }

  return (
    <section aria-labelledby="ad-kurulum-baslik" className={card}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="ad-kurulum-baslik" className="text-base font-semibold text-foreground">
            Test ve Büyütme kampanyaları
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{state.sub}</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            ready ? "bg-accent-soft text-accent" : "bg-warning-soft text-warning"
          }`}
        >
          {state.label}
        </span>
      </div>

      {!ready && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => run("kur")}
            disabled={!state.canSetup || pending}
            className={`min-h-14 w-full cursor-pointer rounded-xl bg-primary px-6 text-base font-semibold text-on-primary transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${focus}`}
          >
            {pending ? "Bekleyin…" : "Kampanyaları kur"}
          </button>
          <button
            type="button"
            onClick={() => run("goster")}
            disabled={pending}
            className={`min-h-11 w-full cursor-pointer rounded-xl border border-input bg-surface px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${focus}`}
          >
            Sadece göster
          </button>
        </div>
      )}

      <div aria-live="polite">
        {result && "error" in result && (
          <div role="alert" className="text-sm font-semibold text-destructive">
            <p>{result.error}</p>
            {result.ids && Object.keys(result.ids).length > 0 && !Object.values(result.ids).every((id) => result.error.includes(id)) && (
              <p className="mt-1">Yarım kalan nesneler (hepsi DURAKLATILMIŞ): {Object.values(result.ids).join(", ")}</p>
            )}
          </div>
        )}
        {result && "ok" in result && result.status === "uygulanmadi_kapali" && <SetupResultNote summary={result.summary} message={result.message} />}
        {result && "ok" in result && result.status === "uygulandi" && (
          <p role="status" className="text-sm font-semibold text-accent">
            {result.message}
          </p>
        )}
      </div>
    </section>
  );
}
