"use server";

// İçerik görevleri: yönetici görev açar, öğretmen hazırlayıp teslim eder, tek yönetici onayı yeter.
// Öğretmen eylemleri oturum istemcisiyle (RLS + kolon yetkisi) yazar; ekleme, onay, aşama ve bildirim
// gizli anahtarlı istemcidedir ve her biri önce requireRole ile rolü doğrular.
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@seker/auth/admin";
import { requireRole } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { notify } from "@/actions/notifications";
import { nextContentCode, weekStart, type ContentKind, type PagePlatform } from "@/lib/content/codes";
import { nextStageAfterApproval, type StageKey } from "@/lib/content/stages";
import { getContentRules } from "@/lib/content/settings";
import {
  CONTENT_BUCKET,
  VIDEO_MIME_TYPES,
  activeManagerIds,
  contentBlockers,
  isOwnMediaPath,
  isPageFieldKey,
  safeVideoFileName,
  takenCodes,
  videoExists,
  videoMaxMb,
  videoSizeError,
  type SubmittableRow,
} from "@/lib/content/store";
import { formatDayTime, parseIstanbulDateTime } from "@/lib/lead-flow/business-hours";
import { waMeUrl } from "@/lib/whatsapp";

type Ok = { ok: true } | { error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = "İçerik bulunamadı";
const LOCKED = "Bu içerik şu an değiştirilemez";
const CODE_ATTEMPTS = 3;
const BOARD = "/reklam/icerik";
const MY_TASKS = "/gorevim";

const STAGE_MOVES: Partial<Record<StageKey, StageKey[]>> = {
  organik: ["test", "arsiv"],
  test: ["kazanan", "arsiv"],
  kazanan: ["arsiv"],
};

type ItemRow = SubmittableRow & {
  id: string;
  code: string;
  owner_id: string;
  status: string;
  stage: string;
  submitted_at: string | null;
  updated_at: string;
};

const ITEM_COLUMNS =
  "id, code, kind, owner_id, status, stage, caption, page_fields, media_path, face_answer, submitted_at, updated_at";
const CHANGED = "İçerik değişti, sayfayı yenileyin";

function nowIso(): string {
  return new Date().toISOString();
}

// === Yönetici ===

export type CreateContentTaskInput = {
  kind: ContentKind;
  pagePlatform?: PagePlatform;
  ownerId: string;
  topic: string;
  audience?: string;
  brief?: string;
  dueAt: string;
  weekOf?: string;
};

function optionalText(value: string | undefined, max: number): string | null {
  const t = (value ?? "").trim();
  return t ? t.slice(0, max) : null;
}

export async function createContentTask(
  input: CreateContentTaskInput,
): Promise<{ id: string; code: string; waLink: string | null } | { error: string }> {
  const profile = await requireRole("yonetici");

  if (input.kind !== "reels" && input.kind !== "sayfa") return { error: "Görev türünü seçin" };
  const pagePlatform: PagePlatform = input.pagePlatform === "instagram" ? "instagram" : "google";
  if (!UUID_RE.test(input.ownerId ?? "")) return { error: "Öğretmeni seçin" };
  const topic = (input.topic ?? "").trim();
  if (topic.length < 3) return { error: "Konuyu yazın" };
  if (topic.length > 200) return { error: "Konu en fazla 200 karakter olabilir" };
  const due = parseIstanbulDateTime(input.dueAt ?? "");
  if (!due) return { error: "Teslim zamanını seçin" };
  if (due.getTime() <= Date.now()) return { error: "Teslim zamanı geçmiş olamaz" };
  let at = new Date();
  if (input.weekOf) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.weekOf)) return { error: "Hafta geçersiz" };
    at = new Date(`${input.weekOf}T12:00:00+03:00`);
    if (Number.isNaN(at.getTime())) return { error: "Hafta geçersiz" };
  }

  const admin = createAdminSupabase();
  const { data: owner } = await admin
    .from("profiles")
    .select("id, full_name, role, is_active, phone")
    .eq("id", input.ownerId)
    .maybeSingle();
  if (!owner || owner.role !== "ogretmen" || !owner.is_active) {
    return { error: "Görev yalnız etkin bir öğretmene verilebilir" };
  }

  const week = weekStart(at);
  const platform: PagePlatform = input.kind === "reels" ? "instagram" : pagePlatform;
  let created: { id: string; code: string } | null = null;
  try {
    // Eşzamanlı iki açılış aynı kodu alırsa tekil kısıt (23505) yakalar; kodlar yeniden okunup sonraki harf denenir.
    for (let attempt = 0; attempt < CODE_ATTEMPTS && !created; attempt++) {
      const code = nextContentCode(input.kind, at, await takenCodes(admin, week), pagePlatform);
      if (!code) {
        return {
          error: input.kind === "reels"
            ? "Bu hafta için üç Reels görevi zaten açık"
            : "Bu hafta için bu sayfa görevi zaten açık",
        };
      }
      const { data, error } = await admin
        .from("content_items")
        .insert({
          code,
          kind: input.kind,
          platform,
          week_start: week,
          topic,
          audience: optionalText(input.audience, 200),
          brief: optionalText(input.brief, 1000),
          owner_id: owner.id,
          due_at: due.toISOString(),
          created_by: profile.id,
        })
        .select("id")
        .single();
      if (!error && data) created = { id: data.id, code };
      else if (error?.code !== "23505") {
        console.error("[content] createContentTask başarısız:", error?.code ?? "bilinmeyen");
        return { error: "Görev açılamadı, tekrar deneyin" };
      }
    }
  } catch (e) {
    console.error("[content] createContentTask başarısız:", e instanceof Error ? e.message : "bilinmeyen");
    return { error: "Görev açılamadı, tekrar deneyin" };
  }
  if (!created) return { error: "Kod alınamadı, tekrar deneyin" };

  await notify(admin, owner.id, "icerik_gorev", { contentId: created.id, code: created.code });

  const firstName = (owner.full_name ?? "").trim().split(/\s+/)[0] || "Merhaba";
  const message =
    `${firstName} Hocam, bu haftanın ${input.kind === "reels" ? "Reels" : "sayfa"} görevi panelde: ${topic}. ` +
    `Teslim: ${formatDayTime(due)}. Görevim ekranından açabilirsin.`;
  const waLink = owner.phone ? waMeUrl(owner.phone, message) : null;

  revalidatePath(BOARD);
  return { ...created, waLink };
}

