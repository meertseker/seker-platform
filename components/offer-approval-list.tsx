"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideOffer } from "@/actions/offers";
import type { Program } from "@/lib/constants";
import { parseTlInput } from "@/lib/tl-input";

export interface PendingOfferItem {
  id: string;
  leadId: string;
  parentName: string;
  childName: string | null;
  consultantName: string | null;
  program: Program;
  listPrice: number;
  offeredPrice: number;
  programLabel: string;
  listPriceText: string;
  offeredPriceText: string;
  discountText: string;
}

interface OfferApprovalListProps {
  offers: PendingOfferItem[];
}

export function OfferApprovalList({ offers }: OfferApprovalListProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [counterDrafts, setCounterDrafts] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  function submitDecision(
    offerId: string,
    decision: "onaylandi" | "reddedildi",
    counterPrice?: number,
  ) {
    setError(null);
    setPendingId(offerId);
    startTransition(async () => {
      const result = await decideOffer(offerId, decision, counterPrice);
      setPendingId(null);

      if (result.error) {
        setError(result.error);
        return;
      }

      setCounterDrafts((current) => {
        const next = { ...current };
        delete next[offerId];
        return next;
      });
      router.refresh();
    });
  }

  function submitCounter(offerId: string) {
    const counterPrice = parseTlInput(counterDrafts[offerId] ?? "");
    if (!counterPrice) {
      setError("Geçerli bir karşı rakam girin.");
      return;
    }
    submitDecision(offerId, "reddedildi", counterPrice);
  }

  if (offers.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
        Onay bekleyen teklif yok.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[1.4fr_1fr_0.9fr_0.9fr_0.7fr_1.8fr] gap-4 border-b border-zinc-200 bg-zinc-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 lg:grid">
          <span>Lead</span>
          <span>Danışman</span>
          <span>Liste</span>
          <span>Teklif</span>
          <span>İndirim</span>
          <span>Aksiyon</span>
        </div>

        <ul className="divide-y divide-zinc-200">
          {offers.map((offer) => {
            const isSaving = pendingId === offer.id && isPending;
            const child = offer.childName ?? "Çocuk bilgisi yok";

            return (
              <li
                key={offer.id}
                className="grid gap-4 px-5 py-4 lg:grid-cols-[1.4fr_1fr_0.9fr_0.9fr_0.7fr_1.8fr] lg:items-center"
              >
                <div>
                  <Link
                    href={`/leads/${offer.leadId}`}
                    className="font-semibold text-zinc-950 hover:underline"
                  >
                    {offer.parentName}
                  </Link>
                  <p className="mt-1 text-sm text-zinc-600">
                    {child} - {offer.programLabel}
                  </p>
                </div>

                <div className="text-sm font-medium text-zinc-700">
                  {offer.consultantName ?? "Atanmamış"}
                </div>

                <div className="text-sm font-semibold text-zinc-900">
                  {offer.listPriceText}
                </div>

                <div className="text-sm font-semibold text-zinc-900">
                  {offer.offeredPriceText}
                </div>

                <div className="text-sm font-semibold text-zinc-900">
                  {offer.discountText}
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => submitDecision(offer.id, "onaylandi")}
                      className="rounded-xl bg-green-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-green-300"
                    >
                      {isSaving ? "İşleniyor..." : "Onayla"}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => submitDecision(offer.id, "reddedildi")}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:border-red-300 disabled:cursor-not-allowed disabled:text-red-300"
                    >
                      Reddet
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={counterDrafts[offer.id] ?? ""}
                      disabled={isPending}
                      onChange={(event) =>
                        setCounterDrafts((current) => ({
                          ...current,
                          [offer.id]: event.target.value,
                        }))
                      }
                      placeholder="Karşı rakam"
                      className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 disabled:cursor-not-allowed disabled:bg-zinc-100"
                    />
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => submitCounter(offer.id)}
                      className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-400"
                    >
                      Gönder
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
