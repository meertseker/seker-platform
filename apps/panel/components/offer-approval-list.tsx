"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { approveOfferWithCounter, decideOffer } from "@/actions/offers";
import { Sheet } from "@/components/sheet";
import type { PendingOfferItem } from "@/lib/queries/pending-offers";
import { parseTlInput } from "@/lib/tl-input";

export type { PendingOfferItem };

const BUTTON_BASE =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

/** Onay bekleyen tek teklif: veli, fiyatlar, notlar ve Onayla / Karşı rakam / Reddet. */
export function OfferApprovalCard({ offer }: { offer: PendingOfferItem }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [counterOpen, setCounterOpen] = useState(false);
  const [counterDraft, setCounterDraft] = useState("");
  const [counterError, setCounterError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function decide(decision: "onaylandi" | "reddedildi") {
    setError(null);
    startTransition(async () => {
      const result = await decideOffer(offer.id, decision);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function submitCounter() {
    const counterPrice = parseTlInput(counterDraft);
    if (!counterPrice) {
      setCounterError("Geçerli bir tutar girin.");
      return;
    }
    setCounterError(null);
    startTransition(async () => {
      const result = await approveOfferWithCounter(offer.id, counterPrice);
      if (result.error) {
        setCounterError(result.error);
        router.refresh();
        return;
      }
      setCounterOpen(false);
      setCounterDraft("");
      router.refresh();
    });
  }

  return (
    <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/leads/${offer.leadId}`}
            className="text-lg font-semibold text-foreground hover:underline"
          >
            {offer.parentName}
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">
            {offer.childText} · {offer.programLabel}
          </p>
        </div>
        {offer.consultantName ? (
          <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-slate-700">
            {offer.consultantName}
          </span>
        ) : null}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-muted px-3 py-2">
          <dt className="text-sm text-muted-foreground">Liste</dt>
          <dd className="text-base font-semibold tabular-nums text-foreground">{offer.listPriceText}</dd>
        </div>
        <div className="rounded-xl bg-primary-soft px-3 py-2">
          <dt className="text-sm text-muted-foreground">Teklif</dt>
          <dd className="text-base font-semibold tabular-nums text-primary">{offer.offeredPriceText}</dd>
        </div>
        <div className="rounded-xl bg-muted px-3 py-2">
          <dt className="text-sm text-muted-foreground">İndirim</dt>
          <dd className="text-base font-semibold tabular-nums text-foreground">{offer.discountText}</dd>
        </div>
        <div className="rounded-xl bg-muted px-3 py-2">
          <dt className="text-sm text-muted-foreground">Taksit</dt>
          <dd className="text-base font-semibold tabular-nums text-foreground">{offer.installmentCount}</dd>
        </div>
      </dl>

      {offer.note ? (
        <p className="mt-3 text-sm text-foreground">
          <span className="font-semibold">Teklif notu:</span> {offer.note}
        </p>
      ) : null}
      {offer.latestLeadNote ? (
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Son not:</span> {offer.latestLeadNote}
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={isPending}
          onClick={() => decide("onaylandi")}
          className={`${BUTTON_BASE} min-h-14 flex-1 bg-primary px-5 text-base text-on-primary hover:bg-primary-strong focus-visible:ring-offset-2`}
        >
          <Check aria-hidden className="size-5" />
          {isPending ? "İşleniyor..." : "Onayla"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setCounterError(null);
            setCounterOpen(true);
          }}
          className={`${BUTTON_BASE} min-h-14 flex-1 border border-border bg-surface px-5 text-base text-slate-700 hover:border-slate-300 hover:text-foreground`}
        >
          Karşı rakam
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => decide("reddedildi")}
          className={`${BUTTON_BASE} min-h-14 border border-red-200 bg-surface px-5 text-base text-red-700 hover:bg-destructive-soft focus-visible:ring-destructive`}
        >
          <X aria-hidden className="size-5" />
          Reddet
        </button>
      </div>

      <Sheet
        open={counterOpen}
        onClose={() => {
          if (!isPending) setCounterOpen(false);
        }}
        title="Karşı rakamla onayla"
        description={`${offer.parentName} · Teklif: ${offer.offeredPriceText} · Liste: ${offer.listPriceText}`}
      >
        <div className="space-y-4">
          <div>
            <label htmlFor={`counter-${offer.id}`} className="text-sm font-medium text-foreground">
              Onaylanacak aylık tutar (TL)
            </label>
            <input
              id={`counter-${offer.id}`}
              type="text"
              inputMode="decimal"
              value={counterDraft}
              disabled={isPending}
              onChange={(event) => setCounterDraft(event.target.value)}
              placeholder="Örn. 19000"
              className="mt-2 block min-h-12 w-full rounded-xl border border-border bg-surface px-4 py-3 text-base tabular-nums outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted"
            />
            <p className="mt-2 text-sm text-muted-foreground">
              Bu tutarla onaylı teklif açılır ve danışmana bildirim gider.
            </p>
          </div>
          {counterError ? (
            <p className="rounded-xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
              {counterError}
            </p>
          ) : null}
          <button
            type="button"
            disabled={isPending}
            onClick={submitCounter}
            className={`${BUTTON_BASE} min-h-14 w-full bg-primary px-5 text-base text-on-primary hover:bg-primary-strong focus-visible:ring-offset-2`}
          >
            {isPending ? "Kaydediliyor..." : "Bu rakamla onayla"}
          </button>
        </div>
      </Sheet>
    </article>
  );
}

export function OfferApprovalList({ offers }: { offers: PendingOfferItem[] }) {
  if (offers.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
        Onay bekleyen teklif yok.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {offers.map((offer) => (
        <OfferApprovalCard key={offer.id} offer={offer} />
      ))}
    </div>
  );
}
