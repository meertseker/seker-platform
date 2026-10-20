"use server";

// Panelin önerdiği kararlar: Onayla / Şimdilik bekle. İkisi de kayda geçer (kim, ne zaman, sonuç).
// Platform eylemi değişiklik kapısından (applyAdChange) geçer: kırmızı kapı ve büyütme sınırı orada denetlenir,
// ad_change_log'a source="oneri" ile yazılır. Aşama eylemi moveContentStage ile.
// Yazımlar yalnız gizli anahtarlı istemcidedir ve her biri önce requireRole("yonetici") ile rolü doğrular.

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@seker/auth/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/auth";
import { applyAdChange } from "@/actions/ad-changes";
import { moveContentStage } from "@/actions/content";
import { getAdSettings } from "@/lib/ads/ad-settings";
import {
  APPLIED_RESULT,
  CLOSED_RESULT,
  HOLD_RESULT,
  NO_OBJECT_RESULT,
  buildRecommendations,
  supabaseRecommendationStore,
  syncRecommendations,
} from "@/lib/ads/recommendations";
import { computeWeekGates, lastCompletedWeekStart } from "@/lib/ads/weekly";
import { getLeadFlowSettings } from "@/lib/lead-flow/settings";
import { loadRecInputs } from "@/lib/queries/recommendations";
import { loadWeeklyData } from "@/lib/queries/weekly";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DECIDED = "Bu öneri için karar zaten verildi.";
const INVALID = "Bu öneri artık geçerli değil.";
const PAST_WEEK = "Bu öneri geçmiş bir haftaya ait.";
const PATH = "/reklam/hafta";

type Decision = { ok: true; result: string } | { error: string; needsReason?: boolean };

function db(): SupabaseClient {
  return createAdminSupabase() as unknown as SupabaseClient;
}

/**
 * Öneriyi onaylar ve uygular. Önce öneri karar sahibine ayrılır (iki kişi aynı anda onaylasa da tek uygulama);
 * uygulama başarısız olursa (gerekçe istendi dahil) öneri yeniden açılır.
 * Kırmızı kapıda bütçe artışı `reason` (en az 10 karakter) olmadan uygulanmaz: `needsReason` döner.
 */
export async function approveRecommendation(id: string, reason?: string): Promise<Decision> {
  const profile = await requireRole("yonetici");
  if (typeof id !== "string" || !UUID.test(id)) return { error: "Geçersiz öneri." };
  const store = supabaseRecommendationStore(db());

  // Yalnız toplantı haftasının (son tamamlanmış hafta) önerisine karar verilir; ?hafta= ile açılan eski hafta salt okunur.
  const current = await store.get(id);
  if (!current) return { error: "Öneri bulunamadı." };
  if (current.weekStart !== lastCompletedWeekStart(new Date())) return { error: PAST_WEEK };

  // Önce ayırma: uygulanan eylem ayrılan satırınkidir (okuma ile ayırma arasında tazelenen öneri eski eylemle uygulanmaz).
  const rec = await store.claim(id, profile.id);
  if (!rec) {
    const latest = await store.get(id);
    if (!latest) return { error: "Öneri bulunamadı." };
    return { error: latest.status === "gecersiz" ? INVALID : DECIDED };
  }

  let result: string;
  try {
    const action = rec.action;
    if (!action) {
      result = NO_OBJECT_RESULT;
    } else if (action.kind === "stage") {
      const moved = await moveContentStage(action.contentId, action.to);
      if ("error" in moved) {
        await store.release(id);
        return { error: moved.error };
      }
      result = APPLIED_RESULT;
    } else {
      const applied = await applyAdChange({
        ...action,
        source: "oneri",
        recommendationId: id,
        reason: typeof reason === "string" && reason.trim() ? reason : undefined,
      });
      if ("error" in applied) {
        await store.release(id);
        return applied.needsReason ? { error: applied.error, needsReason: true } : { error: applied.error };
      }
      // Uygulandıysa kapının kendi metni (ör. "✓ Bütçe 150 TL → 180 TL · kayda geçti").
      result = applied.status === "uygulandi" ? applied.message : CLOSED_RESULT;
    }
  } catch {
    try {
      await store.release(id);
    } catch {
      console.error("[ads] öneri yeniden açılamadı");
    }
    return { error: "İşlem yapılamadı, tekrar deneyin." };
  }

  // Uygulandı; sonuç metni yazılamazsa da karar (onaylandi) kayıtlıdır.
  try {
    await store.finish(id, result);
  } catch {
    console.error("[ads] öneri sonucu yazılamadı");
  }
  revalidatePath(PATH);
  return { ok: true, result };
}

/** "Şimdilik bekle": bu hafta yeniden sorulmaz; gelecek hafta kural yine tutarsa yeni öneri açılır. */
export async function holdRecommendation(id: string): Promise<Decision> {
  const profile = await requireRole("yonetici");
  if (typeof id !== "string" || !UUID.test(id)) return { error: "Geçersiz öneri." };
  const store = supabaseRecommendationStore(db());
  try {
    const current = await store.get(id);
    if (!current) return { error: "Öneri bulunamadı." };
    if (current.weekStart !== lastCompletedWeekStart(new Date())) return { error: PAST_WEEK };
    const held = await store.hold(id, profile.id, HOLD_RESULT, new Date().toISOString());
    if (!held) return { error: DECIDED };
  } catch {
    return { error: "Kaydedilemedi, tekrar deneyin." };
  }
  revalidatePath(PATH);
  return { ok: true, result: HOLD_RESULT };
}

/**
 * Toplantı haftasının önerilerini kurallardan yeniden üretip kayda geçirir (Bu hafta ekranı açılırken).
 * Yalnız son tamamlanmış hafta için: geçmiş bir haftanın önerileri bugünün sayılarıyla değiştirilmez.
 * Hata ekranı bozmaz; kayıtlı öneriler yine gösterilir.
 */
export async function refreshWeekRecommendations(weekStart: string): Promise<void> {
  await requireRole("yonetici");
  const now = new Date();
  if (weekStart !== lastCompletedWeekStart(now)) return;
  const admin = db();
  try {
    const [settings, { hours }, weekly, inputs] = await Promise.all([
      getAdSettings(admin),
      getLeadFlowSettings(admin),
      loadWeeklyData(admin, weekStart),
      loadRecInputs(admin, weekStart, now),
    ]);
    const gates = computeWeekGates(weekly, now, hours, settings);
    await syncRecommendations(admin, weekStart, buildRecommendations(inputs, gates, settings));
  } catch (e) {
    // Hata metni yalnız tablo adı ve hata kodunu taşır (ör. "ad_recommendations okunamadı: 42P01").
    console.error("[ads] öneriler güncellenemedi:", e instanceof Error ? e.message.slice(0, 200) : "bilinmeyen");
  }
}
