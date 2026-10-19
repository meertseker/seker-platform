"use server";

import { revalidatePath } from "next/cache";
import { updateLeadStatus } from "@/actions/leads";
import {
  APPOINTMENT_OUTCOMES,
  APPOINTMENT_TYPES,
  type AppointmentOutcome,
  type AppointmentType,
  type LeadStatus,
} from "@/lib/constants";
import { logEvent } from "@/lib/events";
import { getSessionProfile } from "@/lib/auth";
import { parseIstanbulDateTime } from "@/lib/lead-flow/business-hours";
import {
  afterVisitTasks,
  appointmentTasks,
  noShowTask,
  type PlannedTask,
} from "@/lib/lead-flow/followups";
import { getLeadFlowSettings } from "@/lib/lead-flow/settings";
import { closeTasksByPrefix, upsertPlannedTasks } from "@/lib/lead-flow/tasks-store";
import { createServerSupabase } from "@/lib/supabase/server";

interface ConflictLead {
  parent_name: string;
}

interface ConflictAppointment {
  scheduled_at: string;
  lead?: ConflictLead | ConflictLead[] | null;
}

interface AppointmentMutationResult {
  error?: string;
  conflict?: { leadName: string; at: string };
  id?: string;
  /** Kayıt başarılı ama yan işlem (hatırlatma) tamamlanamadı; hata değildir. */
  warning?: string;
  /** Kurulan hatırlatma görevleri (yalnızca createAppointment başarısında). */
  reminders?: PlannedTask[];
}

const REMINDER_WARNING = "Randevu kaydedildi, hatırlatma görevleri kurulamadı";
const TASKS_RETRY_ERROR = "Sonuç kaydedildi ama görevler kurulamadı, lütfen tekrar basın";

const appointmentTypes = Object.keys(APPOINTMENT_TYPES) as AppointmentType[];
const appointmentOutcomes = Object.keys(APPOINTMENT_OUTCOMES) as AppointmentOutcome[];

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function isoAround(center: Date, minutes: number) {
  const windowMs = minutes * 60 * 1000;
  return {
    from: new Date(center.getTime() - windowMs).toISOString(),
    to: new Date(center.getTime() + windowMs).toISOString(),
  };
}

async function conflictWindowMinutes() {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "cakisma_dakika")
    .maybeSingle();

  const minutes = Number(data?.value ?? 45);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 45;
}

function revalidateAppointmentViews(leadId: string) {
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/takvim");
}

export async function createAppointment(
  leadId: string,
  scheduledAtIso: string,
  type: AppointmentType,
  force = false,
): Promise<AppointmentMutationResult> {
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();

  if (!leadId) return { error: "Veli bulunamadı." };
  if (!appointmentTypes.includes(type)) return { error: "Geçerli bir randevu türü seçin." };

  const scheduledAt = parseIstanbulDateTime(scheduledAtIso);
  if (!scheduledAt) return { error: "Geçerli bir tarih ve saat girin." };

  const { data: lead } = await supabase
    .from("leads")
    .select("id, status, parent_name, assigned_to")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) return { error: "Veli bulunamadı." };

  const windowMinutes = await conflictWindowMinutes();
  const { from, to } = isoAround(scheduledAt, windowMinutes);

  if (!force) {
    const { data: conflict } = await supabase
      .from("appointments")
      .select("scheduled_at, lead:leads(parent_name)")
      .eq("outcome", "bekliyor")
      .gte("scheduled_at", from)
      .lte("scheduled_at", to)
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (conflict) {
      const appointment = conflict as unknown as ConflictAppointment;
      return {
        conflict: {
          leadName: one(appointment.lead)?.parent_name ?? "Başka veli",
          at: appointment.scheduled_at,
        },
      };
    }
  }

  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert({
      lead_id: leadId,
      scheduled_at: scheduledAt.toISOString(),
      type,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !appointment) {
    return { error: "Randevu kaydedilemedi, lütfen tekrar deneyin." };
  }

  await logEvent(supabase, {
    entityType: "appointment",
    entityId: appointment.id,
    eventType: "randevu_olusturuldu",
    actorId: profile.id,
    payload: { leadId, scheduledAt: scheduledAt.toISOString(), type },
  });

  await supabase
    .from("leads")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", leadId);

  if (["yeni", "ulasildi"].includes(lead.status as LeadStatus)) {
    await updateLeadStatus(leadId, "randevu");
  }

  // Hatırlatmalar tek yerden kurulur: panelin her yerinden açılan randevu aynı görevleri alar.
  let reminders: PlannedTask[];
  try {
    const settings = await getLeadFlowSettings(supabase);
    const leadRow = lead as { parent_name: string; assigned_to: string | null };
    reminders = appointmentTasks(appointment.id, leadRow.parent_name, scheduledAt, new Date(), settings.hours);
    await upsertPlannedTasks(supabase, leadId, leadRow.assigned_to ?? profile.id, reminders);
  } catch {
    // Randevu yazıldı: başarısız sayılmaz, yoksa tekrar deneme kendi randevusuyla çakışıp kopya üretir.
    revalidateAppointmentViews(leadId);
    revalidatePath("/pipeline");
    return { id: appointment.id, reminders: [], warning: REMINDER_WARNING };
  }

  revalidateAppointmentViews(leadId);
  revalidatePath("/pipeline");

  return { id: appointment.id, reminders };
}

