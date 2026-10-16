import { redirect } from "next/navigation";
import {
  OfferApprovalList,
  type PendingOfferItem,
} from "@/components/offer-approval-list";
import { getSessionProfile } from "@/lib/auth";
import { label, PROGRAMS, type Program } from "@/lib/constants";
import { formatTRY, tlToKurus } from "@/lib/money";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface ProfileJoin {
  full_name: string;
}

interface LeadJoin {
  id: string;
  parent_name: string;
  child_name: string | null;
}

interface PendingOfferRow {
  id: string;
  program: Program;
  list_price: number;
  offered_price: number;
  lead?: LeadJoin | LeadJoin[] | null;
  creator?: ProfileJoin | ProfileJoin[] | null;
}

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function discountPercent(listPrice: number, offeredPrice: number) {
  if (listPrice <= 0 || offeredPrice >= listPrice) return 0;
  return Math.round(((listPrice - offeredPrice) / listPrice) * 100);
}

function normalizePendingOffers(rows: PendingOfferRow[]): PendingOfferItem[] {
  return rows.flatMap((row) => {
    const lead = one(row.lead);
    if (!lead) return [];
    const listPrice = Number(row.list_price);
    const offeredPrice = Number(row.offered_price);

    return [
      {
        id: row.id,
        leadId: lead.id,
        parentName: lead.parent_name,
        childName: lead.child_name,
        consultantName: one(row.creator)?.full_name ?? null,
        program: row.program,
        listPrice,
        offeredPrice,
        programLabel: label(PROGRAMS, row.program),
        listPriceText: formatTRY(tlToKurus(listPrice)),
        offeredPriceText: formatTRY(tlToKurus(offeredPrice)),
        discountText: `%${discountPercent(listPrice, offeredPrice)}`,
      },
    ];
  });
}

export default async function OffersApprovalPage() {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") redirect("/bugun");

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("offers")
    .select(
      "id, program, list_price, offered_price, lead:leads(id, parent_name, child_name), creator:profiles!offers_created_by_fkey(full_name)",
    )
    .eq("status", "onay_bekliyor")
    .order("created_at", { ascending: true });

  const offers = normalizePendingOffers((data ?? []) as unknown as PendingOfferRow[]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Teklif Onayları</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          İndirimli teklifler burada onaylanır, reddedilir veya karşı rakamla
          danışmana geri gönderilir.
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
