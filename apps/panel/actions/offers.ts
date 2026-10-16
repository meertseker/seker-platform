"use server";

import { revalidatePath } from "next/cache";
import { updateLeadStatus } from "@/actions/leads";
import { notify } from "@/actions/notifications";
import { getSessionProfile } from "@/lib/auth";
import type { Program } from "@/lib/constants";
import { logEvent } from "@/lib/events";
import { tlToKurus } from "@/lib/money";
import { initialOfferStatus } from "@/lib/offer-rules";
import { createServerSupabase } from "@/lib/supabase/server";

type OfferDecision = "onaylandi" | "reddedildi";

interface OfferActionResult {
  error?: string;
  id?: string;
}

const programs: Program[] = ["tam_gun", "yarim_gun", "uc_gun", "play_grup"];

function validProgram(value: string): value is Program {
  return programs.includes(value as Program);
}

function normalizeMoney(value: number) {
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

function normalizeInstallmentCount(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 12) return null;
  return value;
}

function revalidateOfferViews(leadId: string) {
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/teklifler");
  revalidatePath("/pipeline");
  revalidatePath("/");
}

async function advanceLeadStatusAfterApproval(leadId: string) {
  try {
    await updateLeadStatus(leadId, "teklif");
  } catch {
    return;
  }
}

async function activeListPrice(program: Program) {
  const supabase = await createServerSupabase();
  const { data: activeList, error: listError } = await supabase
    .from("price_lists")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  if (listError || !activeList) return null;

  const { data: item, error: itemError } = await supabase
    .from("price_list_items")
    .select("monthly_fee")
    .eq("price_list_id", activeList.id)
    .eq("program", program)
    .maybeSingle();

  if (itemError || !item) return null;
  return Number(item.monthly_fee);
}

async function notifyManagers(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  leadId: string,
  offerId: string,
  offered: number,
) {
  const { data: managers } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "yonetici")
    .eq("is_active", true);

  await Promise.all(
    (managers ?? []).map((manager) =>
      notify(supabase, manager.id, "teklif_onay_bekliyor", {
        leadId,
        offerId,
        offered,
      }),
    ),
  );
}

async function supersedeApprovedOffers(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  leadId: string,
  newOfferId: string,
) {
  await supabase
    .from("offers")
    .update({
      status: "gecersiz",
      superseded_by_offer_id: newOfferId,
    })
    .eq("lead_id", leadId)
    .eq("status", "onaylandi")
    .neq("id", newOfferId);
}

export async function getApprovedOffer(leadId: string) {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("offers")
    .select("*")
    .eq("lead_id", leadId)
    .eq("status", "onaylandi")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data;
}

export async function createOffer(
  leadId: string,
  program: Program,
  offeredPriceTl: number,
  installmentCount: number,
  note?: string,
): Promise<OfferActionResult> {
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();

  if (!leadId) return { error: "Veli bulunamadı" };
  if (!validProgram(program)) return { error: "Geçerli bir program seçin" };

  const offeredPrice = normalizeMoney(offeredPriceTl);
  if (!offeredPrice) return { error: "Geçerli bir teklif tutarı girin" };

  const installments = normalizeInstallmentCount(installmentCount);
  if (!installments) return { error: "Taksit sayısı 1-12 arasında olmalı" };

  const listPrice = await activeListPrice(program);
  if (!listPrice) return { error: "Aktif fiyat listesinde bu program yok" };

  const status = initialOfferStatus(
    tlToKurus(offeredPrice),
    tlToKurus(listPrice),
  );

  const { data: offer, error } = await supabase
    .from("offers")
    .insert({
      lead_id: leadId,
      created_by: profile.id,
      program,
      list_price: listPrice,
      offered_price: offeredPrice,
      installment_count: installments,
      note: note?.trim() || null,
      status,
    })
    .select("id")
    .single();

  if (error?.code === "23505") {
    return { error: "Bu lead için zaten onay bekleyen bir teklif var" };
  }

  if (error || !offer) return { error: "Teklif kaydedilemedi" };

  if (status === "onaylandi") {
    await supersedeApprovedOffers(supabase, leadId, offer.id);
  } else {
    await notifyManagers(supabase, leadId, offer.id, offeredPrice);
  }

  await logEvent(supabase, {
    entityType: "offer",
    entityId: offer.id,
    eventType: "teklif_olusturuldu",
    actorId: profile.id,
    payload: { leadId, program, listPrice, offeredPrice, status },
  });

  await supabase
    .from("leads")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", leadId);

  revalidateOfferViews(leadId);
  return { id: offer.id };
}

