"use server";

import { revalidatePath } from "next/cache";
import { getApprovedOffer } from "@/actions/offers";
import { getSessionProfile } from "@/lib/auth";
import { logEvent } from "@/lib/events";
import { createServerSupabase } from "@/lib/supabase/server";

function normalizeDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
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
    await supabase.from("students").delete().eq("id", student.id);
    return { error: "Lead öğrenciye dönüştürülemedi" };
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