export async function setAppointmentOutcome(
  id: string,
  outcome: AppointmentOutcome,
  note?: string,
): Promise<AppointmentMutationResult> {
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();

  if (!id) return { error: "Randevu bulunamadı." };
  if (!appointmentOutcomes.includes(outcome)) return { error: "Geçerli bir sonuç seçin." };

  const select = "id, lead_id, created_by, lead:leads(parent_name, assigned_to)";
  const { data: updated, error } = await supabase
    .from("appointments")
    .update({
      outcome,
      outcome_note: note?.trim() || null,
    })
    .eq("id", id)
    .eq("outcome", "bekliyor")
    .select(select)
    .single();

  let appointment = updated;
  if (error?.code === "PGRST116" || !appointment) {
    // Aynı sonuç zaten kayıtlıysa önceki deneme görev adımında yarıda kalmış olabilir: tekrar uzlaştırılır.
    const { data: existing } = await supabase
      .from("appointments")
      .select(`outcome, ${select}`)
      .eq("id", id)
      .maybeSingle();
    if (!existing || (existing as unknown as { outcome: string }).outcome !== outcome) {
      return { error: "Randevu zaten sonuçlandırılmış" };
    }
    appointment = existing;
  } else {
    if (error) {
      return { error: "Randevu sonucu kaydedilemedi." };
    }

    await logEvent(supabase, {
      entityType: "appointment",
      entityId: appointment.id,
      eventType: "randevu_sonuclandi",
      actorId: profile.id,
      payload: { outcome },
    });

    await supabase
      .from("leads")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("id", appointment.lead_id);
  }

  try {
    // Sonuç ne olursa olsun eski hatırlatmalar kapanır: gelmeyen veliye ertesi gün hatırlatma gitmesin.
    await closeTasksByPrefix(supabase, `hatirlat:${appointment.id}:`);

    if (outcome === "geldi" || outcome === "gelmedi") {
      const row = appointment as unknown as {
        created_by: string | null;
        lead?: { parent_name: string; assigned_to: string | null } | { parent_name: string; assigned_to: string | null }[] | null;
      };
      const lead = one(row.lead);
      const leadName = lead?.parent_name ?? "Veli";
      const assignee = lead?.assigned_to ?? row.created_by ?? profile.id;
      const settings = await getLeadFlowSettings(supabase);
      const now = new Date();
      const planned =
        outcome === "geldi"
          ? afterVisitTasks(appointment.id, leadName, now, settings.hours)
          : [noShowTask(appointment.id, leadName, now, settings.hours)];
      await upsertPlannedTasks(supabase, appointment.lead_id, assignee, planned);
    }
  } catch {
    return { error: TASKS_RETRY_ERROR };
  }

  revalidateAppointmentViews(appointment.lead_id);
  return { id: appointment.id };
}
