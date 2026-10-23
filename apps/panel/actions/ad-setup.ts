"use server";

// Reklam şablonu kaydı (Z6) ve tek seferlik Test/Büyütme kampanya kurulumu (K18).
// Her yazım önce requireRole("yonetici") ile rolü doğrular; gizli anahtarlı istemci ancak ondan sonra açılır.
// Her değişiklik önce ad_change_log'a yazılır; kayıt yazılamazsa değişiklik yapılmaz.

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@seker/auth/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/auth";
import { getAdSettings } from "@/lib/ads/ad-settings";
import type { AdSetup } from "@/lib/ads/ad-setup";
import { monthlyCapCheck, templateGaps, validateAdTemplate, type AdTemplate, type AdTemplateInput } from "@/lib/ads/ad-template";
import { readMetaConfig } from "@/lib/ads/meta/config";
import { runSetupSteps } from "@/lib/ads/meta/setup";
import { insertCreatedAdObjects, type AdObjectSyncRow } from "@/lib/ads/objects-store";
import { executeSetupChange, type SetupResult } from "@/lib/ads/setup-gate";
import { planCampaignSetup, SCALE_CAMPAIGN_NAME, TEST_CAMPAIGN_NAME } from "@/lib/ads/setup-plans";
import { supabaseSetupStore } from "@/lib/ads/setup-store";
import { loadGateStatus, supabaseAdChangeStore, type AdChangeLogRow } from "@/lib/ads/writes";
import { istanbulDateString } from "@/lib/lead-flow/business-hours";

const SETTINGS_PATH = "/reklam/ayarlar";
const MSG_LOG_FAILED = "Kayıt yazılamadı; değişiklik yapılmadı.";
const MICROS_PER_TL = 1_000_000;

function templateValue(t: AdTemplate): AdTemplateInput {
  return {
    okulAdres: t.okulAdres,
    lat: t.lat,
    lng: t.lng,
    yaricapKm: t.yaricapKm,
    yasMin: t.yasMin,
    yasMax: t.yasMax,
    testGunlukTl: t.testGunlukTl,
    buyutmeGunlukTl: t.buyutmeGunlukTl,
    mevcutVelileriHaricTut: t.mevcutVelileriHaricTut,
    haftalikYeniReklam: t.haftalikYeniReklam,
  };
}

/** Z6 şablonunu doğrular, aylık tavanı (B8) denetler, önce kayda (`sablon`) sonra app_settings'e yazar. */
export async function saveAdTemplate(input: AdTemplateInput): Promise<{ ok: true; message: string } | { error: string }> {
  const profile = await requireRole("yonetici");
  const valid = validateAdTemplate(input);
  if (!("ok" in valid)) return { error: valid.error };
  const value = valid.value;

  const db = createAdminSupabase() as unknown as SupabaseClient;
  const store = supabaseSetupStore(db);
  const now = new Date();
  const today = istanbulDateString(now);

  let previous: AdTemplate;
  try {
    const [settings, monthSpendTl, old] = await Promise.all([getAdSettings(db), store.monthMetaSpendTl(today), store.template()]);
    const cap = monthlyCapCheck({
      monthSpendTl,
      testGunlukTl: value.testGunlukTl,
      buyutmeGunlukTl: value.buyutmeGunlukTl,
      metaTl: settings.monthlyBudget.metaTl,
      today,
    });
    if (!cap.ok) return { error: cap.message };
    previous = old;
  } catch {
    console.error("[ads] şablon kaydı için okuma başarısız");
    return { error: "Şablon kaydedilemedi, tekrar deneyin." };
  }

  // Ruling P1: şablon değişikliği de kayıt defterine düşer (platforma gidilmez).
  const changeStore = supabaseAdChangeStore(db);
  const row: AdChangeLogRow = {
    platform: "meta",
    level: "ayarlar",
    objectId: "reklam_sablonu",
    objectName: "Reklam şablonu",
    action: "sablon",
    oldValue: templateValue(previous),
    newValue: { ...value },
    reason: null,
    gateRed: false,
    source: "ayarlar",
    recommendationId: null,
    status: "uygulandi",
    error: null,
    actorId: profile.id,
  };
  let logId: string;
  try {
    logId = await changeStore.insertLog(row);
  } catch {
    return { error: MSG_LOG_FAILED };
  }

  try {
    await store.saveTemplate(value, profile.id, now.toISOString());
  } catch {
    await changeStore.updateLog(logId, { status: "hata", error: "Şablon kaydedilemedi" }).catch(() => undefined);
    return { error: "Şablon kaydedilemedi, tekrar deneyin." };
  }
  revalidatePath(SETTINGS_PATH);
  return { ok: true, message: "Kaydedildi" };
}

