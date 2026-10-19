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
  onSuccess?: () => void;
}

const programKeys = Object.keys(PROGRAMS) as Program[];
const installmentOptions = Array.from({ length: 12 }, (_, index) => index + 1);

export function OfferForm({ leadId, priceItems, onSuccess }: OfferFormProps) {
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
      onSuccess?.();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Liste fiyatı veya üzeri teklif hemen onaylanır. Altındaysa yönetici onayına gider.
      </p>

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
            className="mt-2 block min-h-12 w-full rounded-xl border border-input bg-surface px-3 py-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-muted"
          >
            {priceItems.map((item) => (
              <option key={item.program} value={item.program}>
                {label(PROGRAMS, item.program)}
              </option>
            ))}
          </select>
          <p className="mt-2 text-sm text-muted-foreground tabular-nums">
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
            className="mt-2 block min-h-12 w-full rounded-xl border border-input bg-surface px-3 py-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-muted"
          >
            {installmentOptions.map((count) => (
              <option key={count} value={count}>
                {count} taksit
              </option>
            ))}
          </select>
        </div>
      </div>

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
          className="mt-2 block min-h-12 w-full rounded-xl border border-input bg-surface px-3 py-3 text-base outline-none transition-colors tabular-nums focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-muted"
        />
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
          className="mt-2 block min-h-12 w-full rounded-xl border border-input bg-surface px-3 py-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-muted"
          placeholder="Örn. kardeş indirimi talebi"
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-2xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending || priceItems.length === 0}
        className="min-h-14 w-full cursor-pointer rounded-xl bg-primary px-5 py-3 text-base font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Kaydediliyor..." : "Teklifi kaydet"}
      </button>
    </form>
  );
}