export async function decideOffer(
  offerId: string,
  decision: OfferDecision,
  counterPriceTl?: number,
): Promise<OfferActionResult> {
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();

  if (profile.role !== "yonetici") return { error: "Bu işlem için yönetici yetkisi gerekir" };
  if (!offerId) return { error: "Teklif bulunamadı" };

  const { data: offer } = await supabase
    .from("offers")
    .select("id, lead_id, created_by, status")
    .eq("id", offerId)
    .maybeSingle();

  if (!offer) return { error: "Teklif bulunamadı" };
  if (offer.status !== "onay_bekliyor") {
    return { error: "Teklif zaten sonuçlandırılmış" };
  }

  const decidedAt = new Date().toISOString();

  if (counterPriceTl !== undefined) {
    const counterPrice = normalizeMoney(counterPriceTl);
    if (!counterPrice) return { error: "Geçerli bir karşı rakam girin" };

    const { data: updated, error } = await supabase
      .from("offers")
      .update({
        status: "revize_edildi",
        counter_price: counterPrice,
        decided_by: profile.id,
        decided_at: decidedAt,
      })
      .eq("id", offerId)
      .eq("status", "onay_bekliyor")
      .select("id")
      .maybeSingle();

    if (error) return { error: "Karşı rakam kaydedilemedi" };
    if (!updated) return { error: "Teklif zaten sonuçlandırılmış" };

    await logEvent(supabase, {
      entityType: "offer",
      entityId: offerId,
      eventType: "teklif_revize_edildi",
      actorId: profile.id,
      payload: { leadId: offer.lead_id, counterPrice },
    });
    await notify(supabase, offer.created_by, "teklif_revize_edildi", {
      leadId: offer.lead_id,
      offerId,
      counterPrice,
    });
    await supabase
      .from("leads")
      .update({ last_activity_at: decidedAt })
      .eq("id", offer.lead_id);
    revalidateOfferViews(offer.lead_id);
    return { id: offerId };
  }

  if (decision === "onaylandi") {
    await supersedeApprovedOffers(supabase, offer.lead_id, offerId);
  }

  const { data: updated, error } = await supabase
    .from("offers")
    .update({
      status: decision,
      decided_by: profile.id,
      decided_at: decidedAt,
    })
    .eq("id", offerId)
    .eq("status", "onay_bekliyor")
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      error:
        decision === "onaylandi"
          ? "Teklif onaylanamadı"
          : "Teklif reddedilemedi",
    };
  }
  if (!updated) {
    return { error: "Teklif zaten sonuçlandırılmış" };
  }

  const eventType =
    decision === "onaylandi" ? "teklif_onaylandi" : "teklif_reddedildi";
  const notificationType =
    decision === "onaylandi" ? "teklifiniz_onaylandi" : "teklif_reddedildi";

  await logEvent(supabase, {
    entityType: "offer",
    entityId: offerId,
    eventType,
    actorId: profile.id,
    payload: { leadId: offer.lead_id },
  });
  await notify(supabase, offer.created_by, notificationType, {
    leadId: offer.lead_id,
    offerId,
  });
  await supabase
    .from("leads")
    .update({ last_activity_at: decidedAt })
    .eq("id", offer.lead_id);

  if (decision === "onaylandi") {
    await advanceLeadStatusAfterApproval(offer.lead_id);
  }

  revalidateOfferViews(offer.lead_id);
  return { id: offerId };
}

export async function createOfferFromCounter(
  offerId: string,
): Promise<OfferActionResult> {
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();

  // Kaynak teklifi yalnızca event/log payload'ı ve lead_id için okuyoruz;
  // karar mantığının tamamı (geçerlilik kontrolleri, insert, supersede)
  // artık accept_counter_offer() SECURITY DEFINER RPC'sinde atomik olarak
  // yapılıyor — bkz. supabase/migrations/0002_offer_lead_guards.sql.
  // Danışman için doğrudan tablo yazımı iki yönden kırıktı: guard_offers_insert
  // decided_by dolu insert'i reddediyordu, ve kaynağın superseded_by_offer_id
  // güncellemesi hem RLS (upd_offers_danisman) hem guard_offers_danisman
  // tarafından reddediliyordu (status 'gecersiz' değilse). RPC bu ikisini de
  // transaction-local app.accept_counter bayrağıyla aşıyor.
  const { data: source } = await supabase
    .from("offers")
    .select("id, lead_id, program, list_price, counter_price")
    .eq("id", offerId)
    .maybeSingle();

  if (!source) return { error: "Revize teklif bulunamadı" };

  const { data: newOfferId, error } = await supabase.rpc(
    "accept_counter_offer",
    { source_offer_id: offerId },
  );

  if (error || !newOfferId) {
    return { error: error?.message || "Karşı rakamla teklif oluşturulamadı" };
  }

  await logEvent(supabase, {
    entityType: "offer",
    entityId: newOfferId,
    eventType: "teklif_olusturuldu",
    actorId: profile.id,
    payload: {
      leadId: source.lead_id,
      sourceOfferId: source.id,
      program: source.program,
      listPrice: Number(source.list_price),
      offeredPrice: Number(source.counter_price),
      status: "onaylandi",
    },
  });
  await supabase
    .from("leads")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", source.lead_id);
  await advanceLeadStatusAfterApproval(source.lead_id);

  revalidateOfferViews(source.lead_id);
  return { id: newOfferId };
}

