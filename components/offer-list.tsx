"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOfferFromCounter } from "@/actions/offers";
import {
  label,
  OFFER_STATUSES,
  PROGRAMS,
  type OfferStatus,
  type Program,
} from "@/lib/constants";
import { badgeClass, OFFER_STATUS_STYLES } from "@/lib/status-styles";

export interface OfferListItem {
  id: string;
  program: Program;
  list_price: number;
  offered_price: number;
  installment_count: number;
  note: string | null;
  status: OfferStatus;
  counter_price: number | null;
  superseded_by_offer_id: string | null;
  created_at: string;
  creatorName: string | null;
  listPriceText: string;
  offeredPriceText: string;
  counterPriceText: string | null;
  createdAtText: string;
  discountText: string;
  counterAccepted: boolean;
}

interface OfferListProps {
  offers: OfferListItem[];
}

export function OfferList({ offers }: OfferListProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function createFromCounter(offerId: string) {
    setError(null);
    setPendingId(offerId);
    startTransition(async () => {
      const result = await createOfferFromCounter(offerId);
      setPendingId(null);

      if (result.error) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  if (offers.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
        Henüz teklif yok. İlk teklifi oluşturun.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-2xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <ul className="space-y-3">
        {offers.map((offer) => {
          const active = offer.status === "onaylandi";
          const isSaving = pendingId === offer.id && isPending;

          return (
            <li
              key={offer.id}
              className={`rounded-2xl border bg-surface p-4 shadow-sm ${
                active ? "border-emerald-300 ring-2 ring-emerald-100" : "border-border"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-foreground">
                      {label(PROGRAMS, offer.program)}
                    </h3>
                    {active ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                        Aktif teklif
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {offer.createdAtText}
                    {offer.creatorName ? ` - ${offer.creatorName}` : ""}
                  </p>
                </div>

                <span className={`w-fit ${badgeClass(OFFER_STATUS_STYLES[offer.status])}`}>
                  {label(OFFER_STATUSES, offer.status)}
                </span>
              </div>

              <dl className="mt-4 grid gap-3 sm:grid-cols-4">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Liste</dt>
                  <dd className="mt-1 text-sm font-semibold text-foreground tabular-nums">
                    {offer.listPriceText}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Teklif</dt>
                  <dd className="mt-1 text-sm font-semibold text-foreground tabular-nums">
                    {offer.offeredPriceText}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">İndirim</dt>
                  <dd className="mt-1 text-sm font-semibold text-foreground tabular-nums">
                    {offer.discountText}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Taksit</dt>
                  <dd className="mt-1 text-sm font-semibold text-foreground tabular-nums">
                    {offer.installment_count}
                  </dd>
                </div>
              </dl>

              {offer.note ? (
                <p className="mt-4 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                  {offer.note}
                </p>
              ) : null}

              {offer.status === "revize_edildi" && offer.counter_price ? (
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-warning-soft p-3">
                  <p className="text-sm font-medium text-amber-900 tabular-nums">
                    Karşı rakam: {offer.counterPriceText}
                  </p>
                  {offer.counterAccepted ? null : (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => createFromCounter(offer.id)}
                      className="min-h-11 cursor-pointer rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white transition-colors tabular-nums hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSaving
                        ? "Oluşturuluyor..."
                        : `Karşı rakamla teklif oluştur (${offer.counterPriceText})`}
                    </button>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
