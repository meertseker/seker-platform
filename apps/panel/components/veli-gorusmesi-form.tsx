"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordVeliGorusmesi } from "@/actions/veli-gorusmesi";
import { parseTlInput } from "@/lib/tl-input";
import {
  CALL_OUTCOMES,
  CONTACT_WITH,
  NOTE_MAX,
  contactedAtInputValue,
  type CallOutcome,
  type ContactWith,
} from "@/lib/veli-gorusmesi";

const contactOptions = Object.keys(CONTACT_WITH) as ContactWith[];
const outcomeOptions = Object.keys(CALL_OUTCOMES) as CallOutcome[];

const inputClass =
  "mt-2 min-h-11 w-full rounded-xl border border-input bg-surface px-3 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30";

/**
 * "Görüşme ekle": borçlu veliyle yapılan görüşme (kiminle, sonuç, not, tarih). Sonuç "söz verdi" ise
 * söz tarihi zorunlu, tutar isteğe bağlı. Öğrenci sayfasında ve Gecikenler kartlarında kullanılır.
 */
export function VeliGorusmesiForm({ studentId, compact = false }: { studentId: string; compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [contactWith, setContactWith] = useState<ContactWith>("anne");
  const [outcome, setOutcome] = useState<CallOutcome>("ulasildi");
  const [note, setNote] = useState("");
  const [contactedAt, setContactedAt] = useState("");
  const [promiseDate, setPromiseDate] = useState("");
  const [promiseAmount, setPromiseAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    // Varsayılan an formun açıldığı an (İstanbul saati).
    if (!open) setContactedAt(contactedAtInputValue(new Date()));
    setError(null);
    setOpen((value) => !value);
  }

  function reset() {
    setOpen(false);
    setContactWith("anne");
    setOutcome("ulasildi");
    setNote("");
    setPromiseDate("");
    setPromiseAmount("");
  }

  function submit() {
    let promiseAmountTl: number | null = null;
    if (outcome === "soz_verdi") {
      if (!promiseDate) {
        setError("Söz verilen ödeme tarihini girin");
        return;
      }
      if (promiseAmount.trim()) {
        promiseAmountTl = parseTlInput(promiseAmount);
        if (promiseAmountTl === null || promiseAmountTl <= 0) {
          setError("Geçerli bir tutar girin ya da boş bırakın");
          return;
        }
      }
    }
    setError(null);
    startTransition(async () => {
      const result = await recordVeliGorusmesi(studentId, {
        contactWith,
        outcome,
        note,
        contactedAt,
        promiseDate: outcome === "soz_verdi" ? promiseDate : null,
        promiseAmountTl,
      });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      reset();
      router.refresh();
    });
  }

  return (
    <div className={compact ? "w-full" : undefined}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={`min-h-11 cursor-pointer rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          compact
            ? "w-full border border-border bg-surface text-foreground hover:bg-muted sm:w-auto"
            : "bg-primary text-on-primary hover:bg-primary-strong"
        }`}
      >
        {open ? "Vazgeç" : "Görüşme ekle"}
      </button>

      {open ? (
        <div className="mt-4 space-y-3 rounded-2xl border border-border bg-surface p-4 text-left">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm font-medium text-foreground">
              Kiminle
              <select value={contactWith} onChange={(e) => setContactWith(e.target.value as ContactWith)} className={inputClass}>
                {contactOptions.map((value) => (
                  <option key={value} value={value}>
                    {CONTACT_WITH[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-foreground">
              Sonuç
              <select value={outcome} onChange={(e) => setOutcome(e.target.value as CallOutcome)} className={inputClass}>
                {outcomeOptions.map((value) => (
                  <option key={value} value={value}>
                    {CALL_OUTCOMES[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-foreground">
              Görüşme zamanı
              <input
                type="datetime-local"
                value={contactedAt}
                onChange={(e) => setContactedAt(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          {outcome === "soz_verdi" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-foreground">
                Söz verilen ödeme tarihi
                <input type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} className={inputClass} />
              </label>
              <label className="block text-sm font-medium text-foreground">
                Söz verilen tutar (TL, isteğe bağlı)
                <input
                  inputMode="decimal"
                  value={promiseAmount}
                  onChange={(e) => setPromiseAmount(e.target.value)}
                  placeholder="Boşsa borcun tamamı"
                  className={`${inputClass} tabular-nums`}
                />
              </label>
              <p className="text-sm text-muted-foreground sm:col-span-2">
                Söz günü ödeme gelmemişse görüşmeyi kaydeden kişiye “ödeme geldi mi?” görevi açılır.
              </p>
            </div>
          ) : null}

          <label className="block text-sm font-medium text-foreground">
            Not
            <textarea
              rows={4}
              maxLength={NOTE_MAX}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Görüşmede ne konuşuldu? WhatsApp'taki metni yapıştırabilirsiniz."
              className="mt-2 block w-full resize-y rounded-2xl border border-input bg-surface px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </label>

          {error ? (
            <p role="alert" className="rounded-xl bg-destructive-soft px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="min-h-11 w-full cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {isPending ? "Kaydediliyor…" : "Görüşmeyi kaydet"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
