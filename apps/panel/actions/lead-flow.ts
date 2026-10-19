"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { logEvent } from "@/lib/events";
import { createAppointment } from "@/actions/appointments";
import { updateLeadStatus } from "@/actions/leads";
import { LOST_REASONS, type LeadStatus } from "@/lib/constants";
import { formatDayTime, parseIstanbulDateTime } from "@/lib/lead-flow/business-hours";
import { appointmentTasks, followupAfterAttempt } from "@/lib/lead-flow/followups";
import { getLeadFlowSettings } from "@/lib/lead-flow/settings";
import { closeTasksByPrefix, openRuleKeys, upsertPlannedTasks } from "@/lib/lead-flow/tasks-store";
import { claimLeadAs, type ClaimResult } from "@/lib/lead-flow/claim";

export type CallResult = "randevu" | "geri_ara" | "ulasilamadi" | "uygun_degil";
export type NotFitReason = "yas_uymuyor" | "uzaklik" | "gelecek_yil" | "baska_okul";

export interface RecordCallInput {
  leadId: string;
  result: CallResult;
  quals: { age: boolean; area: boolean; timing: boolean; reached: boolean };
  note?: string;
  appointmentAt?: string;
  callbackAt?: string;
  notFitReason?: NotFitReason;
}

const CALL_RESULTS: CallResult[] = ["randevu", "geri_ara", "ulasilamadi", "uygun_degil"];
const NOT_FIT_REASONS: NotFitReason[] = ["yas_uymuyor", "uzaklik", "gelecek_yil", "baska_okul"];
// enqueue_conversion_upload (0008) yalnız durum değişip randevu/görüşme/teklif'e geçince çalışır.
const CONVERSION_STATUSES: LeadStatus[] = ["randevu", "gorusme_yapildi", "teklif"];
const CONVERSION_MAX_DAYS = 89;

interface LeadRow {
  id: string;
  parent_name: string;
  status: LeadStatus;
  converted_student_id: string | null;
  first_contact_at: string | null;
  gclid: string | null;
  created_at: string;
  web_payload: Record<string, unknown> | null;
}

export async function claimLead(leadId: string): Promise<ClaimResult> {
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();
  const settings = await getLeadFlowSettings(supabase);
  const result = await claimLeadAs(supabase, leadId, profile.id, settings.claimMinutes);
  if (result.ok) {
    revalidatePath("/bugun");
    revalidatePath(`/leads/${leadId}`);
  }
  return result;
}

/** Trigger'ın Google'a gönderilecek ("bekliyor") bir dönüşüm satırı açıp açmayacağı. */
function conversionQueued(lead: LeadRow, statusAfter: string | null, now: Date): boolean {
  if (!lead.gclid?.trim()) return false;
  if (lead.status === statusAfter || !CONVERSION_STATUSES.includes(statusAfter as LeadStatus)) return false;
  const payload = lead.web_payload ?? {};
  if ("old_web_lead_id" in payload || payload.consent_scope === "arama") return false;
  // Tıklama zamanı kayıt zamanından önce olamaz; kayıt 89 günden yeniyse tıklama da yenidir.
  return now.getTime() - Date.parse(lead.created_at) < CONVERSION_MAX_DAYS * 86_400_000;
}

function validate(input: RecordCallInput): string | null {
  if (!input?.leadId) return "Veli bulunamadı";
  if (!CALL_RESULTS.includes(input.result)) return "Arama sonucunu seçin";
  const q = input.quals;
  if (!q || ![q.age, q.area, q.timing, q.reached].every((v) => typeof v === "boolean")) {
    return "Nitelik sorularını yanıtlayın";
  }
  if (input.result === "randevu" && !(input.appointmentAt && parseIstanbulDateTime(input.appointmentAt))) {
    return "Ziyaret için tarih ve saat seçin";
  }
  if (input.result === "geri_ara" && !(input.callbackAt && parseIstanbulDateTime(input.callbackAt))) {
    return "Geri arama için tarih ve saat seçin";
  }
  if (input.result === "uygun_degil" && !(input.notFitReason && NOT_FIT_REASONS.includes(input.notFitReason))) {
    return "Uygun olmama nedenini seçin";
  }
  return null;
}

