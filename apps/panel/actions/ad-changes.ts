"use server";

// Reklam değişiklikleri (durdur, başlat, bütçe) ve elle içerik kodu bağlama.
// Yazımlar yalnız gizli anahtarlı istemcidedir ve her biri önce requireRole("yonetici") ile rolü doğrular.

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@seker/auth/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/auth";
import { getAdSettings } from "@/lib/ads/ad-settings";
import { CONTENT_CODE_RE } from "@/lib/ads/content-code";
import {
  executeAdChange,
  loadGateStatus,
  supabaseAdChangeStore,
  type AdChangeAction,
  type AdChangeResult,
} from "@/lib/ads/writes";

const PATHS = ["/reklam/kampanyalar", "/reklam/bu-hafta", "/reklam/icerik"];

export async function applyAdChange(
  input: AdChangeAction & { reason?: string; source: "kampanyalar" | "oneri"; recommendationId?: string },
): Promise<AdChangeResult> {
  const profile = await requireRole("yonetici");
  const db = createAdminSupabase() as unknown as SupabaseClient;
  const now = new Date();
  let settingsCache: ReturnType<typeof getAdSettings> | null = null;
  const settings = () => (settingsCache ??= getAdSettings(db));

  // Yalnız bilinen alanlar geçer; istemcinin "kapı yeşil" gibi beyanları dikkate alınmaz.
  const clean = {
    platform: input?.platform,
    level: input?.level,
    objectId: input?.objectId,
    objectName: input?.objectName,
    kind: input?.kind,
    newDailyBudgetTl: input?.newDailyBudgetTl,
    reason: input?.reason,
    source: input?.source,
    recommendationId: input?.recommendationId,
  };

  let result: AdChangeResult;
  try {
    result = await executeAdChange(
      {
        store: supabaseAdChangeStore(db),
        actorId: profile.id,
        env: process.env,
        fetchFn: fetch,
        settings,
        gateStatus: async () => loadGateStatus(db, now, await settings()),
        now: () => now,
      },
      clean,
    );
  } catch {
    console.error("[ads] değişiklik kapısı başarısız");
    return { error: "İşlem yapılamadı, tekrar deneyin." };
  }
  for (const p of PATHS) revalidatePath(p);
  return result;
}

/** K11: kodsuz Meta reklamını elle bir içerik koduna bağlar. */
export async function linkAdToContent(
  platform: "meta",
  adId: string,
  code: string,
): Promise<{ ok: true; message: string } | { error: string }> {
  const profile = await requireRole("yonetici");
  if (platform !== "meta") return { error: "Yalnız Instagram reklamları koda bağlanır." };
  if (typeof adId !== "string" || !/^\d{1,30}$/.test(adId)) return { error: "Geçersiz reklam kimliği." };
  const clean = typeof code === "string" ? code.trim() : "";
  if (!CONTENT_CODE_RE.test(clean)) return { error: "Geçersiz içerik kodu (ör. R-2645-A)." };

  try {
    await supabaseAdChangeStore(createAdminSupabase() as unknown as SupabaseClient).linkContent(platform, adId, clean, profile.id);
  } catch {
    return { error: "Bağlanamadı, tekrar deneyin." };
  }
  for (const p of PATHS) revalidatePath(p);
  return { ok: true, message: `✓ ${clean} koduna bağlandı` };
}