async function loadForManager(contentId: string) {
  const admin = createAdminSupabase();
  if (!UUID_RE.test(contentId ?? "")) return { admin, row: null };
  const { data } = await admin.from("content_items").select(ITEM_COLUMNS).eq("id", contentId).maybeSingle();
  return { admin, row: data as ItemRow | null };
}

export async function approveContent(
  contentId: string,
  confirm: { noStudentFaceOrName: boolean; submittedAt: string | null },
): Promise<Ok> {
  const profile = await requireRole("yonetici");
  const { admin, row } = await loadForManager(contentId);
  if (!row) return { error: NOT_FOUND };
  if (row.status !== "teslim") return { error: "Yalnız teslim edilmiş içerik onaylanır" };
  // Onay, yöneticinin incelediği teslime bağlıdır: arada yeniden teslim edildiyse onaylanmaz.
  const seen = confirm?.submittedAt;
  if (typeof seen !== "string" || !row.submitted_at || new Date(seen).getTime() !== new Date(row.submitted_at).getTime()) {
    return { error: CHANGED };
  }
  const confirmed = confirm?.noStudentFaceOrName === true;
  if (row.kind === "reels") {
    // MEB Ek Madde 4: onaylayan da videoyu izleyip ikinci kontrolü yapar.
    if (!confirmed) return { error: "Videoyu izleyip öğrenci yüzü ve adı olmadığını onaylayın" };
    if (row.face_answer !== false) return { error: "Öğretmenin yüz sorusu cevabı Hayır değil; düzeltme isteyin" };
  }

  const now = nowIso();
  const { data, error } = await admin
    .from("content_items")
    .update({
      status: "onaylandi",
      approved_by: profile.id,
      approved_at: now,
      approver_face_check: row.kind === "reels" ? true : confirmed || null,
      stage: nextStageAfterApproval(row.kind),
      stage_changed_at: now,
    })
    .eq("id", row.id)
    .eq("status", "teslim")
    .eq("submitted_at", row.submitted_at)
    .select("id");
  if (error) return { error: "Onay kaydedilemedi, sayfayı yenileyin" };
  if (!data || data.length === 0) return { error: CHANGED };

  await notify(admin, row.owner_id, "icerik_onay", { contentId: row.id, code: row.code });
  revalidatePath(BOARD);
  revalidatePath(MY_TASKS);
  return { ok: true };
}

