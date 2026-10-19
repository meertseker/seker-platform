import { redirect } from "next/navigation";
import { OfferApprovalList } from "@/components/offer-approval-list";
import { getSessionProfile } from "@/lib/auth";
import { loadPendingOffers } from "@/lib/queries/pending-offers";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Teklifler" };

export const dynamic = "force-dynamic";

export default async function OffersApprovalPage() {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") redirect("/bugun");

  const { offers, error } = await loadPendingOffers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Teklif Onayları</h1>
        <p className="mt-2 text-base text-muted-foreground">
          İndirimli teklifleri onaylayın, reddedin ya da kendi rakamınızla onaylayın.
        </p>
      </div>

      {error ? (
        <p className="rounded-2xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
          Teklifler yüklenirken bir sorun oluştu.
        </p>
      ) : (
        <OfferApprovalList offers={offers} />
      )}
    </div>
  );
}
