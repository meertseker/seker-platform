"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phone } from "lucide-react";
import { logCallOutcome } from "@/actions/leads";
import { Sheet } from "@/components/sheet";
import {
  CALL_NEXT_STEPS,
  CALL_OUTCOMES,
  type CallNextStep,
  type CallOutcome,
} from "@/lib/call-outcome";

type CallButtonVariant = "primary" | "outline" | "icon";

interface CallButtonProps {
  leadId: string;
  phone: string;
  leadName?: string;
  label?: string;
  variant?: CallButtonVariant;
  className?: string;
}

const VARIANT_CLASS: Record<CallButtonVariant, string> = {
  primary:
    "min-h-14 gap-2 rounded-xl bg-primary px-5 py-3 text-base font-semibold text-on-primary hover:bg-primary-strong focus-visible:ring-offset-2",
  outline:
    "min-h-12 gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:text-foreground",
  icon: "size-12 rounded-xl border border-border bg-surface text-slate-700 hover:border-slate-300 hover:text-foreground",
};

const outcomeKeys = Object.keys(CALL_OUTCOMES) as CallOutcome[];
const nextKeys = Object.keys(CALL_NEXT_STEPS) as CallNextStep[];

/** Telefonla arar ve aynı anda "Görüşme nasıl geçti?" panelini açar. */
export function CallButton({
  leadId,
  phone,
  leadName,
  label = "Ara",
  variant = "outline",
  className = "",
}: CallButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [next, setNext] = useState<CallNextStep>("randevu");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setOutcome(null);
    setNext("randevu");
    setNote("");
    setError(null);
  }

  function close() {
    if (isPending) return;
    setOpen(false);
    reset();
  }

  function save() {
    if (!outcome) {
      setError("Görüşmenin nasıl geçtiğini seçin.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await logCallOutcome({
        leadId,
        outcome,
        note,
        next: outcome === "ulastim" ? next : null,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      reset();
      if (result.redirect) router.push(result.redirect);
      else router.refresh();
    });
  }

  return (
    <>
      <a
        href={`tel:${phone}`}
        onClick={() => setOpen(true)}
        aria-label={variant === "icon" ? `${leadName ?? "Veliyi"} ara` : undefined}
        title={variant === "icon" ? "Ara" : undefined}
        className={`inline-flex cursor-pointer items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${VARIANT_CLASS[variant]} ${className}`}
      >
        <Phone aria-hidden className={variant === "primary" ? "size-5" : "size-4"} />
        {variant === "icon" ? null : label}
      </a>

      <Sheet
        open={open}
        onClose={close}
        title="Görüşme nasıl geçti?"
        description={leadName ? `${leadName} · ${phone}` : phone}
      >
        <div className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Görüşme sonucu">
            {outcomeKeys.map((key) => {
              const selected = outcome === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={isPending}
                  onClick={() => setOutcome(key)}
                  className={`min-h-14 cursor-pointer rounded-xl border px-4 py-3 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected
                      ? "border-primary bg-primary-soft text-primary-strong"
                      : "border-border bg-surface text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {CALL_OUTCOMES[key]}
                </button>
              );
            })}
          </div>

          {outcome === "ulastim" ? (
            <div>
              <p className="text-sm font-medium text-foreground">Sıradaki adım</p>
              <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Sıradaki adım">
                {nextKeys.map((key) => {
                  const selected = next === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={isPending}
                      onClick={() => setNext(key)}
                      className={`min-h-12 cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
                        selected
                          ? "border-primary bg-primary text-on-primary"
                          : "border-border bg-surface text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      {CALL_NEXT_STEPS[key]}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {outcome === "yanlis" ? (
            <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm font-medium text-amber-900">
              Veli &quot;Kaybedildi (Ulaşılamadı)&quot; olarak işaretlenir.
            </p>
          ) : null}

          <div>
            <label htmlFor={`call-note-${leadId}`} className="text-sm font-medium text-foreground">
              Not (isteğe bağlı)
            </label>
            <textarea
              id={`call-note-${leadId}`}
              rows={2}
              value={note}
              disabled={isPending}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Örn. akşam 6'dan sonra aranmak istiyor"
              className="mt-2 block w-full resize-y rounded-xl border border-input bg-surface px-4 py-3 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-muted"
            />
          </div>

          {error ? (
            <p role="alert" className="rounded-xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={save}
            disabled={isPending || !outcome}
            className="min-h-14 w-full cursor-pointer rounded-xl bg-primary px-5 py-3 text-base font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </Sheet>
    </>
  );
}