function noteBody(input: RecordCallInput, detail: string): string {
  const userNote = input.note?.trim();
  return userNote ? `${detail}\n${userNote}` : detail;
}

/** Arama ekranının kaydı: nitelik, not, olay, durum ve takip görevleri. */
export async function recordCall(input: RecordCallInput): Promise<{ done: string[] } | { error: string }> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();
  const now = new Date();
  const { leadId, result } = input;

  const { data: leadData } = await supabase
    .from("leads")
    .select("id, parent_name, status, converted_student_id, first_contact_at, gclid, created_at, web_payload")
    .eq("id", leadId)
    .maybeSingle();
  const lead = leadData as LeadRow | null;
  if (!lead) return { error: "Veli bulunamadı" };
  if (lead.converted_student_id) return { error: "Öğrenciye dönüştürülmüş veli için arama kaydedilemez" };

  const settings = await getLeadFlowSettings(supabase);
  const firstAttemptAt = lead.first_contact_at ? new Date(lead.first_contact_at) : now;

  try {
    // Randevu önce yazılır: çakışma varsa başka hiçbir şey değişmeden kullanıcı saat değiştirir.
    let appointment: { id: string; at: Date } | null = null;
    if (result === "randevu") {
      const res = await createAppointment(leadId, input.appointmentAt!, "okul_ziyareti");
      if (res.conflict) {
        return {
          error: `Bu saate yakın başka bir randevu var: ${res.conflict.leadName} · ${formatDayTime(new Date(res.conflict.at))}. Başka bir saat seçin.`,
        };
      }
      if (res.error || !res.id) return { error: res.error ?? "Randevu kaydedilemedi, lütfen tekrar deneyin." };
      const { data: appt } = await supabase.from("appointments").select("scheduled_at").eq("id", res.id).single();
      const scheduled = (appt as { scheduled_at: string } | null)?.scheduled_at;
      appointment = { id: res.id, at: scheduled ? new Date(scheduled) : parseIstanbulDateTime(input.appointmentAt!)! };
    }

    // Ulaşılamadı: deneme sırası açık takip görevinden okunur (yoksa 1).
    let attempt = 1;
    if (result === "ulasilamadi") {
      const keys = await openRuleKeys(supabase, `takip:${leadId}:`);
      const steps = keys.map((k) => Number(k.split(":").pop())).filter((n) => Number.isInteger(n) && n > 0);
      if (steps.length > 0) attempt = Math.max(...steps);
    }

    // Ortak alanlar
    const reached = result === "randevu" || result === "geri_ara" ? true : result === "ulasilamadi" ? false : input.quals.reached;
    const patch: Record<string, unknown> = {
      assigned_to: profile.id,
      q_age_ok: input.quals.age,
      q_area_ok: input.quals.area,
      q_timing_ok: input.quals.timing,
      q_reached: reached,
      last_activity_at: now.toISOString(),
    };
    if (!lead.first_contact_at) patch.first_contact_at = now.toISOString();
    const userNote = input.note?.trim();
    if (userNote) patch.contact_note = userNote;
    const { data: updated, error: updateError } = await supabase
      .from("leads").update(patch).eq("id", leadId).select("status").single();
    if (updateError) return { error: "Arama kaydedilemedi, lütfen tekrar deneyin" };
    const statusAfter = (updated as { status: string } | null)?.status ?? null;

    let detail: string;
    const callbackAt = result === "geri_ara" ? parseIstanbulDateTime(input.callbackAt!)! : null;
    switch (result) {
      case "randevu":
        detail = `Arandı, ulaşıldı · okul ziyareti randevusu: ${formatDayTime(appointment!.at)}`;
        break;
      case "geri_ara":
        detail = `Arandı, ulaşıldı · geri arama istedi: ${formatDayTime(callbackAt!)}`;
        break;
      case "ulasilamadi":
        detail = `Arandı, ulaşılamadı (${attempt}. deneme)`;
        break;
      default:
        detail = `Arandı · uygun değil: ${LOST_REASONS[input.notFitReason!]}`;
    }
    const { error: noteError } = await supabase.from("lead_notes").insert({
      lead_id: leadId, author_id: profile.id, body: noteBody(input, detail),
    });
    if (noteError) return { error: "Görüşme notu kaydedilemedi" };

    await logEvent(supabase, {
      entityType: "lead", entityId: leadId, eventType: "arama_kaydi", actorId: profile.id,
      payload: {
        result,
        attempt: result === "ulasilamadi" ? attempt : undefined,
        quals: { ...input.quals, reached },
        appointmentId: appointment?.id,
        callbackAt: callbackAt?.toISOString(),
        notFitReason: input.notFitReason,
      },
    });

    // Bu arama yapıldı: bekleyen geri arama görevi de karşılandı.
    await closeTasksByPrefix(supabase, `geri:${leadId}`);

    let done: string[];
    switch (result) {
      case "randevu": {
        await closeTasksByPrefix(supabase, `takip:${leadId}:`);
        await upsertPlannedTasks(supabase, leadId, profile.id,
          appointmentTasks(appointment!.id, lead.parent_name, appointment!.at, now, settings.hours));
        done = [
          `Ziyaret takvime yazıldı: ${formatDayTime(appointment!.at)}`,
          "WhatsApp onay mesajı hazır · veli kartından gönder",
          "1 gün önce ve aynı sabah hatırlatma kuruldu",
        ];
        if (conversionQueued(lead, statusAfter, now)) done.push("Google'a \"Randevu\" dönüşümü sıraya alındı");
        break;
      }
      case "geri_ara": {
        await closeTasksByPrefix(supabase, `takip:${leadId}:`);
        await upsertPlannedTasks(supabase, leadId, profile.id, [
          { ruleKey: `geri:${leadId}`, title: `Geri ara · ${lead.parent_name}`, dueAt: callbackAt!, kind: "arama" },
        ]);
        if (lead.status === "yeni") {
          const res = await updateLeadStatus(leadId, "ulasildi");
          if (res.error) return { error: res.error };
        }
        done = [
          `Geri arama görevi açıldı: ${formatDayTime(callbackAt!)}`,
          "Bugün ekranında o saatte en üstte çıkacak",
        ];
        break;
      }
      case "ulasilamadi": {
        await closeTasksByPrefix(supabase, `takip:${leadId}:`);
        const next = followupAfterAttempt(leadId, lead.parent_name, attempt, now, firstAttemptAt, settings.hours);
        if (!next) {
          if (lead.status !== "kaybedildi") {
            const res = await updateLeadStatus(leadId, "kaybedildi", "ulasilamadi");
            if (res.error) return { error: res.error };
          }
          done = ["7 günde ulaşılamadı · veli Kaybedildi (Ulaşılamadı) olarak kapandı"];
          break;
        }
        await upsertPlannedTasks(supabase, leadId, profile.id, [next]);
        const inThreeHours = next.dueAt.getTime() === now.getTime() + 3 * 3_600_000;
        done = [
          inThreeHours
            ? "3 saat sonra tekrar arama görevi açıldı"
            : `Sonraki arama görevi açıldı: ${formatDayTime(next.dueAt)}`,
          "Hazır WhatsApp mesajı var · veli kartından gönder",
        ];
        break;
      }
      default: {
        const reason = input.notFitReason!;
        await closeTasksByPrefix(supabase, `takip:${leadId}:`);
        if (lead.status !== "kaybedildi") {
          const res = await updateLeadStatus(leadId, "kaybedildi", reason);
          if (res.error) return { error: res.error };
        }
        done = [`Kayıt kapatıldı · neden: ${LOST_REASONS[reason]}`, "Açık takip görevleri kapandı"];
      }
    }

    revalidatePath("/bugun");
    revalidatePath("/pipeline");
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/");
    return { done };
  } catch (e) {
    console.error("recordCall:", e);
    return { error: "Arama kaydı tamamlanamadı, sayfayı yenileyip kontrol edin" };
  }
}
