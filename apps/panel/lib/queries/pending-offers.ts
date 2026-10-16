import { label, PROGRAMS, type Program } from "@/lib/constants";
import { formatTRY, tlToKurus } from "@/lib/money";
import { createServerSupabase } from "@/lib/supabase/server";

/** Yönetici onay kartında gösterilen teklif (bkz. components/offer-approval-list.tsx). */
export interface PendingOfferItem {
  id: string;
  leadId: string;
  parentName: string;
  childText: string;
  consultantName: string | null;
  programLabel: string;
  listPriceText: string;
  offeredPriceText: string;
  discountText: string;
  installmentCount: number;
  note: string | null;
  latestLeadNote: string | null;
}

interface ProfileJoin {
  full_name: string;
}

interface LeadJoin {
  id: string;
  parent_name: string;
  child_name: string | null;
  child_birth_month: number | null;
  child_birth_year: number | null;
}

interface PendingOfferRow {
  id: string;
  program: Program;
  list_price: number;
  offered_price: number;
  installment_count: number;
  note: string | null;
  lead?: LeadJoin | LeadJoin[] | null;
  creator?: ProfileJoin | ProfileJoin[] | null;
}

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

/** Liste fiyatına göre yüzde indirim (tam sayıya yuvarlanır, liste üstü 0). */
export function discountPercent(listPrice: number, offeredPrice: number) {
  if (listPrice <= 0 || offeredPrice >= listPrice) return 0;
  return Math.round(((listPrice - offeredPrice) / listPrice) * 100);
}

function childText(lead: LeadJoin) {
  const month = lead.child_birth_month?.toString().padStart(2, "0");
  const birth = [month, lead.child_birth_year].filter(Boolean).join("/");
  if (lead.child_name && birth) return `${lead.child_name} (${birth})`;
  if (lead.child_name) return lead.child_name;
  if (birth) return `Doğum: ${birth}`;
  return "Çocuk bilgisi yok";
}

/** Onay bekleyen teklifleri, velinin son notuyla birlikte yükler. */
export async function loadPendingOffers(limit?: number): Promise<{
  offers: PendingOfferItem[];
  count: number;
  error: boolean;
}> {
  const supabase = await createServerSupabase();
  let query = supabase
    .from("offers")
    .select(
      "id, program, list_price, offered_price, installment_count, note, lead:leads(id, parent_name, child_name, child_birth_month, child_birth_year), creator:profiles!offers_created_by_fkey(full_name)",
      { count: "exact" },
    )
    .eq("status", "onay_bekliyor")
    .order("created_at", { ascending: true });
  if (limit) query = query.limit(limit);

  const { data, error, count } = await query;
  if (error) return { offers: [], count: 0, error: true };

  const rows = (data ?? []) as unknown as PendingOfferRow[];
  const leadIds = rows.flatMap((row) => {
    const lead = one(row.lead);
    return lead ? [lead.id] : [];
  });

  const latestNotes = new Map<string, string>();
  if (leadIds.length > 0) {
    const { data: notes } = await supabase
      .from("lead_notes")
      .select("lead_id, body, created_at")
      .in("lead_id", leadIds)
      .order("created_at", { ascending: false });
    for (const note of notes ?? []) {
      if (!latestNotes.has(note.lead_id)) latestNotes.set(note.lead_id, note.body);
    }
  }

  const offers = rows.flatMap((row) => {
    const lead = one(row.lead);
    if (!lead) return [];
    const listPrice = Number(row.list_price);
    const offeredPrice = Number(row.offered_price);
    return [
      {
        id: row.id,
        leadId: lead.id,
        parentName: lead.parent_name,
        childText: childText(lead),
        consultantName: one(row.creator)?.full_name ?? null,
        programLabel: label(PROGRAMS, row.program),
        listPriceText: formatTRY(tlToKurus(listPrice)),
        offeredPriceText: formatTRY(tlToKurus(offeredPrice)),
        discountText: `%${discountPercent(listPrice, offeredPrice)}`,
        installmentCount: row.installment_count,
        note: row.note,
        latestLeadNote: latestNotes.get(lead.id) ?? null,
      } satisfies PendingOfferItem,
    ];
  });

  return { offers, count: count ?? offers.length, error: false };
}
