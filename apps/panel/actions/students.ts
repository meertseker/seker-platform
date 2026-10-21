"use server";

import { revalidatePath } from "next/cache";
import { getApprovedOffer } from "@/actions/offers";
import { getSessionProfile } from "@/lib/auth";
import { PAYMENT_METHODS, PROGRAMS, type PaymentMethod, type Program } from "@/lib/constants";
import { normalizeTurkishPhone } from "@/lib/phone";
import { logEvent } from "@/lib/events";
import { closeLeadTasksQuietly } from "@/lib/lead-flow/tasks-store";
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

  if (!lead) return { error: "Veli bulunamadı" };
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
        : "Veli öğrenciye dönüştürülemedi",
    };
  }

  // R27: öğrenciye dönen velinin tüm otomatik görevleri (takip, hatırlatma, ziyaret, kontenjan) biter.
  await closeLeadTasksQuietly(supabase, leadId, "convertLeadToStudent");

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
      // Teklif tutarı aylıktır; plan sihirbazına aylık olarak gider.
      monthlyTl: Number(approvedOffer.offered_price),
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

export interface UpdateStudentFields {
  fullName?: string;
  parentName?: string | null;
  phone?: string | null;
  program?: Program | "" | null;
  birthMonth?: number | null;
  birthYear?: number | null;
  startDate?: string | null;
  season?: string;
}

/** Öğrenci temel bilgilerini düzeltir (kayıttan sonra yanlış girilen alanlar).
 *  Telefon/program/veli boş bırakılabilir (migration 0004 gereği nullable). */
export async function updateStudent(studentId: string, fields: UpdateStudentFields) {
  const profile = await getSessionProfile();
  if (!studentId) return { error: "Öğrenci bulunamadı" };
  const supabase = await createServerSupabase();

  const patch: Record<string, string | number | null> = {};

  if (fields.fullName !== undefined) {
    const value = fields.fullName.trim();
    if (!value) return { error: "Öğrenci adı zorunludur" };
    patch.full_name = value;
  }
  if (fields.parentName !== undefined) patch.parent_name = fields.parentName?.trim() || null;
  if (fields.phone !== undefined) {
    const raw = (fields.phone ?? "").trim();
    if (!raw) patch.phone = null;
    else {
      const phone = normalizeTurkishPhone(raw);
      if (!phone) return { error: "Geçerli bir cep telefonu girin veya boş bırakın" };
      patch.phone = phone;
    }
  }
  if (fields.program !== undefined) {
    if (!fields.program) patch.program = null;
    else if (fields.program in PROGRAMS) patch.program = fields.program;
    else return { error: "Geçersiz program" };
  }
  if (fields.birthMonth !== undefined) {
    if (fields.birthMonth === null) patch.birth_month = null;
    else if (fields.birthMonth >= 1 && fields.birthMonth <= 12) patch.birth_month = fields.birthMonth;
    else return { error: "Doğum ayı 1-12 arasında olmalı" };
  }
  if (fields.birthYear !== undefined) {
    if (fields.birthYear === null) patch.birth_year = null;
    else if (fields.birthYear >= 2010 && fields.birthYear <= 2035) patch.birth_year = fields.birthYear;
    else return { error: "Doğum yılı 2010-2035 arasında olmalı" };
  }
  if (fields.startDate !== undefined) {
    const raw = (fields.startDate ?? "").trim();
    if (!raw) patch.start_date = null;
    else {
      const date = normalizeDate(raw);
      if (!date) return { error: "Geçerli bir başlangıç tarihi girin" };
      patch.start_date = date;
    }
  }
  if (fields.season !== undefined) {
    const value = fields.season.trim();
    if (!value) return { error: "Sezon zorunludur" };
    patch.season = value;
  }

  const changed = Object.keys(patch);
  if (changed.length === 0) return {};

  const { error } = await supabase.from("students").update(patch).eq("id", studentId);
  if (error) return { error: "Öğrenci güncellenemedi" };

  await logEvent(supabase, {
    entityType: "student",
    entityId: studentId,
    eventType: "ogrenci_guncellendi",
    actorId: profile.id,
    payload: { fields: changed },
  });

  revalidatePath("/ogrenciler");
  revalidatePath(`/ogrenciler/${studentId}`);
  return { ok: true };
}

/** Öğrenciyi ve bağlı kayıtlarını (plan/taksit/iade) siler — yalnız yönetici.
 *  Test/mükerrer/yanlış kayıtları temizlemek için. Geri alınamaz. */
export async function deleteStudent(studentId: string) {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") return { error: "Bu işlem için yönetici yetkisi gerekir" };
  if (!studentId) return { error: "Öğrenci bulunamadı" };

  const admin = createAdminSupabase();
  const db = admin ?? (await createServerSupabase());

  const { data: snapshot } = await db.from("students").select("full_name").eq("id", studentId).maybeSingle();
  // Ödenmiş taksit silinemez (0019 tetikleyicisi); öğrenci silme cascade'i de buna takılır.
  const { count: paidCount } = await db
    .from("installments")
    .select("id, plan:payment_plans!inner(student_id)", { count: "exact", head: true })
    .eq("status", "odendi")
    .eq("plan.student_id", studentId);
  if (paidCount) {
    return { error: `Ödenmiş taksiti olan öğrenci silinemez (${paidCount} ödeme). Önce ödemeleri geri alın.` };
  }
  // FK temizliği: iade kayıtları + bu öğrenciye bağlı lead referansı.
  await db.from("refunds").delete().eq("student_id", studentId);
  await db.from("leads").update({ converted_student_id: null }).eq("converted_student_id", studentId);
  // payment_plans + installments ON DELETE CASCADE ile otomatik silinir.
  const { error } = await db.from("students").delete().eq("id", studentId);
  if (error) return { error: "Öğrenci silinemedi" };

  const supabase = await createServerSupabase();
  await logEvent(supabase, {
    entityType: "student",
    entityId: studentId,
    eventType: "ogrenci_silindi",
    actorId: profile.id,
    payload: { fullName: snapshot?.full_name ?? null },
  });

  revalidatePath("/ogrenciler");
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