export async function requestRevision(contentId: string, note: string): Promise<Ok> {
  await requireRole("yonetici");
  const text = (note ?? "").trim();
  if (text.length < 3) return { error: "Düzeltme notunu yazın (en az 3 karakter)" };
  if (text.length > 1000) return { error: "Not en fazla 1000 karakter olabilir" };
  const { admin, row } = await loadForManager(contentId);
  if (!row) return { error: NOT_FOUND };
  if (row.status !== "teslim") return { error: "Yalnız teslim edilmiş içerik için düzeltme istenir" };

  const { data, error } = await admin
    .from("content_items")
    // Yeni video gelebilir: yüz cevabı ve onaylayanın kutusu yeniden sorulur.
    .update({
      status: "duzeltme",
      stage: "gorev",
      review_note: text,
      stage_changed_at: nowIso(),
      face_answer: null,
      approver_face_check: null,
    })
    .eq("id", row.id)
    .eq("status", "teslim")
    .select("id");
  if (error || !data || data.length === 0) return { error: "Düzeltme isteği kaydedilemedi, sayfayı yenileyin" };

  await notify(admin, row.owner_id, "icerik_duzeltme", { contentId: row.id, code: row.code, note: text });
  revalidatePath(BOARD);
  revalidatePath(MY_TASKS);
  return { ok: true };
}

export async function moveContentStage(contentId: string, to: StageKey): Promise<Ok> {
  await requireRole("yonetici");
  const { admin, row } = await loadForManager(contentId);
  if (!row) return { error: NOT_FOUND };
  const allowed = STAGE_MOVES[row.stage as StageKey] ?? [];
  if (!allowed.includes(to)) return { error: "Bu aşama geçişi yapılamaz" };

  const { data, error } = await admin
    .from("content_items")
    .update({ stage: to, stage_changed_at: nowIso() })
    .eq("id", row.id)
    .eq("stage", row.stage)
    .select("id");
  if (error || !data || data.length === 0) return { error: "Aşama kaydedilemedi, sayfayı yenileyin" };
  revalidatePath(BOARD);
  return { ok: true };
}

export async function saveLearnedNote(contentId: string, note: string): Promise<Ok> {
  await requireRole("yonetici");
  const text = (note ?? "").trim();
  if (text.length > 1000) return { error: "Not en fazla 1000 karakter olabilir" };
  const { admin, row } = await loadForManager(contentId);
  if (!row) return { error: NOT_FOUND };
  const { error } = await admin.from("content_items").update({ learned_note: text || null }).eq("id", row.id);
  if (error) return { error: "Not kaydedilemedi" };
  revalidatePath(BOARD);
  return { ok: true };
}

const IG_POST_RE = /^https:\/\/www\.instagram\.com\/(reel|p)\/([A-Za-z0-9_-]+)\/?(?:\?.*)?$/;

