"use server";

import { revalidatePath } from "next/cache";
import {
  ITEM_TYPES,
  PAYMENT_METHODS,
  type ItemType,
  type PaymentMethod,
} from "@/lib/constants";
import { getSessionProfile } from "@/lib/auth";
import { generateInstallments, remainderInstallment } from "@/lib/installments";
import { logEvent } from "@/lib/events";
import { formatTRY, kurusToTl, tlToKurus } from "@/lib/money";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

const itemTypes = Object.keys(ITEM_TYPES) as ItemType[];
const paymentMethods = Object.keys(PAYMENT_METHODS) as PaymentMethod[];

function normalizeDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

function normalizeMoney(value: number) {
  if (!Number.isFinite(value)) return null;
  const kurus = tlToKurus(value);
  return kurus > 0 ? kurus : null;
}

function normalizePaidAt(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00+03:00`).toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function activeSeason(supabase: Supabase) {
  const { data, error } = await supabase
    .from("price_lists")
    .select("season")
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;
  return data.season as string;
}

async function studentPathForPlan(supabase: Supabase, planId: string) {
  const { data } = await supabase
    .from("payment_plans")
    .select("student_id")
    .eq("id", planId)
    .maybeSingle();

  return data?.student_id ? `/ogrenciler/${data.student_id}` : "/ogrenciler";
}

export async function createPaymentPlan(
  studentId: string,
  itemType: ItemType,
  totalTl: number,
  count: number,
  firstDueDate: string,
  sourceOfferId?: string,
) {
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();
  const totalKurus = normalizeMoney(totalTl);
  const dueDate = normalizeDate(firstDueDate);

  if (!studentId) return { error: "Öğrenci bulunamadı" };
  if (!itemTypes.includes(itemType)) return { error: "Geçerli bir kalem tipi seçin" };
  if (!totalKurus) return { error: "Toplam tutar 0'dan büyük olmalı" };
  if (!Number.isInteger(count) || count < 1 || count > 12) {
    return { error: "Taksit sayısı 1-12 arasında olmalı" };
  }
  if (!dueDate) return { error: "Geçerli bir ilk vade tarihi girin" };

  const season = await activeSeason(supabase);
  if (!season) return { error: "Aktif sezon bulunamadı" };

  let drafts;
  try {
    drafts = generateInstallments(totalKurus, count, dueDate);
  } catch {
    return { error: "Taksitler oluşturulamadı" };
  }

  const { data: plan, error: planError } = await supabase
    .from("payment_plans")
    .insert({
      student_id: studentId,
      season,
      item_type: itemType,
      total_amount: kurusToTl(totalKurus),
      installment_count: count,
      source_offer_id: sourceOfferId || null,
    })
    .select("id")
    .single();

  if (planError || !plan) return { error: "Ödeme planı oluşturulamadı" };

  const { error: installmentsError } = await supabase.from("installments").insert(
    drafts.map((draft) => ({
      plan_id: plan.id,
      due_date: draft.dueDate,
      amount: kurusToTl(draft.amountKurus),
    })),
  );

  if (installmentsError) {
    const cleanupClient = createAdminSupabase() ?? supabase;
    const cleanup = await cleanupClient.from("payment_plans").delete().eq("id", plan.id);
    return {
      error: cleanup.error
        ? "Taksitler oluşturulamadı; ödeme planı manuel kontrol edilmeli"
        : "Taksitler oluşturulamadı, ödeme planı geri alındı",
    };
  }

  await logEvent(supabase, {
    entityType: "student",
    entityId: studentId,
    eventType: "plan_olusturuldu",
    actorId: profile.id,
    payload: { planId: plan.id, itemType, totalTl: kurusToTl(totalKurus), count },
  });

  revalidatePath("/ogrenciler");
  revalidatePath(`/ogrenciler/${studentId}`);
  return { planId: plan.id };
}

export async function markInstallmentPaid(
  installmentId: string,
  paidTl: number,
  method: PaymentMethod,
  paidAtIso: string,
) {
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();
  const paidKurus = normalizeMoney(paidTl);
  const paidAt = normalizePaidAt(paidAtIso);

  if (!installmentId) return { error: "Taksit bulunamadı" };
  if (!paidKurus) return { error: "Ödenen tutar 0'dan büyük olmalı" };
  if (!paymentMethods.includes(method)) return { error: "Geçerli bir ödeme yöntemi seçin" };
  if (!paidAt) return { error: "Geçerli bir ödeme tarihi girin" };

  const { data: installment, error: installmentError } = await supabase
    .from("installments")
    .select("id, plan_id, due_date, amount, status")
    .eq("id", installmentId)
    .maybeSingle();

  if (installmentError || !installment) return { error: "Taksit bulunamadı" };
  if (installment.status !== "bekliyor") return { error: "Sadece bekleyen taksit ödenebilir" };

  const amountKurus = tlToKurus(Number(installment.amount));
  if (paidKurus > amountKurus) return { error: "Ödenen tutar taksit tutarını aşamaz" };

  let remainderId: string | null = null;
  const partial = paidKurus < amountKurus;

  if (partial) {
    const remainder = remainderInstallment(
      { dueDate: installment.due_date, amountKurus },
      paidKurus,
    );
    const { data: remainderRow, error: remainderError } = await supabase
      .from("installments")
      .insert({
        plan_id: installment.plan_id,
        due_date: remainder.dueDate,
        amount: kurusToTl(remainder.amountKurus),
      })
      .select("id")
      .single();

    if (remainderError || !remainderRow) return { error: "Kalan taksit oluşturulamadı" };
    remainderId = remainderRow.id;
  }

  const { error: updateError } = await supabase
    .from("installments")
    .update({
      amount: kurusToTl(paidKurus),
      status: "odendi",
      paid_at: paidAt,
      paid_amount: kurusToTl(paidKurus),
      payment_method: method,
      marked_by: profile.id,
    })
    .eq("id", installmentId);

  if (updateError) {
    const cleanupClient = createAdminSupabase() ?? supabase;
    const cleanup = remainderId
      ? await cleanupClient.from("installments").delete().eq("id", remainderId)
      : null;
    return {
      error: cleanup?.error
        ? "Taksit ödendi işaretlenemedi; kalan taksit manuel kontrol edilmeli"
        : "Taksit ödendi olarak işaretlenemedi",
    };
  }

  await logEvent(supabase, {
    entityType: "installment",
    entityId: installmentId,
    eventType: "taksit_odendi",
    actorId: profile.id,
    payload: { paidTl: kurusToTl(paidKurus), partial },
  });

  const studentPath = await studentPathForPlan(supabase, installment.plan_id);
  revalidatePath("/ogrenciler");
  revalidatePath(studentPath);
  return {};
}

export async function revertInstallment(installmentId: string) {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") return { error: "Bu işlem için yönetici yetkisi gerekir" };

  const supabase = await createServerSupabase();
  const { data: installment } = await supabase
    .from("installments")
    .select("id, plan_id, status")
    .eq("id", installmentId)
    .maybeSingle();

  if (!installment) return { error: "Taksit bulunamadı" };
  if (installment.status !== "odendi") return { error: "Sadece ödenmiş taksit geri alınabilir" };

  const { error } = await supabase
    .from("installments")
    .update({
      status: "bekliyor",
      paid_at: null,
      paid_amount: null,
      payment_method: null,
      marked_by: null,
    })
    .eq("id", installmentId);

  if (error) return { error: "Ödeme geri alınamadı" };

  await logEvent(supabase, {
    entityType: "installment",
    entityId: installmentId,
    eventType: "odeme_geri_alindi",
    actorId: profile.id,
    payload: {},
  });

  const studentPath = await studentPathForPlan(supabase, installment.plan_id);
  revalidatePath("/ogrenciler");
  revalidatePath(studentPath);
  return {};
}

export async function updateInstallment(
  installmentId: string,
  changes: { amountTl?: number; dueDate?: string },
) {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") return { error: "Bu işlem için yönetici yetkisi gerekir" };

  const supabase = await createServerSupabase();
  const { data: installment } = await supabase
    .from("installments")
    .select("id, plan_id, amount, due_date, plan:payment_plans!inner(total_amount)")
    .eq("id", installmentId)
    .maybeSingle();

  if (!installment) return { error: "Taksit bulunamadı" };

  const patch: Record<string, number | string> = {};
  let nextAmountKurus = tlToKurus(Number(installment.amount));

  if (changes.amountTl !== undefined) {
    const amountKurus = normalizeMoney(changes.amountTl);
    if (!amountKurus) return { error: "Taksit tutarı 0'dan büyük olmalı" };
    nextAmountKurus = amountKurus;
    patch.amount = kurusToTl(amountKurus);
  }

  if (changes.dueDate !== undefined) {
    const dueDate = normalizeDate(changes.dueDate);
    if (!dueDate) return { error: "Geçerli bir vade tarihi girin" };
    patch.due_date = dueDate;
  }

  if (Object.keys(patch).length === 0) return {};

  const { data: installments } = await supabase
    .from("installments")
    .select("id, amount")
    .eq("plan_id", installment.plan_id);

  const nextTotalKurus = (installments ?? []).reduce((sum, row) => {
    if (row.id === installmentId) return sum + nextAmountKurus;
    return sum + tlToKurus(Number(row.amount));
  }, 0);
  const plan = Array.isArray(installment.plan) ? installment.plan[0] : installment.plan;
  const planTotalKurus = tlToKurus(Number(plan.total_amount));
  const difference = nextTotalKurus - planTotalKurus;

  if (difference !== 0) {
    return {
      error: `Taksit toplamı plan toplamına eşit olmalı (fark: ${formatTRY(
        Math.abs(difference),
      )})`,
    };
  }

  const { error } = await supabase
    .from("installments")
    .update(patch)
    .eq("id", installmentId);

  if (error) return { error: "Taksit güncellenemedi" };

  const studentPath = await studentPathForPlan(supabase, installment.plan_id);
  revalidatePath("/ogrenciler");
  revalidatePath(studentPath);
  return {};
}
