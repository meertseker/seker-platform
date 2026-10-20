"use server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { logEvent } from "@/lib/events";
import { createAppointment } from "@/actions/appointments";
import { updateLeadStatus } from "@/actions/leads";
import { LOST_REASONS, type LeadStatus, type LostReason } from "@/lib/constants";
import { formatDayTime, parseIstanbulDateTime } from "@/lib/lead-flow/business-hours";
import { appointmentTasks, followupAfterAttempt, kontenjanTask, type PlannedTask } from "@/lib/lead-flow/followups";
import { getLeadFlowSettings } from "@/lib/lead-flow/settings";
import { callWaLink } from "@/lib/lead-flow/call-wa";
import { closeTasksByPrefix, tasksByPrefix, upsertPlannedTasks } from "@/lib/lead-flow/tasks-store";
import { alreadyContacted, claimLeadAs, type ClaimResult } from "@/lib/lead-flow/claim";
import { normalizeTurkishPhone } from "@/lib/phone";
import { inQueueWindow } from "@/lib/queries/call-queue";

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
const APPOINTMENT_PARTIAL = "Ziyaret takvime yazıldı ancak arama kaydı tamamlanamadı; sayfayı yenileyin";
const GENERIC_FAILURE = "Arama kaydı tamamlanamadı, sayfayı yenileyip kontrol edin";