export async function linkInstagramPost(contentId: string, permalink: string): Promise<Ok> {
  await requireRole("yonetici");
  const match = IG_POST_RE.exec((permalink ?? "").trim());
  if (!match) return { error: "Bağlantı https://www.instagram.com/reel/... biçiminde olmalı" };
  const { admin, row } = await loadForManager(contentId);
  if (!row) return { error: NOT_FOUND };
  // ig_media_id sabah senkronunda bu bağlantıdan çözülür; bağlantı değişince eskisi geçersiz olur.
  const { error } = await admin
    .from("content_items")
    .update({ ig_permalink: `https://www.instagram.com/${match[1]}/${match[2]}/`, ig_media_id: null, ig_published_at: null })
    .eq("id", row.id);
  if (error) return { error: "Bağlantı kaydedilemedi" };
  // Eski gönderinin sayıları yeni bağlantıda görünmesin.
  const { error: statsError } = await admin.from("content_organic_stats").delete().eq("content_id", row.id);
  if (statsError) return { error: "Eski sayılar silinemedi, bağlantıyı yeniden kaydedin" };
  revalidatePath(BOARD);
  return { ok: true };
}

// === Öğretmen ===

async function loadOwn(contentId: string, me: string) {
  const supabase = await createServerSupabase();
  if (!UUID_RE.test(contentId ?? "")) return { supabase, row: null };
  const { data } = await supabase.from("content_items").select(ITEM_COLUMNS).eq("id", contentId).maybeSingle();
  const row = data as ItemRow | null;
  return { supabase, row: row && row.owner_id === me ? row : null };
}

function editable(row: ItemRow): boolean {
  return row.status === "taslak" || row.status === "duzeltme";
}

export async function requestVideoUpload(
  contentId: string,
  fileName: string,
  size: number,
  mime: string,
): Promise<{ path: string; signedUrl: string; token: string } | { error: string }> {
  const profile = await requireRole("ogretmen");
  if (!(VIDEO_MIME_TYPES as readonly string[]).includes(mime)) {
    return { error: "Yalnız MP4 ya da MOV video yüklenebilir" };
  }
  if (!Number.isFinite(size) || size <= 0) return { error: "Video okunamadı, yeniden seç" };
  const tooLarge = videoSizeError(size, videoMaxMb());
  if (tooLarge) return { error: tooLarge };

  const { row } = await loadOwn(contentId, profile.id);
  if (!row) return { error: NOT_FOUND };
  if (row.kind !== "reels") return { error: "Bu görevde video yok" };
  if (!editable(row)) return { error: LOCKED };

  // Her istek yeni bir ad alır ve üzerine yazılamaz: teslim ya da onaydan sonra eski adresle video değiştirilemez.
  const name = safeVideoFileName(fileName ?? "", mime, randomBytes(4).toString("hex"));
  const path = `${row.owner_id}/${row.id}/${name}`;
  const admin = createAdminSupabase();
  const { data, error } = await admin.storage.from(CONTENT_BUCKET).createSignedUploadUrl(path, { upsert: false });
  if (error || !data) {
    console.error("[content] yükleme adresi alınamadı:", error?.message ?? "bilinmeyen");
    return { error: "Yükleme başlatılamadı, tekrar dene" };
  }
  return { path, signedUrl: data.signedUrl, token: data.token };
}

export type ContentDraftInput = {
  caption?: string;
  pageFields?: Record<string, string>;
  mediaPath?: string;
  mediaMeta?: { name: string; size: number; durationSec?: number };
  faceAnswer?: boolean | null;
};

