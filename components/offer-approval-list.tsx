"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
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
      <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
        Onay bekleyen teklif yok.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-2xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="hidden grid-cols-[1.4fr_1fr_0.9fr_0.9fr_0.7fr_1.8fr] gap-4 border-b border-border bg-muted px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
          <span>Lead</span>
          <span>Danışman</span>
          <span>Liste</span>
          <span>Teklif</span>
          <span>İndirim</span>
          <span>Aksiyon</span>
        </div>

        <ul className="divide-y divide-border">
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
                    className="font-semibold text-foreground hover:underline"
                  >
                    {offer.parentName}
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {child} - {offer.programLabel}
                  </p>
                </div>

                <div className="text-sm font-medium text-foreground">
                  <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                    Danışman:
                  </span>
                  {offer.consultantName ?? "Atanmamış"}
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-1 lg:contents">
                  <div className="text-sm font-semibold text-foreground tabular-nums">
                    <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                      Liste:
                    </span>
                    {offer.listPriceText}
                  </div>

                  <div className="text-sm font-semibold text-foreground tabular-nums">
                    <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                      Teklif:
                    </span>
                    {offer.offeredPriceText}
                  </div>

                  <div className="text-sm font-semibold text-foreground tabular-nums">
                    <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                      İndirim:
                    </span>
                    {offer.discountText}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => submitDecision(offer.id, "onaylandi")}
                      className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Check aria-hidden className="size-4" />
                      {isSaving ? "İşleniyor..." : "Onayla"}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => submitDecision(offer.id, "reddedildi")}
                      className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-red-200 bg-destructive-soft px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:border-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X aria-hidden className="size-4" />
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
                      className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors tabular-nums focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted"
                    />
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => submitCounter(offer.id)}
                      className="min-h-11 cursor-pointer rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