/**
 * Yönetici "Karşı rakam" verdiğinde teklifi danışmana geri göndermek yerine
 * doğrudan karşı rakamla ONAYLI yeni teklif açar.
 *
 * Değişmezler korunur (bkz. 0002_offer_lead_guards.sql):
 *  1) Kaynak teklif önce 'onay_bekliyor' → 'revize_edildi' (counter_price ile)
 *     olarak kapatılır; lead başına tek bekleyen teklif kuralı bozulmaz.
 *  2) Yeni onaylı teklif accept_counter_offer() RPC'si ile atomik açılır:
 *     lead'in eski onaylı teklifleri 'gecersiz' olur, kaynağın
 *     superseded_by_offer_id'si yeni teklife bağlanır.
 * RPC başarısız olursa kaynak 'revize_edildi' olarak kalır ve danışman
 * mevcut "Karşı rakamla teklif oluştur" butonuyla devam edebilir.
 */
export async function approveOfferWithCounter(
  offerId: string,
  counterPriceTl: number,
): Promise<OfferActionResult> {
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();

  if (profile.role !== "yonetici") return { error: "Bu işlem için yönetici yetkisi gerekir" };
  if (!offerId) return { error: "Teklif bulunamadı" };

  const counterPrice = normalizeMoney(counterPriceTl);
  if (!counterPrice) return { error: "Geçerli bir karşı rakam girin" };

  const { data: offer } = await supabase
    .from("offers")
    .select("id, lead_id, created_by, status, program, list_price")
    .eq("id", offerId)
    .maybeSingle();

  if (!offer) return { error: "Teklif bulunamadı" };
  if (offer.status !== "onay_bekliyor") return { error: "Teklif zaten sonuçlandırılmış" };

  const decidedAt = new Date().toISOString();
  const { data: revised, error: reviseError } = await supabase
    .from("offers")
    .update({
      status: "revize_edildi",
      counter_price: counterPrice,
      decided_by: profile.id,
      decided_at: decidedAt,
    })
    .eq("id", offerId)
    .eq("status", "onay_bekliyor")
    .select("id")
    .maybeSingle();

  if (reviseError) return { error: "Karşı rakam kaydedilemedi" };
  if (!revised) return { error: "Teklif zaten sonuçlandırılmış" };

  await logEvent(supabase, {
    entityType: "offer",
    entityId: offerId,
    eventType: "teklif_revize_edildi",
    actorId: profile.id,
    payload: { leadId: offer.lead_id, counterPrice },
  });

  const { data: newOfferId, error: acceptError } = await supabase.rpc(
    "accept_counter_offer",
    { source_offer_id: offerId },
  );

  if (acceptError || !newOfferId) {
    await notify(supabase, offer.created_by, "teklif_revize_edildi", {
      leadId: offer.lead_id,
      offerId,
      counterPrice,
    });
    revalidateOfferViews(offer.lead_id);
    return {
      error:
        "Karşı rakam kaydedildi ama onaylı teklif açılamadı. Danışman veli sayfasından devam edebilir.",
    };
  }

  await logEvent(supabase, {
    entityType: "offer",
    entityId: newOfferId,
    eventType: "teklif_onaylandi",
    actorId: profile.id,
    payload: {
      leadId: offer.lead_id,
      sourceOfferId: offerId,
      program: offer.program,
      listPrice: Number(offer.list_price),
      offeredPrice: counterPrice,
      counter: true,
    },
  });
  await notify(supabase, offer.created_by, "teklif_karsi_onaylandi", {
    leadId: offer.lead_id,
    offerId: newOfferId,
    counterPrice,
  });
  await supabase
    .from("leads")
    .update({ last_activity_at: decidedAt })
    .eq("id", offer.lead_id);
  await advanceLeadStatusAfterApproval(offer.lead_id);

  revalidateOfferViews(offer.lead_id);
  revalidatePath("/bugun");
  return { id: newOfferId };
}
