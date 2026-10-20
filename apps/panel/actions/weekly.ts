"use server";

// Bu hafta: Pazartesi toplantısını kaydet. Konu ve dört içerik görevi (Reels A/B, Google ve Instagram sayfası)
// toplantı haftasından SONRAKİ haftaya açılır; weekly_reviews satırı (konu, verilen kararlar, görevler) güncellenir.
// Yazımlar yalnız gizli anahtarlı istemcidedir ve önce requireRole("yonetici") ile rol doğrulanır.

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@seker/auth/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/auth";
import { createContentTask } from "@/actions/content";
import { mondayOf } from "@/lib/ads/weekly";
import type { ReelsLetter } from "@/lib/content/codes";
import { addDaysToDateString, formatDayTime, parseIstanbulDateTime } from "@/lib/lead-flow/business-hours";
import { waMeUrl } from "@/lib/whatsapp";

export type WeeklySlot = "reels_a" | "reels_b" | "sayfa_google" | "sayfa_instagram";

export type WeeklyTaskInput = {
  slot: WeeklySlot;
  ownerId: string | null;
  dueAt: string;
  audience?: string;
  brief?: string;
};

export type SaveWeeklyReviewResult =
  | { ok: true; created: { code: string; owner: string }[]; waLinks: { owner: string; url: string }[] }
  | { error: string };

type SlotDef = { label: string; kind: "reels" | "sayfa"; letter: string; reelsLetter?: ReelsLetter; pagePlatform?: "google" | "instagram" };

/** Slot → içerik türü ve kod harfi (R-..-A, R-..-B, S-..-G, S-..-I). */
const SLOTS: Record<WeeklySlot, SlotDef> = {
  reels_a: { label: "Reels A", kind: "reels", letter: "A", reelsLetter: "A" },
  reels_b: { label: "Reels B", kind: "reels", letter: "B", reelsLetter: "B" },
  sayfa_google: { label: "Sayfa · Google", kind: "sayfa", letter: "G", pagePlatform: "google" },
  sayfa_instagram: { label: "Sayfa · Instagram", kind: "sayfa", letter: "I", pagePlatform: "instagram" },
};
const SLOT_ORDER: WeeklySlot[] = ["reels_a", "reels_b", "sayfa_google", "sayfa_instagram"];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PATH = "/reklam/hafta";

function db(): SupabaseClient {
  return createAdminSupabase() as unknown as SupabaseClient;
}

/** Kodun slotu: "R-2643-B" → reels_b; "S-2643-I" → sayfa_instagram. Bilinmeyen kod null. */
function slotOfCode(code: string): WeeklySlot | null {
  const prefix = code.charAt(0);
  const letter = code.slice(-1);
  return SLOT_ORDER.find((s) => (SLOTS[s].kind === "reels" ? "R" : "S") === prefix && SLOTS[s].letter === letter) ?? null;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "Merhaba";
}

/**
 * Toplantıyı kaydeder. Boş sahipli slot atlanır; o hafta aynı slotun görevi zaten varsa yeniden açılmaz
 * (ikinci kayıt yalnız eksik slotları açar ve weekly_reviews'i günceller). Bir görev açılamazsa açılanlar kalır;
 * düzeltip yeniden kaydetmek onları çiftlemez.
 */
