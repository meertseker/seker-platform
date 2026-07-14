"use server";

import { revalidatePath } from "next/cache";
import { getApprovedOffer } from "@/actions/offers";
import { getSessionProfile } from "@/lib/auth";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import { logEvent } from "@/lib/events";
import { kurusToTl, tlToKurus } from "@/lib/money";
import { installmentsToCancel } from "@/lib/student-leave";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

const refundMethods = Object.keys(PAYMENT_METHODS) as PaymentMethod[];

function normalizeDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

function normalizeMoney(value: number) {
  if (!Number.isFinite(value)) return null;
  const kurus = tlToKurus(value);
  return kurus > 0 ? kurus : null;
}

async function activeSeason() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("price_lists")
    .select("season")
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;
  return data.season as string;
}

export async function convertLeadToStudent(leadId: string, startDate: string) {
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();
  const approvedOffer = await getApprovedOffer(leadId);

  if (!approvedOffer) {
    return { error: "Onaylı teklif olmadan öğrenciye dönüştürülemez" };
  }

  const normalizedStartDate = normalizeDate(startDate);
  if (!normalizedStartDate) return { error: "Geçerli bir başlangıç tarihi girin" };

  const [{ data: lead }, season] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, parent_name, phone, child_name, child_birth_month, child_birth_year, converted_student_id",
      )
      .eq("id", leadId)
      .maybeSingle(),
    activeSeason(),
  ]);

  if (!lead) return { error: "Lead bulunamadı" };
  if (lead.converted_student_id) return { error: "Bu lead zaten öğrenciye dönüştürülmüş" };
  if (!season) return { error: "Aktif sezon bulunamadı" };

  const fullName = (lead.child_name?.trim() || lead.parent_name).trim();
  const { data: student, error: studentError } = await supabase
    .from("students")
    .insert({
      full_name: fullName,
      birth_month: lead.child_birth_month,
      birth_year: lead.child_birth_year,
      parent_name: lead.parent_name,
      phone: lead.phone,
      season,
      program: approvedOffer.program,
      start_date: normalizedStartDate,
    })
    .select("id")
    .single();

  if (studentError || !student) return { error: "Öğrenci kaydı oluşturulamadı" };

  const { data: updatedLead, error: leadError } = await supabase
    .from("leads")
    .update({
      converted_student_id: student.id,
      status: "kazanildi",
      lost_reason: null,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", leadId)
    .is("converted_student_id", null)
    .select("id")
    .maybeSingle();

  if (leadError || !updatedLead) {
    const cleanupClient = createAdminSupabase() ?? supabase;
    const cleanup = await cleanupClient.from("students").delete().eq("id", student.id);
    return {
      error: cleanup.error
        ? "Dönüştürme başarısız oldu; oluşturulan öğrenci kaydı silinemedi, manuel kontrol edilmeli"
        : "Lead öğrenciye dönüştürülemedi",
    };
  }

  await logEvent(supabase, {
    entityType: "student",
    entityId: student.id,
    eventType: "ogrenciye_donusturuldu",
    actorId: profile.id,
    payload: { leadId },
  });

  revalidatePath("/pipeline");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/ogrenciler");
  revalidatePath(`/ogrenciler/${student.id}`);

  return {
    studentId: student.id,
    offer: {
      sourceOfferId: approvedOffer.id as string,
      totalTl: Number(approvedOffer.offered_price),
      installmentCount: Number(approvedOffer.installment_count),
    },
  };
}

export async function markStudentLeft(
  studentId: string,
  leftDate: string,
  leaveReason: string,
) {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") return { error: "Bu işlem için yönetici yetkisi gerekir" };

  if (!studentId) return { error: "Öğrenci bulunamadı" };

  const normalizedLeftDate = normalizeDate(leftDate);
  if (!normalizedLeftDate) return { error: "Geçerli bir ayrılış tarihi girin" };

  const reason = leaveReason.trim();
  if (!reason) return { error: "Ayrılış nedeni boş olamaz" };

  const supabase = await createServerSupabase();

  const { data: student } = await supabase
    .from("students")
    .select("id, status")
    .eq("id", studentId)
    .maybeSingle();

  if (!student) return { error: "Öğrenci bulunamadı" };
  if (student.status !== "aktif") {
    return { error: "Sadece aktif öğrenci ayrıldı olarak işaretlenebilir" };
  }

  const { data: updated, error: updateError } = await supabase
    .from("students")
    .update({
      status: "ayrildi",
      left_date: normalizedLeftDate,
      leave_reason: reason,
    })
    .eq("id", studentId)
    .eq("status", "aktif")
    .select("id")
    .maybeSingle();

  if (updateError || !updated) return { error: "Öğrenci ayrıldı olarak işaretlenemedi" };

  const { data: plans } = await supabase
    .from("payment_plans")
    .select("id")
    .eq("student_id", studentId);

  const planIds = (plans ?? []).map((plan) => plan.id);

  if (planIds.length > 0) {
    const { data: installments } = await supabase
      .from("installments")
      .select("id, status")
      .in("plan_id", planIds);

    const toCancel = installmentsToCancel(installments ?? []);

    if (toCancel.length > 0) {
      const { error: cancelError } = await supabase
        .from("installments")
        .update({ status: "iptal" })
        .in(
          "id",
          toCancel.map((row) => row.id),
        );

      if (cancelError) {
        return {
          error:
            "Öğrenci ayrıldı olarak işaretlendi ancak bekleyen taksitler iptal edilemedi",
        };
      }
    }
  }

  await logEvent(supabase, {
    entityType: "student",
    entityId: studentId,
    eventType: "ogrenci_ayrildi",
    actorId: profile.id,
    payload: { leftDate: normalizedLeftDate, leaveReason: reason },
  });

  revalidatePath("/ogrenciler");
  revalidatePath(`/ogrenciler/${studentId}`);
  return { ok: true };
}

export async function recordRefund(
  studentId: string,
  amountTl: number,
  method: PaymentMethod,
  refundDate: string,
  note?: string,
) {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") return { error: "Bu işlem için yönetici yetkisi gerekir" };

  if (!studentId) return { error: "Öğrenci bulunamadı" };

  const amountKurus = normalizeMoney(amountTl);
  if (!amountKurus) return { error: "İade tutarı 0'dan büyük olmalı" };

  if (!refundMethods.includes(method)) return { error: "Geçerli bir iade yöntemi seçin" };

  const normalizedRefundDate = normalizeDate(refundDate);
  if (!normalizedRefundDate) return { error: "Geçerli bir iade tarihi girin" };

  const supabase = await createServerSupabase();

  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("id", studentId)
    .maybeSingle();

  if (!student) return { error: "Öğrenci bulunamadı" };

  const { data: refund, error } = await supabase
    .from("refunds")
    .insert({
      student_id: studentId,
      amount: kurusToTl(amountKurus),
      method,
      refund_date: normalizedRefundDate,
      note: note?.trim() || null,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !refund) return { error: "İade kaydedilemedi" };

  await logEvent(supabase, {
    entityType: "student",
    entityId: studentId,
    eventType: "iade_kaydedildi",
    actorId: profile.id,
    payload: { refundId: refund.id, amountTl: kurusToTl(amountKurus), method },
  });

  revalidatePath(`/ogrenciler/${studentId}`);
  return { id: refund.id as string };
}
