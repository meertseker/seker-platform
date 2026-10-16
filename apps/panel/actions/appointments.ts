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
}

const appointmentTypes = Object.keys(APPOINTMENT_TYPES) as AppointmentType[];
const appointmentOutcomes = Object.keys(APPOINTMENT_OUTCOMES) as AppointmentOutcome[];

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function parseIstanbulDateTime(value: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );

  if (match) {
    const [, year, month, day, hour, minute, second = "0"] = match;
    return new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour) - 3,
        Number(minute),
        Number(second),
      ),
    );
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isoAround(center: Date, minutes: number) {
  const windowMs = minutes * 60 * 1000;
  return {
    from: new Date(center.getTime() - windowMs).toISOString(),
    to: new Date(center.getTime() + windowMs).toISOString(),
  };
}

function istanbulDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function tomorrowInIstanbul() {
  const { year, month, day } = istanbulDateParts();
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  const y = tomorrow.getUTCFullYear();
  const m = String(tomorrow.getUTCMonth() + 1).padStart(2, "0");
  const d = String(tomorrow.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
    .select("id, status")
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

  revalidateAppointmentViews(leadId);
  revalidatePath("/pipeline");

  return { id: appointment.id };
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

  const { data: appointment, error } = await supabase
    .from("appointments")
    .update({
      outcome,
      outcome_note: note?.trim() || null,
    })
    .eq("id", id)
    .eq("outcome", "bekliyor")
    .select("id, lead_id, created_by")
    .single();

  if (error?.code === "PGRST116" || !appointment) {
    return { error: "Randevu zaten sonuçlandırılmış" };
  }

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

  if (outcome === "gelmedi") {
    const { error: taskError } = await supabase.from("tasks").insert({
      lead_id: appointment.lead_id,
      assigned_to: appointment.created_by,
      due_date: tomorrowInIstanbul(),
      title: "Yeniden ara / randevu ver",
      auto_generated: true,
      rule_key: `noshow:${appointment.id}`,
    });

    if (taskError && taskError.code !== "23505") {
      return { error: "Randevu sonucu kaydedildi, takip görevi oluşturulamadı." };
    }
  }

  revalidateAppointmentViews(appointment.lead_id);
  return { id: appointment.id };
}