function createdRows(setup: AdSetup, t: AdTemplate): AdObjectSyncRow[] {
  // ad_objects bütçesi mikro (TL × 1.000.000); bütçe kampanyada (CBO), set kampanyanın bütçesini ve kaynağını devralır.
  const pair = (campaignId: string, adsetId: string, name: string, adsetPrefix: string, tl: number): AdObjectSyncRow[] => {
    const micros = Math.round(tl * MICROS_PER_TL);
    return [
      {
        platform: "meta",
        level: "campaign",
        objectId: campaignId,
        parentId: null,
        campaignId,
        name,
        status: "PAUSED",
        dailyBudgetMicros: micros,
        budgetResource: campaignId,
        contentCode: null,
      },
      {
        platform: "meta",
        level: "adset",
        objectId: adsetId,
        parentId: campaignId,
        campaignId,
        name: `${adsetPrefix} · Okul çevresi ${t.yaricapKm} km`,
        status: "PAUSED",
        dailyBudgetMicros: micros,
        budgetResource: campaignId,
        contentCode: null,
      },
    ];
  };
  return [
    ...pair(setup.testCampaignId, setup.testAdsetId, TEST_CAMPAIGN_NAME, "Test", t.testGunlukTl),
    ...pair(setup.scaleCampaignId, setup.scaleAdsetId, SCALE_CAMPAIGN_NAME, "Büyütme", t.buyutmeGunlukTl),
  ];
}

/** Tek seferlik kurulum (K18): Test ve Büyütme kampanyaları, her birinde tek reklam seti; hepsi DURAKLATILMIŞ. */
export async function setupMetaCampaigns(opts: { mode: "kur" | "goster" }): Promise<SetupResult> {
  const profile = await requireRole("yonetici");
  const mode = opts?.mode;
  if (mode !== "kur" && mode !== "goster") return { error: "Geçersiz kip." };

  const cfg = readMetaConfig(process.env);
  if (!cfg) return { error: "Meta bağlı değil" };

  const db = createAdminSupabase() as unknown as SupabaseClient;
  const store = supabaseSetupStore(db);
  const now = new Date();
  const today = istanbulDateString(now);

  let template: AdTemplate;
  try {
    if (await store.setup()) return { error: "Test ve Büyütme kampanyaları zaten kurulu." };
    if (!cfg.pixelId) return { error: "Piksel kimliği yok · Mert ekler" };
    template = await store.template();
    const gaps = templateGaps(template);
    if (gaps.length > 0) return { error: `Reklam şablonu eksik: ${gaps.join(", ")}` };
    if (mode === "kur") {
      const [settings, monthSpendTl] = await Promise.all([getAdSettings(db), store.monthMetaSpendTl(today)]);
      const cap = monthlyCapCheck({
        monthSpendTl,
        testGunlukTl: template.testGunlukTl,
        buyutmeGunlukTl: template.buyutmeGunlukTl,
        metaTl: settings.monthlyBudget.metaTl,
        today,
      });
      if (!cap.ok) return { error: cap.message };
    }
  } catch {
    console.error("[ads] kampanya kurulumu için okuma başarısız");
    return { error: "İşlem yapılamadı, tekrar deneyin." };
  }

  const pixelId = cfg.pixelId;
  const planned = planCampaignSetup({ adAccountId: cfg.adAccountId, pixelId, template, excludedAudienceId: null });

  let result: SetupResult;
  try {
    result = await executeSetupChange(
      {
        store: supabaseAdChangeStore(db),
        actorId: profile.id,
        env: process.env,
        // kampanya_kur kapıya bakmaz; tip gereği verilir.
        gateStatus: async () => loadGateStatus(db, now, await getAdSettings(db)),
        run: (steps) => runSetupSteps(cfg, steps, fetch),
      },
      {
        action: "kampanya_kur",
        level: "campaign",
        objectId: "kurulum",
        objectName: "Test ve Büyütme kampanyaları",
        source: "ayarlar",
        mode,
        oldValue: null,
        planned,
      },
    );
  } catch {
    console.error("[ads] kampanya kurulum kapısı başarısız");
    return { error: "İşlem yapılamadı, tekrar deneyin." };
  }

  if ("ok" in result && result.status === "uygulandi") {
    const ids = result.ids;
    const setup: AdSetup = {
      testCampaignId: ids.testCampaign,
      testAdsetId: ids.testAdset,
      scaleCampaignId: ids.scaleCampaign,
      scaleAdsetId: ids.scaleAdset,
      exclusionAudienceId: null,
      createdAt: now.toISOString(),
      createdBy: profile.id,
    };
    try {
      await store.saveSetup(setup);
    } catch {
      console.error("[ads] reklam_kurulum yazılamadı");
      revalidatePath(SETTINGS_PATH);
      return {
        error: `Kampanyalar Meta'da kuruldu (DURAKLATILMIŞ) ama kimlikler panele kaydedilemedi: ${Object.values(ids).join(", ")}`,
        ids,
      };
    }
    try {
      await insertCreatedAdObjects(db, createdRows(setup, template), profile.id);
    } catch {
      // Sabah senkronu aynı nesneleri Meta'dan görüp yazar.
      console.error("[ads] kurulan kampanyalar ad_objects'e yazılamadı");
    }
    revalidatePath(SETTINGS_PATH);
    return { ...result, message: "✓ Test ve Büyütme kampanyaları kuruldu (DURAKLATILMIŞ)" };
  }

  revalidatePath(SETTINGS_PATH);
  return result;
}