export async function saveContentDraft(contentId: string, input: ContentDraftInput): Promise<Ok> {
  const profile = await requireRole("ogretmen");
  if (!UUID_RE.test(contentId ?? "")) return { error: NOT_FOUND };

  const patch: Record<string, unknown> = {};
  if (input.caption !== undefined) {
    if (typeof input.caption !== "string" || input.caption.length > 2200) return { error: "Açıklama çok uzun" };
    patch.caption = input.caption;
  }
  if (input.pageFields !== undefined) {
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(input.pageFields ?? {})) {
      if (!isPageFieldKey(key) || typeof value !== "string" || value.length > 1000) {
        return { error: "Sayfa alanları geçersiz" };
      }
      fields[key] = value;
    }
    patch.page_fields = fields;
  }
  if (input.mediaPath !== undefined) {
    if (typeof input.mediaPath !== "string" || !isOwnMediaPath(input.mediaPath, profile.id, contentId)) {
      return { error: "Video yolu geçersiz" };
    }
    patch.media_path = input.mediaPath;
  }
  if (input.mediaMeta !== undefined) {
    const m = input.mediaMeta;
    if (!m || typeof m.name !== "string" || typeof m.size !== "number" ||
        (m.durationSec !== undefined && typeof m.durationSec !== "number")) {
      return { error: "Video bilgisi geçersiz" };
    }
    patch.media_meta = {
      name: m.name.slice(0, 200),
      size: m.size,
      ...(m.durationSec !== undefined ? { durationSec: m.durationSec } : {}),
    };
  }
  if (input.faceAnswer !== undefined) {
    if (input.faceAnswer !== null && typeof input.faceAnswer !== "boolean") return { error: "Cevap geçersiz" };
    patch.face_answer = input.faceAnswer;
  }
  if (Object.keys(patch).length === 0) return { ok: true };

  // RLS: yalnız sahibi ve yalnız taslak|duzeltme iken; teslimden sonra satır eşleşmez.
  const supabase = await createServerSupabase();
  if (patch.media_path !== undefined && patch.face_answer === undefined) {
    // Video değişti: eski "Hayır" cevabı yeni videoyu kapsamaz, soru yeniden sorulur (MEB Ek Madde 4).
    const { row } = await loadOwn(contentId, profile.id);
    if (!row) return { error: LOCKED };
    if (row.media_path !== patch.media_path) patch.face_answer = null;
  }
  const { data, error } = await supabase
    .from("content_items")
    .update(patch)
    .eq("id", contentId)
    .eq("owner_id", profile.id)
    .in("status", ["taslak", "duzeltme"])
    .select("id");
  if (error || !data || data.length === 0) return { error: LOCKED };
  return { ok: true };
}

const DONE = ["Otomatik kontrol geçti", "Yöneticinin onayında"];

export async function submitContent(
  contentId: string,
): Promise<{ ok: true; done: string[] } | { error: string; blockers?: string[] }> {
  const profile = await requireRole("ogretmen");
  const { supabase, row } = await loadOwn(contentId, profile.id);
  if (!row) return { error: NOT_FOUND };
  if (!editable(row)) return { error: "Bu içerik zaten teslim edildi" };

  // İstemci kontrolü atlansa da aynı kural sunucuda çalışır (MEB Ek Madde 4: yüz "Evet" teslim edilemez).
  const rules = await getContentRules(supabase);
  const blockers = contentBlockers(row, rules);
  if (blockers.length > 0) return { error: "Teslim için eksikleri tamamla", blockers };

  const admin = createAdminSupabase();
  if (row.kind === "reels" && !(row.media_path && (await videoExists(admin, row.media_path)))) {
    return { error: "Video bulunamadı, yeniden yükle" };
  }

  // Öğretmenin oturumu durumu değiştiremez (kolon yetkisi yok); teslim kontrollerden sonra burada yazılır.
  // submitted_at, stage='kontrol' ve stage_changed_at aynı güncellemede DB tetikleyicisinde damgalanır.
  // updated_at eşleşmesi: kontrol edilen sürüm teslim edilir; arada yazı kaydedildiyse satır eşleşmez.
  const { data, error } = await admin
    .from("content_items")
    .update({ status: "teslim" })
    .eq("id", row.id)
    .eq("owner_id", profile.id)
    .in("status", ["taslak", "duzeltme"])
    .eq("updated_at", row.updated_at)
    .select("id");
  if (error?.code === "23514") return { error: "Öğrenci yüzü ya da adı olan içerik teslim edilemez" };
  if (error) return { error: "Teslim edilemedi, sayfayı yenile" };
  if (!data || data.length === 0) return { error: "Yazı değişti, tekrar dene" };

  const managers = await activeManagerIds(admin);
  for (const id of managers) {
    await notify(admin, id, "icerik_teslim", { contentId: row.id, code: row.code });
  }

  revalidatePath(MY_TASKS);
  revalidatePath(BOARD);
  return { ok: true, done: DONE };
}
