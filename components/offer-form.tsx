"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOffer } from "@/actions/offers";
import { label, PROGRAMS, type Program } from "@/lib/constants";
import { parseTlInput } from "@/lib/tl-input";

export interface ActivePriceItem {
  program: Program;
  monthly_fee: number;
  monthly_fee_text: string;
}

interface OfferFormProps {
  leadId: string;
  priceItems: ActivePriceItem[];
}

const programKeys = Object.keys(PROGRAMS) as Program[];
const installmentOptions = Array.from({ length: 12 }, (_, index) => index + 1);

export function OfferForm({ leadId, priceItems }: OfferFormProps) {
  const router = useRouter();
  const [selectedProgram, setSelectedProgram] = useState<Program>(
    priceItems[0]?.program ?? "tam_gun",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const pricesByProgram = useMemo(() => {
    return new Map(priceItems.map((item) => [item.program, item.monthly_fee_text]));
  }, [priceItems]);
  const selectedPriceText = pricesByProgram.get(selectedProgram);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const program = String(formData.get("program") ?? "") as Program;
    const offeredPrice = parseTlInput(String(formData.get("offeredPrice") ?? ""));
    const installmentCount = Number(formData.get("installmentCount"));
    const note = String(formData.get("note") ?? "");

    if (!programKeys.includes(program)) {
      setError("Program seçin.");
      return;
    }

    if (!offeredPrice) {
      setError("Geçerli bir teklif tutarı girin.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await createOffer(
        leadId,
        program,
        offeredPrice,
        installmentCount,
        note,
      );

      if (result.error) {
        setError(result.error);
        return;
      }

      form.reset();
      setSelectedProgram(priceItems[0]?.program ?? "tam_gun");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <div>
        <h3 className="text-lg font-semibold text-foreground">Yeni teklif</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Liste fiyatına eşit veya üzeri teklifler otomatik onaylanır.
        </p>
      </div>

      {priceItems.length === 0 ? (
        <p className="rounded-2xl bg-warning-soft px-4 py-3 text-sm font-medium text-amber-800">
          Aktif fiyat listesi bulunamadı. Teklif oluşturmak için önce fiyat
          listesi tanımlayın.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="offer-program" className="text-sm font-medium text-foreground">
            Program
          </label>
          <select
            id="offer-program"
            name="program"
            value={selectedProgram}
            disabled={isPending || priceItems.length === 0}
            onChange={(event) => setSelectedProgram(event.target.value as Program)}
            className="mt-2 block min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted"
          >
            {priceItems.map((item) => (
              <option key={item.program} value={item.program}>
                {label(PROGRAMS, item.program)}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-muted-foreground tabular-nums">
            Liste fiyatı: {selectedPriceText ?? "Yok"}
          </p>
        </div>

        <div>
          <label
            htmlFor="offer-installment-count"
            className="text-sm font-medium text-foreground"
          >
            Taksit
          </label>
          <select
            id="offer-installment-count"
            name="installmentCount"
            defaultValue="10"
            disabled={isPending || priceItems.length === 0}
            className="mt-2 block min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted"
          >
            {installmentOptions.map((count) => (
              <option key={count} value={count}>
                {count} taksit
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label
            htmlFor="offer-offered-price"
            className="text-sm font-medium text-foreground"
          >
            Teklif tutarı (aylık TL)
          </label>
          <input
            id="offer-offered-price"
            name="offeredPrice"
            type="text"
            inputMode="decimal"
            placeholder="Örn. 20000"
            disabled={isPending || priceItems.length === 0}
            className="mt-2 block min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm outline-none transition-colors tabular-nums focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted"
          />
        </div>

        <button
          type="submit"
          disabled={isPending || priceItems.length === 0}
          className="min-h-11 cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Kaydediliyor..." : "Teklif Oluştur"}
        </button>
      </div>

      <div>
        <label htmlFor="offer-note" className="text-sm font-medium text-foreground">
          Not (opsiyonel)
        </label>
        <textarea
          id="offer-note"
          name="note"
          rows={2}
          disabled={isPending || priceItems.length === 0}
          className="mt-2 block min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted"
          placeholder="Örn. kardeş indirimi talebi"
        />
      </div>

      {error ? (
        <p className="rounded-2xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}