interface LeadRow {
  id: string;
  parent_name: string;
  phone: string;
  status: LeadStatus;
  converted_student_id: string | null;
  assigned_to: string | null;
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

const PAST_TIME = "Geçmiş bir saat seçilemez";
const NOTE_MAX = 2000;

function validate(input: RecordCallInput, now: Date): string | null {
  if (!input?.leadId) return "Veli bulunamadı";
  if (!CALL_RESULTS.includes(input.result)) return "Arama sonucunu seçin";
  if (typeof input.note === "string" && input.note.trim().length > NOTE_MAX) {
    return `Not en fazla ${NOTE_MAX} karakter olabilir`;
  }
  const q = input.quals;
  if (!q || ![q.age, q.area, q.timing, q.reached].every((v) => typeof v === "boolean")) {
    return "Nitelik sorularını yanıtlayın";
  }
  if (input.result === "randevu") {
    const at = input.appointmentAt ? parseIstanbulDateTime(input.appointmentAt) : null;
    if (!at) return "Ziyaret için tarih ve saat seçin";
    if (at.getTime() <= now.getTime()) return PAST_TIME;
  }
  if (input.result === "geri_ara") {
    const at = input.callbackAt ? parseIstanbulDateTime(input.callbackAt) : null;
    if (!at) return "Geri arama için tarih ve saat seçin";
    if (at.getTime() <= now.getTime()) return PAST_TIME;
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

/** Hatırlatma satırı, appointmentTasks'ın gerçekten döndürdüğü görevlere göre. */
function reminderLine(tasks: PlannedTask[]): string | null {
  const once = tasks.some((t) => t.ruleKey.endsWith(":once"));
  const sabah = tasks.some((t) => t.ruleKey.endsWith(":sabah"));
  if (once && sabah) return "1 gün önce ve aynı sabah hatırlatma kuruldu";
  if (sabah) return "Ziyaret sabahı hatırlatma kuruldu";
  if (once) return "1 gün önce hatırlatma kuruldu";
  return null;
}

/**
 * Ulaşılamadı deneme sırası: son başarılı ulaşmadan (randevu / geri ara kaydı) bu yana
 * açılmış tüm takip:<id>:n görevlerinin (elle kapatılanlar dahil) en büyük n'i; yoksa 1.
 * firstAttemptAt bu sıranın ilk denemesinin zamanıdır.
 */
async function attemptState(
  supabase: SupabaseClient,
  lead: LeadRow,
  now: Date,
): Promise<{ attempt: number; firstAttemptAt: Date }> {
  const { data: reachRows, error } = await supabase
    .from("events")
    .select("created_at")
    .eq("entity_type", "lead")
    .eq("entity_id", lead.id)
    .eq("event_type", "arama_kaydi")
    .in("payload->>result", ["randevu", "geri_ara"])
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`Arama geçmişi okunamadı: ${error.message}`);
  const lastReach = ((reachRows ?? []) as { created_at: string }[])[0]?.created_at ?? null;
  const since = lastReach ? Date.parse(lastReach) : -Infinity;

  const tasks = (await tasksByPrefix(supabase, `takip:${lead.id}:`))
    .filter((t) => Date.parse(t.createdAt) > since);
  const steps = tasks.map((t) => Number(t.ruleKey.split(":").pop())).filter((n) => Number.isInteger(n) && n > 0);
  if (steps.length === 0) return { attempt: 1, firstAttemptAt: now };
  // takip:<id>:2 ilk deneme kaydedilirken açılır; sıranın ilk denemesi o andır.
  const earliest = new Date(tasks[0].createdAt);
  const firstAttemptAt = !lastReach && lead.first_contact_at ? new Date(lead.first_contact_at) : earliest;
  return { attempt: Math.max(...steps), firstAttemptAt };
}

/** Arama ekranının kaydı: nitelik, not, olay, durum ve takip görevleri. */
export type RecordCallResult =
  | {
      done: string[];
      /** Bu kayıtla veli kapandı (uygun değil ya da 7 günde ulaşılamadı); WhatsApp düğmesi gösterilmez. */
      closed?: true;
    }
  | { error: string };

export async function recordCall(input: RecordCallInput): Promise<RecordCallResult> {
  const now = new Date();
  const invalid = validate(input, now);
  if (invalid) return { error: invalid };

  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();
  const { leadId, result } = input;

  const { data: leadData } = await supabase
    .from("leads")
    .select("id, parent_name, phone, status, converted_student_id, assigned_to, first_contact_at, gclid, created_at, web_payload")
    .eq("id", leadId)
    .maybeSingle();
  const lead = leadData as LeadRow | null;
  if (!lead) return { error: "Veli bulunamadı" };
  if (lead.converted_student_id) return { error: "Öğrenciye dönüştürülmüş veli için arama kaydedilemez" };

  const settings = await getLeadFlowSettings(supabase);

  // İlk temas yapılmadıysa veli önce üstlenilir; başkası arıyorsa hiçbir şey yazılmaz.
  // R26: durumu 'yeni' olmayan veli ilk teması yapılmış sayılır; üstlenilmez, sahibi değişmez.
  const contacted = alreadyContacted(lead);
  if (!contacted) {
    try {
      const claim = await claimLeadAs(supabase, leadId, profile.id, settings.claimMinutes, now);
      if (!claim.ok) return { error: `${claim.claimedBy} bu veliyi arıyor` };
    } catch (e) {
      console.error("recordCall claim:", e);
      return { error: GENERIC_FAILURE };
    }
  }

  // reused: mevcut randevu yeniden kullanıldı; hatırlatmalar bu çağrıda tamamlanır.
  let createdReminders: PlannedTask[] | undefined;
  let appointment: { id: string; at: Date; reused: boolean } | null = null;
  const fail = () => ({ error: appointment ? APPOINTMENT_PARTIAL : GENERIC_FAILURE });

  try {
    // Randevu önce yazılır: çakışma varsa başka hiçbir şey değişmeden kullanıcı saat değiştirir.
    // Tekrar denemede aynı velinin aynı saatteki bekleyen randevusu yeniden kullanılır.
    if (result === "randevu") {
      const at = parseIstanbulDateTime(input.appointmentAt!)!;
      const { data: existing, error: existingError } = await supabase
        .from("appointments")
        .select("id, scheduled_at")
        .eq("lead_id", leadId)
        .eq("outcome", "bekliyor")
        .eq("scheduled_at", at.toISOString())
        .limit(1)
        .maybeSingle();
      if (existingError) return fail();
      const found = existing as { id: string; scheduled_at: string } | null;
      if (found) {
        appointment = { id: found.id, at: new Date(found.scheduled_at), reused: true };
      } else {
        const res = await createAppointment(leadId, input.appointmentAt!, "okul_ziyareti");
        if (res.conflict) {
          return {
            error: `Bu saate yakın başka bir randevu var: ${res.conflict.leadName} · ${formatDayTime(new Date(res.conflict.at))}. Başka bir saat seçin.`,
          };
        }
        if (res.error || !res.id) return { error: res.error ?? "Randevu kaydedilemedi, lütfen tekrar deneyin." };
        // Hatırlatma kurulamadıysa (warning) randevu yazılıdır; aşağıda yeniden kurmayı dener,
        // o da başarısızsa kullanıcı kısmi-hata mesajını görür, tekrar denemede reuse yolu onarır.
        appointment = { id: res.id, at, reused: !!res.warning };
        createdReminders = res.warning ? undefined : res.reminders;
      }
    }

    const { attempt, firstAttemptAt } =
      result === "ulasilamadi" ? await attemptState(supabase, lead, now) : { attempt: 1, firstAttemptAt: now };
    const next = result === "ulasilamadi"
      ? followupAfterAttempt(leadId, lead.parent_name, attempt, now, firstAttemptAt, settings.hours)
      : null;

    // Ortak alanlar
    const reached =
      result === "randevu" || result === "geri_ara" ? true : result === "ulasilamadi" ? false : input.quals.reached;
    const patch: Record<string, unknown> = {
      q_reached: reached,
      last_activity_at: now.toISOString(),
    };
    // R20: ulaşılamadıda nitelik soruları sorulmadı; kayıtlı cevaplar ezilmez.
    if (result !== "ulasilamadi") {
      patch.q_age_ok = input.quals.age;
      patch.q_area_ok = input.quals.area;
      patch.q_timing_ok = input.quals.timing;
    }
    // R24: veli yalnız üstlenilince (ilk temas) ya da sahipsizse arayana geçer; takibi arayan meslektaş devralmaz.
    const owner = !contacted || !lead.assigned_to ? profile.id : lead.assigned_to;
    if (owner !== lead.assigned_to) patch.assigned_to = owner;
    if (!lead.first_contact_at) patch.first_contact_at = now.toISOString();
    const userNote = input.note?.trim();
    if (userNote) patch.contact_note = userNote;
    const { data: updated, error: updateError } = await supabase
      .from("leads").update(patch).eq("id", leadId).select("status").single();
    if (updateError) return fail();
    const statusAfter = (updated as { status: string } | null)?.status ?? null;

    // Durum değişikliği not ve olaydan önce: hata olursa tekrar denemede yinelenen not/olay kalmaz.
    let statusChange: { to: LeadStatus; reason?: LostReason } | null = null;
    if (result === "geri_ara" && lead.status === "yeni") statusChange = { to: "ulasildi" };
    if (result === "ulasilamadi" && !next && lead.status !== "kaybedildi") {
      statusChange = { to: "kaybedildi", reason: "ulasilamadi" };
    }
    if (result === "uygun_degil" && lead.status !== "kaybedildi") {
      statusChange = { to: "kaybedildi", reason: input.notFitReason! };
    }
    if (statusChange) {
      const res = await updateLeadStatus(leadId, statusChange.to, statusChange.reason);
      if (res.error) return appointment ? fail() : { error: res.error };
    }

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
    if (noteError) return appointment ? fail() : { error: "Görüşme notu kaydedilemedi" };

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

    // Bu arama yapıldı: bekleyen geri arama ve takip görevleri karşılandı.
    await closeTasksByPrefix(supabase, `geri:${leadId}`);
    await closeTasksByPrefix(supabase, `takip:${leadId}:`);
    // Ulaşıldı: kayıp sonrası "1 ay sonra kontenjan" denemesine gerek kalmadı.
    if (result === "randevu" || result === "geri_ara") await closeTasksByPrefix(supabase, `kontenjan:${leadId}`);

    let done: string[];
    let closed = false;
    // Hazır mesaj satırı yalnız ekranda gönder düğmesi varken yazılır (şablon ve geçerli telefon).
    const danisman = profile.full_name?.split(" ")[0] || profile.full_name || "";
    const hasWa = !!callWaLink(result, lead.phone ?? "", settings.templates, { veli: lead.parent_name, danisman });
    switch (result) {
      case "randevu": {
        // Yeni randevuda hatırlatmaları createAppointment kurmuştur. Yeniden kullanılan randevuda
        // (önceki deneme yarıda kalmış olabilir) burada tamamlanır; 23505 olanlar atlanır.
        const reminders =
          createdReminders ??
          appointmentTasks(appointment!.id, lead.parent_name, appointment!.at, now, settings.hours);
        if (appointment!.reused) await upsertPlannedTasks(supabase, leadId, owner, reminders);
        done = [`Ziyaret takvime yazıldı: ${formatDayTime(appointment!.at)}`];
        if (hasWa) done.push("WhatsApp onay mesajı hazır");
        const line = reminderLine(reminders);
        if (line) done.push(line);
        if (conversionQueued(lead, statusAfter, now)) done.push("Google'a \"Randevu\" dönüşümü sıraya alındı");
        break;
      }
      case "geri_ara":
        await upsertPlannedTasks(supabase, leadId, owner, [
          { ruleKey: `geri:${leadId}`, title: `Geri ara · ${lead.parent_name}`, dueAt: callbackAt!, kind: "arama" },
        ]);
        done = [
          `Geri arama görevi açıldı: ${formatDayTime(callbackAt!)}`,
          "Bugün ekranında o saatte en üstte çıkacak",
        ];
        break;
      case "ulasilamadi": {
        if (!next) {
          const kontenjan = kontenjanTask(leadId, lead.parent_name, now, settings.hours);
          const open = await upsertPlannedTasks(supabase, leadId, owner, [kontenjan]);
          done = ["7 günde ulaşılamadı · veli Kaybedildi (Ulaşılamadı) olarak kapandı"];
          // Yeni yazıldı ya da zaten açık: her iki durumda görev açıktır.
          if ([...open.inserted, ...open.alreadyOpen].includes(kontenjan.ruleKey)) {
            done.push("1 ay sonra kontenjan mesajı görevi kuruldu");
          }
          closed = true;
          break;
        }
        await upsertPlannedTasks(supabase, leadId, owner, [next]);
        const inThreeHours = next.dueAt.getTime() === now.getTime() + 3 * 3_600_000;
        done = [
          inThreeHours
            ? "3 saat sonra tekrar arama görevi açıldı"
            : `Sonraki arama görevi açıldı: ${formatDayTime(next.dueAt)}`,
        ];
        if (hasWa) done.push("Hazır WhatsApp mesajı var");
        break;
      }
      default:
        done = [`Kayıt kapatıldı · neden: ${LOST_REASONS[input.notFitReason!]}`, "Açık takip görevleri kapandı"];
        closed = true;
    }

    revalidatePath("/bugun");
    revalidatePath("/pipeline");
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/");
    return closed ? { done, closed: true } : { done };
  } catch (e) {
    console.error("recordCall:", e);
    return fail();
  }
}

export type MessageChannel = "ig_dm" | "ig_yorum" | "whatsapp" | "telefon";

const MESSAGE_CHANNELS: Record<MessageChannel, { label: string; source: "instagram" | "whatsapp" | "telefon"; fallbackName: string }> = {
  ig_dm: { label: "Instagram mesajı", source: "instagram", fallbackName: "Instagram velisi" },
  ig_yorum: { label: "Instagram yorumu", source: "instagram", fallbackName: "Instagram velisi" },
  whatsapp: { label: "WhatsApp", source: "whatsapp", fallbackName: "WhatsApp velisi" },
  telefon: { label: "Telefon", source: "telefon", fallbackName: "Telefon velisi" },
};
const CONTENT_CODE = /^[RS]-\d{4}-[A-Z]$/;
const MESSAGE_FAILURE = "Veli kaydedilemedi, lütfen tekrar deneyin";
/** Telefon ve sunucu saati arasındaki küçük kaymaya izin. */
const MESSAGE_CLOCK_SKEW_MS = 5 * 60_000;
const PARENT_NAME_MAX = 80;

export interface MessageLeadInput {
  channel: MessageChannel;
  phone: string;
  parentName?: string;
  contentCode?: string;
  messageAt?: string;
}

/** Mesajdan gelen veliyi ortak listeye açar. Aynı telefonla açık veli varsa yenisi açılmaz. */
export async function createMessageLead(
  input: MessageLeadInput,
): Promise<{ id: string; duplicate: boolean; parentName: string; inQueue: boolean } | { error: string }> {
  const channel = Object.hasOwn(MESSAGE_CHANNELS, input?.channel) ? MESSAGE_CHANNELS[input.channel] : null;
  if (!channel) return { error: "Kanalı seçin" };
  const phone = normalizeTurkishPhone(input.phone ?? "");
  if (!phone) return { error: "Geçerli bir cep telefonu girin (05XX XXX XX XX)" };
  const code = input.contentCode && CONTENT_CODE.test(input.contentCode) ? input.contentCode : null;
  const now = new Date();
  let messageAt = now;
  if (input.messageAt) {
    const parsed = parseIstanbulDateTime(input.messageAt);
    if (!parsed) return { error: "Mesaj saati geçersiz" };
    if (parsed.getTime() > now.getTime() + MESSAGE_CLOCK_SKEW_MS) return { error: "Mesaj saati gelecekte olamaz" };
    messageAt = parsed;
  }

  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();

  try {
    const { launchAt } = await getLeadFlowSettings(supabase);
    const { data: existing, error: findError } = await supabase
      .from("leads")
      .select("id, content_code, parent_name, status, first_contact_at, created_at")
      .eq("phone", phone)
      .not("status", "in", "(kazanildi,kaybedildi)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (findError) return { error: MESSAGE_FAILURE };
    const open = existing as {
      id: string;
      content_code: string | null;
      parent_name: string;
      status: string;
      first_contact_at: string | null;
      created_at: string;
    } | null;

    if (open) {
      const patch: Record<string, unknown> = { last_activity_at: now.toISOString() };
      if (code && !open.content_code) patch.content_code = code;
      const { error: updateError } = await supabase.from("leads").update(patch).eq("id", open.id);
      if (updateError) return { error: MESSAGE_FAILURE };
      const body = `Mesajla tekrar yazdı · ${channel.label}${code ? ` · ${code}` : ""}`;
      const { error: noteError } = await supabase.from("lead_notes").insert({
        lead_id: open.id, author_id: profile.id, body,
      });
      if (noteError) return { error: MESSAGE_FAILURE };
      await logEvent(supabase, {
        entityType: "lead", entityId: open.id, eventType: "mesaj_tekrar", actorId: profile.id,
        payload: { channel: input.channel, contentCode: code },
      });
      revalidatePath("/bugun");
      revalidatePath("/pipeline");
      revalidatePath(`/leads/${open.id}`);
      // Ekran mevcut kaydı anlatır: adı ve "Şimdi ara" listesinde olup olmadığı (ortak süzgeçle aynı kural).
      const inQueue = open.status === "yeni" && !open.first_contact_at && inQueueWindow(open.created_at, launchAt);
      return { id: open.id, duplicate: true, parentName: open.parent_name, inQueue };
    }

    const parentName = input.parentName?.trim().slice(0, PARENT_NAME_MAX).trim() || channel.fallbackName;
    const { data, error } = await supabase.from("leads").insert({
      parent_name: parentName,
      phone,
      source: channel.source,
      channel: input.channel,
      content_code: code,
      assigned_to: null,
      created_at: messageAt.toISOString(),
      last_activity_at: now.toISOString(),
    }).select("id").single();
    const row = data as { id: string } | null;
    if (error || !row) return { error: MESSAGE_FAILURE };
    await logEvent(supabase, {
      entityType: "lead", entityId: row.id, eventType: "lead_olusturuldu", actorId: profile.id,
      payload: { source: channel.source, channel: input.channel, contentCode: code },
    });
    revalidatePath("/bugun");
    revalidatePath("/pipeline");
    return { id: row.id, duplicate: false, parentName, inQueue: inQueueWindow(messageAt.toISOString(), launchAt) };
  } catch (e) {
    console.error("createMessageLead:", e);
    return { error: MESSAGE_FAILURE };
  }
}

/** Son 28 günde açılan velilerin içerik kodları, çoktan aza. */
export async function recentContentCodes(): Promise<{ code: string; count: number }[]> {
  await getSessionProfile();
  const supabase = await createServerSupabase();
  const since = new Date(Date.now() - 28 * 86_400_000).toISOString();
  const { data } = await supabase
    .from("leads")
    .select("content_code")
    .not("content_code", "is", null)
    .gte("created_at", since);
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as { content_code: string | null }[]) {
    if (r.content_code) counts.set(r.content_code, (counts.get(r.content_code) ?? 0) + 1);
  }
  return [...counts].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count);
}
