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
import { allocatePayment } from "@/lib/payment-allocation";
import { buildEnrollmentPlans, seasonLastMonth } from "@/lib/enrollment-plan";
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
  revalidatePath("/odemeler");
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
  revalidatePath("/odemeler");
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
  revalidatePath("/odemeler");
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
  revalidatePath("/odemeler");
  revalidatePath(studentPath);
  return {};
}

export interface TakePaymentInput {
  studentId: string;
  installmentIds: string[];
  payments: { method: PaymentMethod; amountTl: number }[];
  /** "YYYY-MM-DD" (İstanbul günü). */
  paidOn: string;
  note?: string;
  /** Eksik ödemede kalanın taksitleri; yoksa kalan aynı vadeyle tek taksit bekler. */
  remainder?: { count: number; firstDueDate: string };
}

interface PaymentSnapshot {
  id: string;
  amount: number;
}

/** Danışman kendi ödemesini bu süre içinde geri alabilir. */
const UNDO_WINDOW_MS = 15 * 60 * 1000;

/**
 * Tek seferde ödeme: bir ya da birkaç taksit, bir ya da iki yöntem.
 * Dağıtım `allocatePayment` ile; işlem ve geri alma bilgisi tek bir
 * `odeme_alindi` olayına yazılır (not da burada durur).
 */
export async function takePayment(input: TakePaymentInput) {
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();
  const paidAt = normalizePaidAt(input.paidOn);
  const note = (input.note ?? "").trim().slice(0, 500);

  if (!input.studentId) return { error: "Öğrenci bulunamadı" };
  if (!paidAt) return { error: "Geçerli bir ödeme tarihi girin" };
  if (input.payments.length === 0 || input.payments.length > 2) {
    return { error: "Bir ya da iki ödeme yöntemi girin" };
  }
  for (const part of input.payments) {
    if (!paymentMethods.includes(part.method)) return { error: "Geçerli bir ödeme yöntemi seçin" };
    if (!Number.isFinite(part.amountTl) || part.amountTl < 0) return { error: "Geçerli bir tutar girin" };
  }

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
    if (row.status !== "bekliyor") return { error: "Seçilen taksitlerden biri zaten ödenmiş" };
  }

  const result = allocatePayment(
    typed.map((row) => ({ id: row.id, dueDate: row.due_date, amountKurus: tlToKurus(Number(row.amount)) })),
    input.payments.map((part) => ({ method: part.method, kurus: tlToKurus(part.amountTl) })),
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
  const createdIds: string[] = [];
  const paidIds: string[] = [];
  const snapshots: PaymentSnapshot[] = [];
  const cleanupClient = createAdminSupabase() ?? supabase;

  async function rollback() {
    if (createdIds.length) await cleanupClient.from("installments").delete().in("id", createdIds);
    for (const snap of snapshots) {
      await cleanupClient
        .from("installments")
        .update({ amount: snap.amount, status: "bekliyor", paid_at: null, paid_amount: null, payment_method: null, marked_by: null })
        .eq("id", snap.id);
    }
  }

  const paidFields = (kurus: number, method: PaymentMethod) => ({
    amount: kurusToTl(kurus),
    status: "odendi" as const,
    paid_at: paidAt,
    paid_amount: kurusToTl(kurus),
    payment_method: method,
    marked_by: profile.id,
  });

  for (const allocation of result.allocations) {
    const row = byId.get(allocation.installmentId)!;
    const [firstPart, ...extraParts] = allocation.parts;
    const inserts = [
      ...extraParts.map((part) => ({ plan_id: row.plan_id, due_date: row.due_date, ...paidFields(part.kurus, part.method) })),
      ...(allocation.remainderKurus > 0
        ? remainderPlan
          ? generateInstallments(allocation.remainderKurus, remainderPlan.count, remainderPlan.firstDueDate).map(
              (draft) => ({ plan_id: row.plan_id, due_date: draft.dueDate, amount: kurusToTl(draft.amountKurus) }),
            )
          : [{ plan_id: row.plan_id, due_date: row.due_date, amount: kurusToTl(allocation.remainderKurus) }]
        : []),
    ];
    if (inserts.length) {
      const { data: inserted, error: insertError } = await supabase
        .from("installments")
        .insert(inserts)
        .select("id, status");
      if (insertError || !inserted) {
        await rollback();
        return { error: "Ödeme kaydedilemedi, hiçbir değişiklik yapılmadı" };
      }
      for (const created of inserted) {
        createdIds.push(created.id);
        if (created.status === "odendi") paidIds.push(created.id);
      }
    }

    const { error: updateError } = await supabase
      .from("installments")
      .update(paidFields(firstPart.kurus, firstPart.method))
      .eq("id", row.id);
    if (updateError) {
      await rollback();
      return { error: "Ödeme kaydedilemedi, hiçbir değişiklik yapılmadı" };
    }
    snapshots.push({ id: row.id, amount: Number(row.amount) });
    paidIds.push(row.id);
  }

  const methods = [...new Set(result.allocations.flatMap((a) => a.parts.map((p) => p.method)))];
  const { data: event } = await supabase
    .from("events")
    .insert({
      entity_type: "student",
      entity_id: input.studentId,
      event_type: "odeme_alindi",
      actor_id: profile.id,
      payload: {
        totalTl: kurusToTl(result.totalKurus),
        paidOn: input.paidOn,
        methods,
        note: note || null,
        paidIds,
        createdIds,
        snapshots,
      },
    })
    .select("id")
    .single();

  revalidatePath("/ogrenciler");
  revalidatePath("/odemeler");
  revalidatePath("/bugun");
  revalidatePath(`/ogrenciler/${input.studentId}`);
  return { eventId: (event?.id as string | undefined) ?? null, totalTl: kurusToTl(result.totalKurus) };
}

