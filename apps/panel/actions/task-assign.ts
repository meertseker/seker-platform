"use server";

// Görev ver: danışman ya da yönetici haftanın yuvalarına öğretmen görevi açar.
// Görev açmanın tek yolu createContentTask'tır (öğretmen denetimi, kod, bildirim, WhatsApp bağlantısı orada);
// burada yalnız yuva → tür/harf eşlemesi ve hafta denetimi yapılır.
import { revalidatePath } from "next/cache";
import { createContentTask } from "@/actions/content";
import { requireRole } from "@/lib/auth";
import { allowedTaskWeeks, isWeeklySlot, SLOTS, type WeeklySlot } from "@/lib/content/slots";
import { TASK_ASSIGN_PATH } from "@/lib/role-access";

export type AssignTaskInput = {
  slot: WeeklySlot;
  ownerId: string;
  topic: string;
  /** Öğretmene not (seçilen önerinin açıklaması ya da elle yazılan). */
  brief?: string;
  dueAt: string;
};

export type AssignResult =
  | {
      ok: true;
      created: { slot: WeeklySlot; code: string; waLink: string | null }[];
      errors: { slot: WeeklySlot; error: string }[];
    }
  | { error: string };

export async function assignContentTasks(input: { weekStart: string; tasks: AssignTaskInput[] }): Promise<AssignResult> {
  await requireRole("yonetici", "danisman");

  const weekStart = typeof input?.weekStart === "string" ? input.weekStart : "";
  if (!allowedTaskWeeks(new Date()).includes(weekStart)) return { error: "Hafta geçersiz." };

  const seen = new Set<WeeklySlot>();
  const tasks = (Array.isArray(input.tasks) ? input.tasks : []).filter((t) => {
    if (!t || !isWeeklySlot(t.slot) || seen.has(t.slot)) return false;
    seen.add(t.slot);
    return true;
  });
  if (tasks.length === 0) return { error: "Gönderilecek görev yok." };

  const created: { slot: WeeklySlot; code: string; waLink: string | null }[] = [];
  const errors: { slot: WeeklySlot; error: string }[] = [];
  for (const t of tasks) {
    const def = SLOTS[t.slot];
    const res = await createContentTask({
      kind: def.kind,
      reelsLetter: def.reelsLetter,
      pagePlatform: def.pagePlatform,
      ownerId: t.ownerId,
      topic: t.topic,
      brief: t.brief,
      dueAt: t.dueAt,
      weekOf: weekStart,
    });
    if ("error" in res) errors.push({ slot: t.slot, error: res.error });
    else created.push({ slot: t.slot, code: res.code, waLink: res.waLink });
  }

  revalidatePath(TASK_ASSIGN_PATH);
  return { ok: true, created, errors };
}
