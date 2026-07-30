"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSessionProfile } from "@/lib/auth";
import { normalizeTurkishPhone } from "@/lib/phone";
import { canTransition, requiresLostReason, reopenTarget } from "@/lib/lead-state";
import { logEvent } from "@/lib/events";
import type { LeadStatus, LeadSource, LostReason } from "@/lib/constants";

export interface CreateLeadInput {
  parentName: string; phone: string; source: LeadSource; sourceDetail?: string;
  childName?: string; childBirthMonth?: number; childBirthYear?: number;
  ingilizceGerekli?: boolean; ozelDurum?: boolean; ozelDurumNote?: string; wantsSummer?: boolean;
}

export async function createLead(input: CreateLeadInput) {
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();
  const phone = normalizeTurkishPhone(input.phone);
  if (!phone) return { error: "Geçerli bir cep telefonu girin (05XX XXX XX XX)" };
  const ozelDurum = input.ozelDurum ?? false;
  const { data, error } = await supabase.from("leads").insert({
    parent_name: input.parentName.trim(), phone,
    source: input.source, source_detail: input.sourceDetail || null,
    child_name: input.childName || null,
    child_birth_month: input.childBirthMonth || null,
    child_birth_year: input.childBirthYear || null,
    assigned_to: profile.id,
    ingilizce_gerekli: input.ingilizceGerekli ?? false,
    ozel_durum: ozelDurum,
    ozel_durum_note: ozelDurum ? (input.ozelDurumNote?.trim() || null) : null,
    wants_summer: input.wantsSummer ?? false,
  }).select("id").single();
  if (error) return { error: "Lead kaydedilemedi, lütfen tekrar deneyin" };
  await logEvent(supabase, {
    entityType: "lead", entityId: data.id, eventType: "lead_olusturuldu",
    actorId: profile.id, payload: { source: input.source },
  });
  revalidatePath("/pipeline");
  return { id: data.id };
}

export async function findLeadByPhone(rawPhone: string) {
  const supabase = await createServerSupabase();
  const phone = normalizeTurkishPhone(rawPhone);
  if (!phone) return {};
  const [{ data: lead }, { data: student }] = await Promise.all([
    supabase.from("leads").select("id").eq("phone", phone).limit(1).maybeSingle(),
    supabase.from("students").select("id").eq("phone", phone).limit(1).maybeSingle(),
  ]);
  return { leadId: lead?.id, studentId: student?.id };
}

export async function updateLeadStatus(leadId: string, to: LeadStatus, lostReason?: LostReason) {
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();
  const { data: lead } = await supabase.from("leads")
    .select("status, converted_student_id").eq("id", leadId).single();
  if (!lead) return { error: "Lead bulunamadı" };
  const check = canTransition(lead.status as LeadStatus, to, {
    converted: lead.converted_student_id !== null,
  });
  if (!check.ok) return { error: check.reason };
  if (requiresLostReason(to) && !lostReason) return { error: "Kayıp nedeni zorunludur" };
  const { error } = await supabase.from("leads").update({
    status: to,
    lost_reason: to === "kaybedildi" ? lostReason : null,
    last_activity_at: new Date().toISOString(),
  }).eq("id", leadId);
  if (error) return { error: "Durum güncellenemedi" };
  await logEvent(supabase, {
    entityType: "lead", entityId: leadId, eventType: "durum_degisti",
    actorId: profile.id, payload: { from: lead.status, to, lostReason: lostReason ?? null },
  });
  revalidatePath("/pipeline");
  revalidatePath(`/leads/${leadId}`);
  return {};
}

export async function reopenLead(leadId: string) {
  return updateLeadStatus(leadId, reopenTarget());
}

/** Lead'i ve bağlı kayıtlarını (not/randevu/teklif/görev) siler — yalnız yönetici.
 *  Test/mükerrer/yanlış kayıtları temizlemek için. Geri alınamaz. */
export async function deleteLead(leadId: string) {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") return { error: "Bu işlem için yönetici yetkisi gerekir" };
  if (!leadId) return { error: "Lead bulunamadı" };

  const admin = createAdminSupabase();
  const db = admin ?? (await createServerSupabase());
  // lead_notes / appointments / offers / tasks ON DELETE CASCADE ile otomatik silinir.
  const { error } = await db.from("leads").delete().eq("id", leadId);
  if (error) return { error: "Lead silinemedi" };

  const supabase = await createServerSupabase();
  await logEvent(supabase, {
    entityType: "lead",
    entityId: leadId,
    eventType: "lead_silindi",
    actorId: profile.id,
    payload: {},
  });

  revalidatePath("/pipeline");
  return { ok: true };
}

export interface UpdateLeadFields {
  parentName?: string; phone?: string; source?: LeadSource; sourceDetail?: string | null;
  childName?: string | null; childBirthMonth?: number | null; childBirthYear?: number | null;
  ingilizceGerekli?: boolean; ozelDurum?: boolean; ozelDurumNote?: string | null; wantsSummer?: boolean;
}

export async function updateLead(leadId: string, fields: UpdateLeadFields) {
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();

  const { data: existingLead } = await supabase
    .from("leads")
    .select("converted_student_id")
    .eq("id", leadId)
    .maybeSingle();
  if (existingLead?.converted_student_id) {
    return { error: "Öğrenciye dönüştürülmüş lead güncellenemez" };
  }

  const patch: Record<string, string | number | boolean | null> = {};

  if (fields.parentName !== undefined) {
    const parentName = fields.parentName.trim();
    if (!parentName) return { error: "Veli adı zorunludur" };
    patch.parent_name = parentName;
  }
  if (fields.phone !== undefined) {
    const phone = normalizeTurkishPhone(fields.phone);
    if (!phone) return { error: "Geçerli bir cep telefonu girin (05XX XXX XX XX)" };
    patch.phone = phone;
  }
  if (fields.source !== undefined) patch.source = fields.source;
  if (fields.sourceDetail !== undefined) patch.source_detail = fields.sourceDetail || null;
  if (fields.childName !== undefined) patch.child_name = fields.childName || null;
  if (fields.childBirthMonth !== undefined) patch.child_birth_month = fields.childBirthMonth;
  if (fields.childBirthYear !== undefined) patch.child_birth_year = fields.childBirthYear;
  if (fields.ingilizceGerekli !== undefined) patch.ingilizce_gerekli = fields.ingilizceGerekli;
  if (fields.wantsSummer !== undefined) patch.wants_summer = fields.wantsSummer;
  if (fields.ozelDurum !== undefined) {
    patch.ozel_durum = fields.ozelDurum;
    if (!fields.ozelDurum) patch.ozel_durum_note = null;
  }
  if (fields.ozelDurumNote !== undefined && fields.ozelDurum !== false) {
    patch.ozel_durum_note = fields.ozelDurumNote?.trim() || null;
  }

  const changedFields = Object.keys(patch);
  if (changedFields.length === 0) return {};

  patch.last_activity_at = new Date().toISOString();
  const { error } = await supabase.from("leads").update(patch).eq("id", leadId);
  if (error) return { error: "Lead güncellenemedi" };
  await logEvent(supabase, {
    entityType: "lead", entityId: leadId, eventType: "lead_guncellendi",
    actorId: profile.id, payload: { fields: changedFields },
  });
  revalidatePath("/pipeline");
  revalidatePath(`/leads/${leadId}`);
  return {};
}
