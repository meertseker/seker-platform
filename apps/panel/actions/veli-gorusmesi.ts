"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { logEvent } from "@/lib/events";
import { createServerSupabase } from "@/lib/supabase/server";
import { validateGorusmeInput, type GorusmeInput } from "@/lib/veli-gorusmesi";

/** Gruba giden olayda not bu uzunlukta kesilir; tam metin veli_gorusmeleri'nde kalır. */
const EVENT_NOTE_MAX = 600;

/**
 * Borçlu veliyle yapılan görüşmeyi kaydeder (yönetici ve danışman). Olay ödeme grubuna düşer
 * (lib/wa/routing.ts 'veli_gorusmesi'). Söz verildiyse söz günü /api/cron/daily ödemeyi denetler.
 */
export async function recordVeliGorusmesi(studentId: string, input: GorusmeInput) {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici" && profile.role !== "danisman") {
    return { error: "Bu işlem için yetkiniz yok" };
  }
  if (!studentId) return { error: "Öğrenci bulunamadı" };

  const checked = validateGorusmeInput(input, new Date());
  if ("error" in checked) return { error: checked.error };
  const { record } = checked;

  const supabase = await createServerSupabase();
  const { data: student } = await supabase
    .from("students")
    .select("id, full_name")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return { error: "Öğrenci bulunamadı" };

  const { data: row, error } = await supabase
    .from("veli_gorusmeleri")
    .insert({ ...record, student_id: studentId, author_id: profile.id })
    .select("id")
    .single();
  if (error || !row) return { error: "Görüşme kaydedilemedi" };

  const note = record.note && record.note.length > EVENT_NOTE_MAX ? `${record.note.slice(0, EVENT_NOTE_MAX)}…` : record.note;
  await logEvent(supabase, {
    entityType: "student",
    entityId: studentId,
    eventType: "veli_gorusmesi",
    actorId: profile.id,
    payload: {
      gorusmeId: row.id,
      fullName: student.full_name,
      contactWith: record.contact_with,
      outcome: record.outcome,
      contactedAt: record.contacted_at,
      promiseDate: record.promise_date,
      promiseAmountTl: record.promise_amount,
      note,
    },
  });

  revalidatePath(`/ogrenciler/${studentId}`);
  revalidatePath("/odemeler/gecikenler");
  return { ok: true as const, id: row.id as string };
}