export async function saveWeeklyReview(input: {
  weekStart: string;
  topic: string;
  tasks: WeeklyTaskInput[];
}): Promise<SaveWeeklyReviewResult> {
  const profile = await requireRole("yonetici");

  const weekStart = typeof input?.weekStart === "string" ? input.weekStart : "";
  if (!DATE_RE.test(weekStart) || Number.isNaN(Date.parse(`${weekStart}T00:00:00Z`)) || mondayOf(weekStart) !== weekStart) {
    return { error: "Hafta geçersiz." };
  }
  const topic = typeof input.topic === "string" ? input.topic.trim() : "";
  if (topic.length < 3) return { error: "Bu haftanın konusunu yazın." };
  if (topic.length > 200) return { error: "Konu en fazla 200 karakter olabilir." };

  // Her slot bir kez; tanınmayan slot yok sayılır.
  const bySlot = new Map<WeeklySlot, WeeklyTaskInput>();
  for (const t of Array.isArray(input.tasks) ? input.tasks : []) {
    if (t && SLOT_ORDER.includes(t.slot) && !bySlot.has(t.slot)) bySlot.set(t.slot, t);
  }
  const filled = SLOT_ORDER.map((s) => bySlot.get(s)).filter(
    (t): t is WeeklyTaskInput & { ownerId: string } => !!t && typeof t.ownerId === "string" && t.ownerId.trim() !== "",
  );

  // Görev açmadan önce teslim zamanları denetlenir: yarım kayıt kalmasın.
  for (const t of filled) {
    const due = parseIstanbulDateTime(typeof t.dueAt === "string" ? t.dueAt : "");
    if (!due) return { error: `${SLOTS[t.slot].label}: teslim zamanını seçin.` };
    if (due.getTime() <= Date.now()) return { error: `${SLOTS[t.slot].label}: teslim zamanı geçmiş olamaz.` };
  }

  const admin = db();
  const taskWeek = addDaysToDateString(weekStart, 7);

  const { data: existingRows, error: existingErr } = await admin
    .from("content_items")
    .select("id, code, kind")
    .eq("week_start", taskWeek);
  if (existingErr) return { error: "Kaydedilemedi, tekrar deneyin." };
  const existing = new Map<WeeklySlot, string>();
  for (const r of (existingRows ?? []) as { id: string; code: string; kind: string }[]) {
    const slot = slotOfCode(r.code);
    if (slot && SLOTS[slot].kind === r.kind && !existing.has(slot)) existing.set(slot, r.id);
  }

  const ownerIds = [...new Set(filled.map((t) => t.ownerId))];
  const owners = new Map<string, { name: string; phone: string | null }>();
  if (ownerIds.length > 0) {
    const { data } = await admin.from("profiles").select("id, full_name, phone").in("id", ownerIds);
    for (const p of (data ?? []) as { id: string; full_name: string | null; phone: string | null }[]) {
      owners.set(p.id, { name: p.full_name?.trim() || "Öğretmen", phone: p.phone });
    }
  }

  const created: { code: string; owner: string; ownerId: string; dueAt: string; slot: WeeklySlot; id: string }[] = [];
  let failure: string | null = null;
  for (const t of filled) {
    if (existing.has(t.slot)) continue;
    const def = SLOTS[t.slot];
    const res = await createContentTask({
      kind: def.kind,
      pagePlatform: def.pagePlatform,
      reelsLetter: def.reelsLetter,
      ownerId: t.ownerId,
      topic,
      audience: t.audience,
      brief: t.brief,
      dueAt: t.dueAt,
      weekOf: taskWeek,
    });
    if ("error" in res) {
      failure = `${def.label}: ${res.error}`;
      break;
    }
    created.push({ code: res.code, owner: owners.get(t.ownerId)?.name ?? "Öğretmen", ownerId: t.ownerId, dueAt: t.dueAt, slot: t.slot, id: res.id });
    existing.set(t.slot, res.id);
  }

  // Toplantının kararları: haftanın onaylanan ve bekletilen önerileri.
  const { data: recRows } = await admin
    .from("ad_recommendations")
    .select("id, title, status, result")
    .eq("week_start", weekStart)
    .in("status", ["onaylandi", "bekletildi"]);
  const decisions = ((recRows ?? []) as { id: string; title: string; status: string; result: string | null }[]).map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    result: r.result,
  }));

  const { error: upErr } = await admin.from("weekly_reviews").upsert(
    {
      week_start: weekStart,
      topic,
      decisions,
      task_ids: SLOT_ORDER.map((s) => existing.get(s)).filter((id): id is string => !!id),
      saved_by: profile.id,
      saved_at: new Date().toISOString(),
    },
    { onConflict: "week_start" },
  );

  revalidatePath(PATH);
  if (failure) {
    return { error: `${failure} Açılan görevler kayıtlı; düzeltip yeniden kaydedin, çiftlenmez.` };
  }
  if (upErr) {
    console.error("[weekly] toplantı kaydedilemedi:", upErr.code ?? "bilinmeyen");
    return { error: "Görevler açıldı ama toplantı kaydedilemedi; yeniden kaydedin, görevler çiftlenmez." };
  }

  // Öğretmen başına tek WhatsApp mesajı: kendi görev kodları ve teslim zamanları.
  const waLinks: { owner: string; url: string }[] = [];
  for (const ownerId of [...new Set(created.map((c) => c.ownerId))]) {
    const owner = owners.get(ownerId);
    if (!owner?.phone) continue;
    const own = created.filter((c) => c.ownerId === ownerId);
    const list = own
      .map((c) => `${c.code} (${SLOTS[c.slot].label}, teslim ${formatDayTime(parseIstanbulDateTime(c.dueAt) as Date)})`)
      .join(", ");
    const message =
      `${firstName(owner.name)} Hocam, bu haftanın ${own.length > 1 ? "görevleri" : "görevi"} panelde. ` +
      `Konu: ${topic}. ${list}. Görevim ekranından açabilirsin.`;
    const url = waMeUrl(owner.phone, message);
    if (url) waLinks.push({ owner: owner.name, url });
  }

  return { ok: true, created: created.map(({ code, owner }) => ({ code, owner })), waLinks };
}
