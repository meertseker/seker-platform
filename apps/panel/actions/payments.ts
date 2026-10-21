"use server";

import { revalidatePath } from "next/cache";
import {
  ITEM_TYPES,
  PAYMENT_METHODS,
  type ItemType,
  type PaymentMethod,
} from "@/lib/constants";
import { getSessionProfile } from "@/lib/auth";
import { generateInstallments } from "@/lib/installments";
import { allocatePayment } from "@/lib/payment-allocation";
import {
  buildSettlement,
  plansAfterPayment,
  type PaymentOp,
  type PlanBeforePayment,
} from "@/lib/payment-settlement";
import { parseRevertPreview, revertConfirmText } from "@/lib/payment-revert";
import { buildCorrectionOps, type CorrectionTarget } from "@/lib/payment-correction";
import { collectedDay, collectedKurus } from "@/lib/queries/money";
import { ALREADY_PAID, PAID_AMOUNT_LOCKED, planTotalMismatchMessage } from "@/lib/payment-messages";
import { istanbulDateString } from "@/lib/lead-flow/business-hours";
import { applyPaymentDay, type PaymentDay } from "@/lib/payment-day";
import { buildEnrollmentPlans, seasonLastMonth } from "@/lib/enrollment-plan";
import { kickWaFlush, logEvent } from "@/lib/events";
import { shouldStartTentative, tentativeStart } from "@/lib/price-increase";
import { kurusToTl, tlToKurus } from "@/lib/money";
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

