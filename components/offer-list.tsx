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

function statusClass(status: OfferStatus) {
  switch (status) {
    case "onaylandi":
      return "bg-green-50 text-green-700 ring-green-200";
    case "onay_bekliyor":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "revize_edildi":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "reddedildi":
      return "bg-red-50 text-red-700 ring-red-200";
    default:
      return "bg-zinc-100 text-zinc-600 ring-zinc-200";
  }
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
      <p className="rounded-3xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
        Henüz teklif yok. İlk teklifi oluşturun.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
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
              className={`rounded-3xl border bg-white p-4 shadow-sm ${
                active ? "border-green-300 ring-2 ring-green-100" : "border-zinc-200"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-zinc-950">
                      {label(PROGRAMS, offer.program)}
                    </h3>
                    {active ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                        Aktif teklif
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-zinc-600">
                    {offer.createdAtText}
                    {offer.creatorName ? ` - ${offer.creatorName}` : ""}
                  </p>
                </div>

                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClass(
                    offer.status,
                  )}`}
                >
                  {label(OFFER_STATUSES, offer.status)}
                </span>
              </div>

              <dl className="mt-4 grid gap-3 sm:grid-cols-4">
                <div>
                  <dt className="text-xs font-medium text-zinc-500">Liste</dt>
                  <dd className="mt-1 text-sm font-semibold text-zinc-900">
                    {offer.listPriceText}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-zinc-500">Teklif</dt>
                  <dd className="mt-1 text-sm font-semibold text-zinc-900">
                    {offer.offeredPriceText}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-zinc-500">İndirim</dt>
                  <dd className="mt-1 text-sm font-semibold text-zinc-900">
                    {offer.discountText}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-zinc-500">Taksit</dt>
                  <dd className="mt-1 text-sm font-semibold text-zinc-900">
                    {offer.installment_count}
                  </dd>
                </div>
              </dl>

              {offer.note ? (
                <p className="mt-4 rounded-2xl bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                  {offer.note}
                </p>
              ) : null}

              {offer.status === "revize_edildi" && offer.counter_price ? (
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-medium text-amber-900">
                    Karşı rakam: {offer.counterPriceText}
                  </p>
                  {offer.counterAccepted ? null : (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => createFromCounter(offer.id)}
                      className="rounded-xl bg-amber-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-amber-400"
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