/** "Ödeme al"ın geri alınması: oluşturulan satırlar silinir, taksitler eski hâline döner. */
export async function undoPayment(eventId: string) {
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();
  const { data: event } = await supabase
    .from("events")
    .select("id, entity_id, actor_id, event_type, created_at, payload")
    .eq("id", eventId)
    .maybeSingle();

  if (!event || event.event_type !== "odeme_alindi") return { error: "Ödeme kaydı bulunamadı" };
  const payload = event.payload as { createdIds?: string[]; snapshots?: PaymentSnapshot[]; undone?: boolean };
  if (payload.undone) return { error: "Bu ödeme zaten geri alındı" };
  const isOwner = event.actor_id === profile.id;
  const fresh = Date.now() - Date.parse(event.created_at) < UNDO_WINDOW_MS;
  if (profile.role !== "yonetici" && !(isOwner && fresh)) {
    return { error: "Bu ödemeyi yalnız yönetici geri alabilir" };
  }

  // Danışman taksit güncelleyemez (RLS); sahiplik ve süre yukarıda doğrulandı.
  const admin = createAdminSupabase();
  if (!admin && profile.role !== "yonetici") return { error: "Geri alma şu an yapılamıyor" };
  const client = admin ?? supabase;

  if (payload.createdIds?.length) {
    const { error } = await client.from("installments").delete().in("id", payload.createdIds);
    if (error) return { error: "Ödeme geri alınamadı" };
  }
  for (const snap of payload.snapshots ?? []) {
    const { error } = await client
      .from("installments")
      .update({ amount: snap.amount, status: "bekliyor", paid_at: null, paid_amount: null, payment_method: null, marked_by: null })
      .eq("id", snap.id);
    if (error) return { error: "Ödeme geri alınamadı" };
  }
  await client.from("events").update({ payload: { ...payload, undone: true } }).eq("id", event.id);
  await logEvent(supabase, {
    entityType: "student",
    entityId: event.entity_id,
    eventType: "odeme_geri_alindi",
    actorId: profile.id,
    payload: { eventId: event.id },
  });

  revalidatePath("/ogrenciler");
  revalidatePath("/odemeler");
  revalidatePath("/bugun");
  revalidatePath(`/ogrenciler/${event.entity_id}`);
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
    const { data: plan, error: planError } = await supabase
      .from("payment_plans")
      .insert({
        student_id: input.studentId,
        season,
        item_type: draft.itemType,
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
 * Taksit silmeye RLS izin vermediği için işlem sunucu anahtarıyla yapılır.
 */
export async function rescheduleInstallments(installmentIds: string[], count: number, firstDueDate: string) {
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();
  const dueDate = normalizeDate(firstDueDate);
  if (installmentIds.length === 0) return { error: "Taksit seçin" };
  if (!Number.isInteger(count) || count < 1 || count > 12) return { error: "Taksit sayısı 1-12 arasında olmalı" };
  if (!dueDate) return { error: "Geçerli bir ilk vade girin" };

  const { data: rows } = await supabase
    .from("installments")
    .select("id, plan_id, amount, status, plan:payment_plans!inner(student_id)")
    .in("id", installmentIds);
  type Row = { id: string; plan_id: string; amount: number; status: string; plan: { student_id: string } | { student_id: string }[] };
  const typed = (rows ?? []) as unknown as Row[];
  if (typed.length !== installmentIds.length) return { error: "Taksitler bulunamadı" };
  if (typed.some((row) => row.status !== "bekliyor")) return { error: "Yalnız bekleyen taksitler taksitlendirilebilir" };
  const planId = typed[0].plan_id;
  if (typed.some((row) => row.plan_id !== planId)) return { error: "Taksitler aynı kaleme ait olmalı" };
  const plan = Array.isArray(typed[0].plan) ? typed[0].plan[0] : typed[0].plan;

  const admin = createAdminSupabase();
  if (!admin) return { error: "Taksitlendirme şu an yapılamıyor" };

  const totalKurus = typed.reduce((sum, row) => sum + tlToKurus(Number(row.amount)), 0);
  const drafts = generateInstallments(totalKurus, count, dueDate);
  const { data: inserted, error: insertError } = await admin
    .from("installments")
    .insert(drafts.map((draft) => ({ plan_id: planId, due_date: draft.dueDate, amount: kurusToTl(draft.amountKurus) })))
    .select("id");
  if (insertError || !inserted) return { error: "Taksitler oluşturulamadı" };
  const { error: deleteError } = await admin.from("installments").delete().in("id", installmentIds);
  if (deleteError) {
    await admin.from("installments").delete().in("id", inserted.map((row) => row.id));
    return { error: "Taksitlendirilemedi, hiçbir değişiklik yapılmadı" };
  }

  await logEvent(supabase, {
    entityType: "student",
    entityId: plan.student_id,
    eventType: "taksitlendirildi",
    actorId: profile.id,
    payload: { planId, totalTl: kurusToTl(totalKurus), count, firstDueDate: dueDate, replaced: installmentIds },
  });

  revalidatePath("/ogrenciler");
  revalidatePath("/odemeler");
  revalidatePath("/odemeler/gecikenler");
  revalidatePath("/bugun");
  revalidatePath(`/ogrenciler/${plan.student_id}`);
  return {};
}