/** Zam henüz girilmemiş sezonda açılan yeni aidat planı "kesinleşmedi" başlar. */
async function tentativeFromForNewPlan(
  supabase: Supabase,
  season: string,
  itemType: string,
  lastDueDate: string,
) {
  if (itemType !== "aidat" || lastDueDate < tentativeStart(season)) return null;
  const { data } = await supabase
    .from("payment_plans")
    .select("id, student:students!inner(status)")
    .eq("item_type", "aidat")
    .eq("season", season)
    .not("tentative_from", "is", null)
    .eq("student.status", "aktif")
    .limit(1);
  return shouldStartTentative(itemType, lastDueDate, season, (data ?? []).length > 0) ? tentativeStart(season) : null;
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

  const tentativeFrom = await tentativeFromForNewPlan(supabase, season, itemType, drafts[drafts.length - 1].dueDate);
  const { data: plan, error: planError } = await supabase
    .from("payment_plans")
    .insert({
      student_id: studentId,
      season,
      item_type: itemType,
      tentative_from: tentativeFrom,
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
  revalidatePath("/odemeler");
  revalidatePath(`/ogrenciler/${studentId}`);
  return { planId: plan.id };
}

/** RPC'nin kendi (Türkçe) hata mesajı kullanıcıya gösterilir; beklenmeyen hata genel mesajla. */
function rpcErrorMessage(error: { code?: string; message?: string } | null, fallback: string) {
  if (!error) return fallback;
  const known = ["P0001", "P0002", "22023", "42501"];
  return error.code && known.includes(error.code) && error.message ? error.message : fallback;
}

/** Taksit tablosu / matris "Geri al" onayı: neyin geri alınacağını söyler, değiştirmez. */
export async function previewInstallmentRevert(installmentId: string) {
  await getSessionProfile();
  const supabase = await createServerSupabase();
  if (!installmentId) return { error: "Taksit bulunamadı" };
  const { data, error } = await supabase.rpc("preview_installment_revert", { p_installment_id: installmentId });
  if (error || !data) return { error: rpcErrorMessage(error, "Ödeme bilgisi okunamadı") };
  const preview = parseRevertPreview(data);
  if (!preview) return { error: "Ödeme bilgisi okunamadı" };
  return { preview, text: revertConfirmText(preview) };
}

/**
 * Ödenmiş taksiti geri alır. Taksiti ödeyen `odeme_alindi` olayı varsa o ödemenin
 * tamamı geri alınır (undo_payment: tutar, kalan, olay); yoksa (içe aktarma) yalnız
 * durum geri alınır ve olaya yazılır. Tek işlem: revert_installment_payment RPC.
 */
export async function revertInstallment(installmentId: string) {
  await getSessionProfile();
  const supabase = await createServerSupabase();
  if (!installmentId) return { error: "Taksit bulunamadı" };
  const { data, error } = await supabase.rpc("revert_installment_payment", { p_installment_id: installmentId });
  if (error) return { error: rpcErrorMessage(error, "Ödeme geri alınamadı") };
  kickWaFlush();

  const studentId = (data as { studentId?: string } | null)?.studentId;
  revalidatePath("/ogrenciler");
  revalidatePath("/odemeler");
  revalidatePath("/odemeler/gecikenler");
  revalidatePath("/bugun");
  if (studentId) revalidatePath(`/ogrenciler/${studentId}`);
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
    .select("id, plan_id, amount, due_date, status, plan:payment_plans!inner(total_amount)")
    .eq("id", installmentId)
    .maybeSingle();

  if (!installment) return { error: "Taksit bulunamadı" };

  const currentKurus = tlToKurus(Number(installment.amount));
  const patch: { amount?: number; due_date?: string } = {};
  let nextAmountKurus = currentKurus;

  if (changes.amountTl !== undefined) {
    const amountKurus = normalizeMoney(changes.amountTl);
    if (!amountKurus) return { error: "Taksit tutarı 0'dan büyük olmalı" };
    if (amountKurus !== currentKurus) {
      if (installment.status === "odendi") {
        return { error: PAID_AMOUNT_LOCKED };
      }
      if (installment.status !== "bekliyor") return { error: "Yalnız bekleyen taksitin tutarı değiştirilebilir" };
      nextAmountKurus = amountKurus;
      patch.amount = kurusToTl(amountKurus);
    }
  }

  if (changes.dueDate !== undefined) {
    const dueDate = normalizeDate(changes.dueDate);
    if (!dueDate) return { error: "Geçerli bir vade tarihi girin" };
    if (dueDate !== installment.due_date) patch.due_date = dueDate;
  }

  // Değişiklik yoksa olay da yok (WhatsApp'a boş "güncellendi" gitmesin).
  if (Object.keys(patch).length === 0) return {};

  if (patch.amount !== undefined) {
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
      return { error: planTotalMismatchMessage(difference) };
    }
  }

  // Okunduğu durumdayken güncellenir: arada ödenen taksitin tutarı değişmez.
  const { data: updated, error } = await supabase
    .from("installments")
    .update(patch)
    .eq("id", installmentId)
    .eq("status", installment.status)
    .select("id");

  if (error) return { error: "Taksit güncellenemedi" };
  if (!updated || updated.length !== 1) return { error: "Taksit az önce değişti; sayfayı yenileyip tekrar deneyin" };

  await logEvent(supabase, {
    entityType: "installment",
    entityId: installmentId,
    eventType: "taksit_guncellendi",
    actorId: profile.id,
    payload: {
      fromTl: Number(installment.amount),
      toTl: kurusToTl(nextAmountKurus),
      fromDueDate: installment.due_date,
      toDueDate: patch.due_date ?? installment.due_date,
    },
  });

  const studentPath = await studentPathForPlan(supabase, installment.plan_id);
  revalidatePath("/ogrenciler");
  revalidatePath("/odemeler");
  revalidatePath(studentPath);
  return {};
}

export interface TakePaymentInput {
  studentId: string;
  installmentIds: string[];
  /** Parça kendi gününü taşıyabilir (farklı günlerde ödenen iki yöntem); yoksa `paidOn`. */
  payments: { method: PaymentMethod; amountTl: number; paidOn?: string }[];
  /** "YYYY-MM-DD" (İstanbul günü). */
  paidOn: string;
  note?: string;
  /** Eksik ödemede kalanın taksitleri; yoksa kalan aynı vadeyle tek taksit bekler. */
  remainder?: { count: number; firstDueDate: string };
}

/**
 * Tek seferde ödeme: bir ya da birkaç taksit, bir ya da iki yöntem.
 * Dağıtım `allocatePayment` ile; işlem ve geri alma bilgisi tek bir
 * `odeme_alindi` olayına yazılır (not da burada durur).
 */
export async function takePayment(input: TakePaymentInput) {
  await getSessionProfile();
  const supabase = await createServerSupabase();
  const paidOn = normalizeDate(input.paidOn);
  const paidAt = paidOn ? normalizePaidAt(paidOn) : null;
  const note = (input.note ?? "").trim().slice(0, 500);

  if (!input.studentId) return { error: "Öğrenci bulunamadı" };
  if (!paidOn || !paidAt) return { error: "Geçerli bir ödeme tarihi girin" };
  const today = istanbulDateString(new Date());
  if (paidOn > today) return { error: "Ödeme tarihi bugünden ileri olamaz" };
  if (input.payments.length === 0 || input.payments.length > 2) {
    return { error: "Bir ya da iki ödeme yöntemi girin" };
  }
  for (const part of input.payments) {
    if (!paymentMethods.includes(part.method)) return { error: "Geçerli bir ödeme yöntemi seçin" };
    if (!Number.isFinite(part.amountTl) || part.amountTl < 0) return { error: "Geçerli bir tutar girin" };
    if (part.paidOn !== undefined) {
      if (!normalizeDate(part.paidOn)) return { error: "Geçerli bir ödeme tarihi girin" };
      if (part.paidOn > today) return { error: "Ödeme tarihi bugünden ileri olamaz" };
    }
  }
  // Ödemenin gününden farklı günde ödenen parça kendi tarihini taşır.
  const partDay = (part: { paidOn?: string }) => (part.paidOn && part.paidOn !== paidOn ? part.paidOn : undefined);

  const { data: rows, error: rowsError } = await supabase
    .from("installments")
    .select("id, plan_id, due_date, amount, status, plan:payment_plans!inner(student_id)")
    .in("id", input.installmentIds);
  if (rowsError || !rows || rows.length !== input.installmentIds.length) {
    return { error: "Taksitler bulunamadı" };
  }
  type Row = {
    id: string;
    plan_id: string;
    due_date: string;
    amount: number;
    status: string;
    plan: { student_id: string } | { student_id: string }[];
  };
  const typed = rows as unknown as Row[];
  for (const row of typed) {
    const plan = Array.isArray(row.plan) ? row.plan[0] : row.plan;
    if (plan?.student_id !== input.studentId) return { error: "Taksit bu öğrenciye ait değil" };
    if (row.status !== "bekliyor") return { error: ALREADY_PAID };
  }

  const result = allocatePayment(
    typed.map((row) => ({ id: row.id, dueDate: row.due_date, amountKurus: tlToKurus(Number(row.amount)) })),
    input.payments.map((part) => ({ method: part.method, kurus: tlToKurus(part.amountTl), paidOn: partDay(part) })),
  );
  if (!result.ok) return { error: result.error };

  let remainderPlan: { count: number; firstDueDate: string } | null = null;
  if (input.remainder) {
    const firstDueDate = normalizeDate(input.remainder.firstDueDate);
    const count = input.remainder.count;
    if (!firstDueDate || !Number.isInteger(count) || count < 1 || count > 12) {
      return { error: "Kalanın taksitleri için geçerli sayı ve tarih girin" };
    }
    remainderPlan = { count, firstDueDate };
  }

  const byId = new Map(typed.map((row) => [row.id, row]));
  const ops: PaymentOp[] = result.allocations.map((allocation) => {
    const row = byId.get(allocation.installmentId)!;
    const remainders =
      allocation.remainderKurus > 0
        ? remainderPlan
          ? generateInstallments(allocation.remainderKurus, remainderPlan.count, remainderPlan.firstDueDate)
          : [{ dueDate: row.due_date, amountKurus: allocation.remainderKurus }]
        : [];
    return {
      id: row.id,
      planId: row.plan_id,
      amount: Number(row.amount),
      parts: allocation.parts.map((part) =>
        part.paidOn
          ? { amount: kurusToTl(part.kurus), method: part.method, paidAt: normalizePaidAt(part.paidOn)! }
          : { amount: kurusToTl(part.kurus), method: part.method },
      ),
      remainders: remainders.map((draft) => ({ dueDate: draft.dueDate, amount: kurusToTl(draft.amountKurus) })),
    };
  });

  // Ödeme anındaki durum (taksit tamamlandı mı, planda ne kaldı) olaya yazılır;
  // sonraki geri alma ya da taksitlendirme WhatsApp mesajını değiştirmez.
  // Yazım tek işlemde (RPC) olduğundan durum, ödeme öncesi okunan planlardan hesaplanır.
  const { data: planRows } = await supabase
    .from("payment_plans")
    .select("id, item_type, tentative_from, installments(id, due_date, amount, status)")
    .in("id", [...new Set(typed.map((row) => row.plan_id))])
    .eq("installments.status", "bekliyor");
  const settlement = planRows
    ? buildSettlement({
        allocations: result.allocations,
        planOf: new Map(typed.map((row) => [row.id, row.plan_id])),
        remainder: remainderPlan,
        plans: plansAfterPayment(planRows as unknown as PlanBeforePayment[], ops),
      })
    : null;

  const methods = [...new Set(result.allocations.flatMap((a) => a.parts.map((p) => p.method)))];
  const { data, error } = await supabase.rpc("take_payment", {
    p_student_id: input.studentId,
    p_paid_at: paidAt,
    p_ops: ops.map(({ id, amount, parts, remainders }) => ({ id, amount, parts, remainders })),
    p_payload: {
      paidOn,
      methods,
      // Her parçanın tutarı, yöntemi ve günü (ödeme geçmişi ve WhatsApp mesajı).
      parts: input.payments
        .filter((part) => part.amountTl > 0)
        .map((part) => ({ amountTl: part.amountTl, method: part.method, paidOn: part.paidOn ?? paidOn })),
      note: note || null,
      ...(settlement ?? {}),
    },
  });
  if (error || !data) return { error: rpcErrorMessage(error, "Ödeme kaydedilemedi, hiçbir değişiklik yapılmadı") };
  kickWaFlush();

  revalidatePath("/ogrenciler");
  revalidatePath("/odemeler");
  revalidatePath("/bugun");
  revalidatePath(`/ogrenciler/${input.studentId}`);
  const saved = data as { eventId?: string; totalTl?: number | string };
  return { eventId: saved.eventId ?? null, totalTl: Number(saved.totalTl ?? kurusToTl(result.totalKurus)) };
}

/**
 * "Ödeme al"ın geri alınması (undo_payment RPC): oluşturulan satırlar silinir, taksitler eski
 * hâline döner, olay undone olur. Sonradan kalan ödendiyse ya da değiştiyse reddedilir.
 * Danışman kendi ödemesini 15 dakika içinde geri alabilir (kural RPC'de).
 */
export async function undoPayment(eventId: string) {
  await getSessionProfile();
  const supabase = await createServerSupabase();
  if (!eventId) return { error: "Ödeme kaydı bulunamadı" };
  const { data, error } = await supabase.rpc("undo_payment", { p_event_id: eventId });
  if (error) return { error: rpcErrorMessage(error, "Ödeme geri alınamadı") };
  kickWaFlush();

  const studentId = (data as { studentId?: string } | null)?.studentId;
  revalidatePath("/ogrenciler");
  revalidatePath("/odemeler");
  revalidatePath("/bugun");
  if (studentId) revalidatePath(`/ogrenciler/${studentId}`);
  return {};
}

/** WhatsApp hatırlatması gönderildi izi: kim, ne zaman, hangi taksitler. */
export async function logPaymentReminder(studentId: string, installmentIds: string[]) {
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();
  if (!studentId) return { error: "Öğrenci bulunamadı" };
  await logEvent(supabase, {
    entityType: "student",
    entityId: studentId,
    eventType: "odeme_hatirlatildi",
    actorId: profile.id,
    payload: { installmentIds },
  });
  revalidatePath("/odemeler");
  revalidatePath("/odemeler/gecikenler");
  revalidatePath(`/ogrenciler/${studentId}`);
  return {};
}

export interface EnrollmentPlanInput {
  studentId: string;
  aidatMode: "aylik" | "pesin";
  monthlyTl?: number;
  firstMonthTl?: number | null;
  annualTl?: number;
  firstDueDate: string;
  kitapTl?: number | null;
  kitapCount?: number;
  sourceOfferId?: string;
}

/** Kayıt planı: aidat (aylık / peşin) ve kitap - kırtasiye tek seferde. */
export async function createEnrollmentPlan(input: EnrollmentPlanInput) {
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();
  if (!input.studentId) return { error: "Öğrenci bulunamadı" };

  const season = await activeSeason(supabase);
  const lastMonth = season ? seasonLastMonth(season) : null;
  if (!season || !lastMonth) return { error: "Aktif sezon bulunamadı" };

  const toKurus = (value: number | null | undefined) =>
    value === null || value === undefined || !Number.isFinite(value) ? undefined : tlToKurus(value);
  const built = buildEnrollmentPlans({
    aidatMode: input.aidatMode,
    monthlyKurus: toKurus(input.monthlyTl),
    firstMonthKurus: toKurus(input.firstMonthTl) ?? null,
    annualKurus: toKurus(input.annualTl),
    firstDueDate: input.firstDueDate,
    lastMonth,
    kitapKurus: toKurus(input.kitapTl) ?? null,
    kitapCount: input.kitapCount,
  });
  if (!built.ok) return { error: built.error };

  const createdPlanIds: string[] = [];
  const cleanupClient = createAdminSupabase() ?? supabase;
  for (const draft of built.plans) {
    const tentativeFrom = await tentativeFromForNewPlan(
      supabase,
      season,
      draft.itemType,
      draft.installments[draft.installments.length - 1].dueDate,
    );
    const { data: plan, error: planError } = await supabase
      .from("payment_plans")
      .insert({
        student_id: input.studentId,
        season,
        item_type: draft.itemType,
        tentative_from: tentativeFrom,
        total_amount: kurusToTl(draft.totalKurus),
        installment_count: draft.installmentCount,
        source_offer_id: draft.itemType === "aidat" ? input.sourceOfferId || null : null,
      })
      .select("id")
      .single();
    if (planError || !plan) {
      if (createdPlanIds.length) await cleanupClient.from("payment_plans").delete().in("id", createdPlanIds);
      return { error: "Ödeme planı oluşturulamadı" };
    }
    createdPlanIds.push(plan.id);
    const { error: installmentsError } = await supabase.from("installments").insert(
      draft.installments.map((item) => ({
        plan_id: plan.id,
        due_date: item.dueDate,
        amount: kurusToTl(item.amountKurus),
      })),
    );
    if (installmentsError) {
      await cleanupClient.from("payment_plans").delete().in("id", createdPlanIds);
      return { error: "Taksitler oluşturulamadı, plan geri alındı" };
    }
    await logEvent(supabase, {
      entityType: "student",
      entityId: input.studentId,
      eventType: "plan_olusturuldu",
      actorId: profile.id,
      payload: {
        planId: plan.id,
        itemType: draft.itemType,
        totalTl: kurusToTl(draft.totalKurus),
        count: draft.installmentCount,
      },
    });
  }

  revalidatePath("/ogrenciler");
  revalidatePath("/odemeler");
  revalidatePath(`/ogrenciler/${input.studentId}`);
  return {};
}

/**
 * Taksitlendir: aynı plandaki bekleyen taksitlerin toplamı yeni sayıda aylık taksite
 * bölünür (ör. kırtasiye kalanı 3 taksit, ilki Kasım). Plan toplamı değişmez.
 * Ekleme, silme ve ödeme olayının kalan listesi tek işlemde (reschedule_installments RPC).
 */
export async function rescheduleInstallments(installmentIds: string[], count: number, firstDueDate: string) {
  await getSessionProfile();
  const supabase = await createServerSupabase();
  const dueDate = normalizeDate(firstDueDate);
  if (installmentIds.length === 0) return { error: "Taksit seçin" };
  if (!Number.isInteger(count) || count < 1 || count > 12) return { error: "Taksit sayısı 1-12 arasında olmalı" };
  if (!dueDate) return { error: "Geçerli bir ilk vade girin" };

  const { data: rows } = await supabase
    .from("installments")
    .select("id, plan_id, amount, status")
    .in("id", installmentIds);
  type Row = { id: string; plan_id: string; amount: number; status: string };
  const typed = (rows ?? []) as unknown as Row[];
  if (typed.length !== installmentIds.length) return { error: "Taksitler bulunamadı" };
  if (typed.some((row) => row.status !== "bekliyor")) return { error: "Yalnız bekleyen taksitler taksitlendirilebilir" };
  if (typed.some((row) => row.plan_id !== typed[0].plan_id)) return { error: "Taksitler aynı kaleme ait olmalı" };

  const totalKurus = typed.reduce((sum, row) => sum + tlToKurus(Number(row.amount)), 0);
  const drafts = generateInstallments(totalKurus, count, dueDate);
  const { data, error } = await supabase.rpc("reschedule_installments", {
    p_ids: installmentIds,
    p_drafts: drafts.map((draft) => ({ dueDate: draft.dueDate, amount: kurusToTl(draft.amountKurus) })),
  });
  if (error || !data) return { error: rpcErrorMessage(error, "Taksitlendirilemedi, hiçbir değişiklik yapılmadı") };
  kickWaFlush();

  const studentId = (data as { studentId?: string }).studentId;
  revalidatePath("/ogrenciler");
  revalidatePath("/odemeler");
  revalidatePath("/odemeler/gecikenler");
  revalidatePath("/bugun");
  if (studentId) revalidatePath(`/ogrenciler/${studentId}`);
  return {};
}

/**
 * Velinin ödeme günü: öğrencinin bekleyen aylık aidat taksitleri (istenirse kırtasiye
 * taksitleri de) aynı ay içinde yeni güne taşınır. Danışman vade değiştiremediği (RLS)
 * için işlem sunucu anahtarıyla yapılır.
 */
export async function setPaymentDay(studentId: string, day: PaymentDay, includeKitap: boolean) {
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();
  if (!studentId) return { error: "Öğrenci bulunamadı" };
  if (day !== "son" && (!Number.isInteger(day) || day < 1 || day > 31)) {
    return { error: "Gün 1-31 arasında olmalı" };
  }

  const { data: plans } = await supabase
    .from("payment_plans")
    .select("id, item_type, installment_count, installments(id, due_date, status)")
    .eq("student_id", studentId);
  type PlanRow = { id: string; item_type: ItemType; installment_count: number; installments: { id: string; due_date: string; status: string }[] };
  const moves: { id: string; to: string }[] = [];
  for (const plan of (plans ?? []) as unknown as PlanRow[]) {
    const monthlyAidat = plan.item_type === "aidat" && Number(plan.installment_count) > 1;
    if (!monthlyAidat && !(includeKitap && plan.item_type === "kitap")) continue;
    for (const item of plan.installments ?? []) {
      if (item.status !== "bekliyor") continue;
      const to = applyPaymentDay(item.due_date, day);
      if (to !== item.due_date) moves.push({ id: item.id, to });
    }
  }

  const client = createAdminSupabase() ?? (profile.role === "yonetici" ? supabase : null);
  if (!client) return { error: "Ödeme günü şu an değiştirilemiyor" };
  for (const move of moves) {
    const { error } = await client.from("installments").update({ due_date: move.to }).eq("id", move.id).eq("status", "bekliyor");
    if (error) return { error: "Ödeme günü kaydedilemedi" };
  }

  await logEvent(supabase, {
    entityType: "student",
    entityId: studentId,
    eventType: "odeme_gunu_degisti",
    actorId: profile.id,
    payload: { day, includeKitap, moved: moves.length },
  });

  revalidatePath("/odemeler");
  revalidatePath("/odemeler/gecikenler");
  revalidatePath("/bugun");
  revalidatePath(`/ogrenciler/${studentId}`);
  return { moved: moves.length };
}

type CorrectionLoad =
  | { error: string }
  | {
      kind: "odeme" | "ice_aktarma";
      targets: CorrectionTarget[];
      /** Ödemenin bugünkü ödenmiş satırları. */
      paidRows: { id: string; due_date: string; amount: number; paid_amount: number | null; paid_at: string | null; payment_method: PaymentMethod | null; status: string }[];
      note: string | null;
    };

/**
 * Düzeltmenin hedefleri: ödemenin taksitleri, ödeme öncesi tutarlarıyla (geri alma onları bu
 * hâle döndürür). Olayı bulma kuralı RPC'deki payment_event_for_installment ile aynı:
 * taksiti ödeyen, geri alınmamış en yeni `odeme_alindi`.
 */
async function loadCorrectionTargets(supabase: Supabase, installmentId: string): Promise<CorrectionLoad> {
  const rowSelect = "id, due_date, amount, paid_amount, paid_at, payment_method, status";
  const { data: row } = await supabase.from("installments").select(rowSelect).eq("id", installmentId).maybeSingle();
  if (!row) return { error: "Ödeme bulunamadı; sayfayı yenileyin" };
  if (row.status !== "odendi") return { error: "Bu taksit ödenmiş görünmüyor; sayfayı yenileyin" };

  const { data: events } = await supabase
    .from("events")
    .select("id, created_at, payload")
    .eq("event_type", "odeme_alindi")
    .contains("payload", { paidIds: [installmentId] })
    .order("created_at", { ascending: false });
  type EventRow = {
    id: string;
    payload: { undone?: boolean; note?: string | null; paidIds?: string[]; snapshots?: { id: string; amount: number | string }[] } | null;
  };
  const event = ((events ?? []) as EventRow[]).find((candidate) => candidate.payload?.undone !== true);
  type PaidRow = Extract<CorrectionLoad, { targets: CorrectionTarget[] }>["paidRows"][number];

  if (!event) {
    return {
      kind: "ice_aktarma",
      targets: [{ id: row.id, dueDate: row.due_date, amountKurus: tlToKurus(Number(row.amount)) }],
      paidRows: [row as unknown as PaidRow],
      note: null,
    };
  }

  const snapshots = event.payload?.snapshots ?? [];
  const paidIds = event.payload?.paidIds ?? [];
  const ids = [...new Set([...snapshots.map((snap) => snap.id), ...paidIds])];
  const { data: rows } = await supabase.from("installments").select(rowSelect).in("id", ids);
  const byId = new Map(((rows ?? []) as unknown as PaidRow[]).map((r) => [r.id, r]));
  if (snapshots.length === 0 || snapshots.some((snap) => !byId.has(snap.id))) {
    return { error: "Bu ödemenin taksitlerinden biri bulunamadı; düzeltilemez. Önce sonraki işlemi geri alın." };
  }
  return {
    kind: "odeme",
    targets: snapshots.map((snap) => ({
      id: snap.id,
      dueDate: byId.get(snap.id)!.due_date,
      amountKurus: tlToKurus(Number(snap.amount)),
    })),
    paidRows: paidIds.map((id) => byId.get(id)).filter((r): r is PaidRow => r !== undefined && r.status === "odendi"),
    note: event.payload?.note ?? null,
  };
}

/**
 * "Ödemeyi düzelt" penceresi: ödemenin bugünkü hâli, yazılabilecek en yüksek tutar ve
 * (varsa) düzeltmeyi engelleyen sonraki işlem. Değiştirmez.
 */
export async function previewPaymentCorrection(installmentId: string) {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") return { error: "Ödemeyi yalnız yönetici düzeltebilir" };
  if (!installmentId) return { error: "Ödeme bulunamadı" };
  const supabase = await createServerSupabase();
  const [loaded, preview] = await Promise.all([
    loadCorrectionTargets(supabase, installmentId),
    supabase.rpc("preview_installment_revert", { p_installment_id: installmentId }),
  ]);
  if ("error" in loaded) return { error: loaded.error };
  const parsed = preview.data ? parseRevertPreview(preview.data) : null;
  const parts = loaded.paidRows
    .slice()
    .sort((a, b) => (a.paid_at ?? "").localeCompare(b.paid_at ?? ""))
    .map((r) => ({
      method: r.payment_method,
      kurus: collectedKurus(r),
      paidOn: collectedDay(r) ?? istanbulDateString(new Date()),
    }));
  return {
    kind: loaded.kind,
    blocker: parsed?.blocker ?? null,
    capacityKurus: loaded.targets.reduce((sum, target) => sum + target.amountKurus, 0),
    totalKurus: parts.reduce((sum, part) => sum + part.kurus, 0),
    parts,
    note: loaded.note,
  };
}

export interface CorrectPaymentInput {
  /** Ödemenin herhangi bir ödenmiş satırı (Ödeme geçmişindeki kaydın satırı). */
  installmentId: string;
  /** Doğru tutar; bir ya da iki yöntem, her biri kendi günüyle. */
  payments: { method: PaymentMethod; amountTl: number; paidOn: string }[];
  note?: string;
}

/**
 * "Ödemeyi düzelt" (yönetici): ödeme geri alınır ve doğru tutar / yöntem / tarihle yeniden
 * kaydedilir — tek işlem (correct_payment RPC). Olaylı ödemede ödemenin bütün taksitleri,
 * olaysız (içe aktarma) satırda yalnız o satır düzeltilir. Eksik kalan aynı vadeye bekler.
 */
export async function correctPayment(input: CorrectPaymentInput) {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") return { error: "Ödemeyi yalnız yönetici düzeltebilir" };
  if (!input.installmentId) return { error: "Ödeme bulunamadı" };
  if (input.payments.length === 0 || input.payments.length > 2) return { error: "Bir ya da iki ödeme yöntemi girin" };
  const today = istanbulDateString(new Date());
  for (const part of input.payments) {
    if (!paymentMethods.includes(part.method)) return { error: "Geçerli bir ödeme yöntemi seçin" };
    if (!Number.isFinite(part.amountTl) || part.amountTl < 0) return { error: "Geçerli bir tutar girin" };
    if (!normalizeDate(part.paidOn)) return { error: "Geçerli bir ödeme tarihi girin" };
    if (part.paidOn > today) return { error: "Ödeme tarihi bugünden ileri olamaz" };
  }
  const note = (input.note ?? "").trim().slice(0, 500);
  const supabase = await createServerSupabase();

  const loaded = await loadCorrectionTargets(supabase, input.installmentId);
  if ("error" in loaded) return { error: loaded.error };
  const { targets } = loaded;

  const built = buildCorrectionOps(
    targets,
    input.payments.map((part) => ({ method: part.method, kurus: tlToKurus(part.amountTl), paidOn: part.paidOn })),
  );
  if (!built.ok) return { error: built.error };

  const methods = [...new Set(input.payments.filter((part) => part.amountTl > 0).map((part) => part.method))];
  const { data, error } = await supabase.rpc("correct_payment", {
    p_installment_id: input.installmentId,
    p_paid_at: normalizePaidAt(built.paidOn),
    p_ops: built.ops.map((op) => ({
      id: op.id,
      amount: op.amount,
      parts: op.parts.map((part) =>
        part.paidOn
          ? { amount: part.amount, method: part.method, paidAt: normalizePaidAt(part.paidOn) }
          : { amount: part.amount, method: part.method },
      ),
      remainders: op.remainders,
    })),
    p_payload: {
      paidOn: built.paidOn,
      methods,
      parts: input.payments
        .filter((part) => part.amountTl > 0)
        .map((part) => ({ amountTl: part.amountTl, method: part.method, paidOn: part.paidOn })),
      note: note || null,
    },
  });
  if (error || !data) return { error: rpcErrorMessage(error, "Ödeme düzeltilemedi, hiçbir değişiklik yapılmadı") };
  kickWaFlush();

  const studentId = (data as { studentId?: string }).studentId;
  revalidatePath("/ogrenciler");
  revalidatePath("/odemeler");
  revalidatePath("/odemeler/gecikenler");
  revalidatePath("/bugun");
  if (studentId) revalidatePath(`/ogrenciler/${studentId}`);
  return { totalTl: kurusToTl(built.totalKurus), remainderTl: kurusToTl(built.remainderKurus) };
}

/**
 * "Kalanı kapat" (yönetici): bekleyen taksit küsurat / indirim gibi bir nedenle kapatılır;
 * taksit silinir ve kalemin toplamı aynı tutarda düşer (close_installment_remainder RPC).
 */
export async function closeRemainder(installmentId: string, reason: string) {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") return { error: "Kalanı yalnız yönetici kapatabilir" };
  const trimmed = (reason ?? "").trim();
  if (!trimmed) return { error: "Kapatma nedenini yazın (ör. küsurat, indirim)" };
  if (!installmentId) return { error: "Taksit bulunamadı" };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("close_installment_remainder", {
    p_installment_id: installmentId,
    p_reason: trimmed.slice(0, 200),
  });
  if (error || !data) return { error: rpcErrorMessage(error, "Kalan kapatılamadı, hiçbir değişiklik yapılmadı") };
  kickWaFlush();

  const result = data as { studentId?: string; closed?: boolean; planTotalTl?: number | string };
  revalidatePath("/ogrenciler");
  revalidatePath("/odemeler");
  revalidatePath("/odemeler/gecikenler");
  revalidatePath("/bugun");
  if (result.studentId) revalidatePath(`/ogrenciler/${result.studentId}`);
  return { closed: result.closed === true, planTotalTl: Number(result.planTotalTl ?? 0) };
}
