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
import { refreshExclusionAudience } from "@/lib/ads/audience-refresh";
import { moveContentStage } from "@/actions/content";
import { buildAdTestContext, type AdTestView } from "@/lib/ads/ad-test-context";
import { monthlyCapCheck, templateGaps, validateAdTemplate, type AdTemplate, type AdTemplateInput } from "@/lib/ads/ad-template";
import { readMetaConfig, type MetaConfig } from "@/lib/ads/meta/config";
import { runSetupSteps } from "@/lib/ads/meta/setup";
import { insertCreatedAdObjects, type AdObjectSyncRow } from "@/lib/ads/objects-store";
import type { PreflightResult } from "@/lib/ads/preflight";
import { loadContentForAd, type ContentForAd } from "@/lib/ads/preflight-sources";
import { supabaseRecommendationStore } from "@/lib/ads/recommendations";
import { executeSetupChange, type SetupResult } from "@/lib/ads/setup-gate";
import {
  adName,
  planCampaignSetup,
  planMoveToScale,
  SCALE_CAMPAIGN_NAME,
  TEST_CAMPAIGN_NAME,
  type PlannedChange,
} from "@/lib/ads/setup-plans";
import { supabaseSetupStore, type TestAdRow } from "@/lib/ads/setup-store";
import { istanbulWeekStartIso } from "@/lib/ads/weekly";
import { loadGateStatus, supabaseAdChangeStore, type AdChangeLogRow } from "@/lib/ads/writes";
import { istanbulDateString } from "@/lib/lead-flow/business-hours";

const SETTINGS_PATH = "/reklam/ayarlar";
const MSG_LOG_FAILED = "Kayıt yazılamadı; değişiklik yapılmadı.";
const MICROS_PER_TL = 1_000_000;
const IN_FLIGHT_MS = 10 * 60 * 1000;
/**
 * Yarıda kalmış ve Meta'da reklam/kopya açmış `hata` kaydı bu süre boyunca yeniden denemeyi engeller (I2). Sonrasında
 * sabah senkronu nesneyi ad_objects'e yazmış olur ve aynı engel oradan gelir.
 */
const FAILED_BLOCK_MS = 24 * 60 * 60 * 1000;
const MSG_IN_FLIGHT = "Kurulum sürüyor ya da daha önce yapıldı; Reklam Yöneticisi'ni kontrol edin.";
const AD_PATHS = ["/reklam/icerik", "/reklam/kampanyalar", "/reklam/hafta"];
const MIN_REASON = 10;
const MSG_ALREADY_LAUNCHED = "Bu içerik için reklam zaten kuruldu ya da kuruluyor.";
const MSG_LAUNCH_PARTIAL =
  "Bu içerik için önceki kurulum yarıda kaldı ve Meta'da reklam açıldı; ikinci kez kurulmaz. Mert'e haber verin.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      // Çift tıklama / iki yönetici / önceki kurulumun kimlikleri kaydedilemediyse: ikinci ücretli kurulum açılmasın.
      const since = new Date(now.getTime() - IN_FLIGHT_MS).toISOString();
      if (await store.campaignSetupInFlight(since)) return { error: MSG_IN_FLIGHT };
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
  // K23: şablonda "mevcut velileri hariç tut" açıksa önce boş dışlama kitlesi kurulur, setler ona bağlanır.
  const planned = planCampaignSetup({
    adAccountId: cfg.adAccountId,
    pixelId,
    template,
    excludedAudienceId: null,
    createAudience: template.mevcutVelileriHaricTut,
  });

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
      exclusionAudienceId: ids.audience ?? null,
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
    let message = "✓ Test ve Büyütme kampanyaları kuruldu (DURAKLATILMIŞ)";
    if (setup.exclusionAudienceId) {
      // Kitle boş kuruldu; telefonlar hemen yüklenir (kendi kaydıyla). Olmazsa Pazartesi cron'u yeniden dener.
      const audience = await refreshExclusionAudience({
        db,
        cfg,
        env: process.env,
        fetchFn: fetch,
        now,
        source: "ayarlar",
        actorId: profile.id,
      });
      message +=
        audience.status === "uygulandi"
          ? ` · mevcut veliler kitlesine ${audience.count} telefon yüklendi`
          : ` · kitle telefonları yüklenmedi (${audience.message}); Pazartesi yeniden denenir`;
    }
    revalidatePath(SETTINGS_PATH);
    return { ...result, message };
  }

  revalidatePath(SETTINGS_PATH);
  return result;
}

/** Z4 "Reklam testine al" penceresinin verisi: önizleme, şablon satırları, 9 kontrol (yalnız okur). */
export async function previewAdTest(contentId: string): Promise<AdTestView | { error: string }> {
  const profile = await requireRole("yonetici");
  if (typeof contentId !== "string" || !UUID.test(contentId)) return { error: "Geçersiz içerik." };

  const db = createAdminSupabase() as unknown as SupabaseClient;
  const result = await buildAdTestContext(
    {
      db,
      store: supabaseSetupStore(db),
      env: process.env,
      fetchFn: fetch,
      now: new Date(),
      actorName: profile.full_name,
    },
    contentId,
    { skip72hReason: null },
  );
  return "error" in result ? { error: result.error } : result.view;
}

/**
 * Aynı süreçte aynı içerik için eşzamanlı "Reklamı kur" (çift tıklama) kilidi. `launchInFlight` okuması ile
 * kapının bekleyen kaydı arasındaki boşluğu kapatır; süreçler arası koruma kayıt defterindeki bekleyen satırdır.
 */
const launching = new Set<string>();

export type LaunchAdTestOptions = {
  mode: "kur" | "goster";
  reason?: string;
  skip72h?: boolean;
  recommendationId?: string;
};

export type LaunchAdTestResult = SetupResult & { checklist?: PreflightResult };

type LaunchGateInput = {
  db: SupabaseClient;
  profileId: string;
  now: Date;
  cfg: MetaConfig;
  mode: "kur" | "goster";
  content: ContentForAd;
  planned: PlannedChange;
  checklist: PreflightResult;
  reason: string | undefined;
  skip72h: boolean;
  recommendationId: string | undefined;
};

function revalidateAdPaths(): void {
  for (const p of AD_PATHS) revalidatePath(p);
}

async function runLaunchGate(i: LaunchGateInput): Promise<SetupResult> {
  const { db, cfg } = i;
  try {
    return await executeSetupChange(
      {
        store: supabaseAdChangeStore(db),
        actorId: i.profileId,
        env: process.env,
        gateStatus: async () => loadGateStatus(db, i.now, await getAdSettings(db)),
        run: (steps) => runSetupSteps(cfg, steps, fetch),
      },
      {
        action: "reklam_kur",
        level: "ad",
        objectId: i.content.id,
        objectName: adName(i.content.code, i.content.topic),
        source: i.recommendationId ? "oneri" : "icerik",
        mode: i.mode,
        ...(i.reason !== undefined ? { reason: i.reason } : {}),
        extraReasonRequired: i.skip72h ? "72 saat beklenmeden teste alınıyor" : null,
        ...(i.recommendationId ? { recommendationId: i.recommendationId } : {}),
        oldValue: null,
        planned: i.planned,
        // contentCode: change-log latestByKey içerik koduyla eşler; kurulan reklam kimliği new_value.ids.ad'de.
        logExtra: { contentCode: i.content.code, checklist: i.checklist },
      },
    );
  } catch {
    console.error("[ads] reklam kurulum kapısı başarısız");
    return { error: "İşlem yapılamadı, tekrar deneyin." };
  }
}

function launchedRows(adId: string, content: ContentForAd, setup: AdSetup, template: AdTemplate, keys: Set<string>): AdObjectSyncRow[] {
  // Bütçe kampanyada (CBO); set ve reklam kampanyanın bütçesini ve kaynağını devralır (createdRows ile aynı).
  const micros = Math.round(template.testGunlukTl * MICROS_PER_TL);
  const base = {
    platform: "meta" as const,
    campaignId: setup.testCampaignId,
    status: "ACTIVE",
    dailyBudgetMicros: micros,
    budgetResource: setup.testCampaignId,
  };
  const rows: AdObjectSyncRow[] = [
    {
      ...base,
      level: "ad",
      objectId: adId,
      parentId: setup.testAdsetId,
      name: adName(content.code, content.topic),
      contentCode: content.code,
      // Yeni reklam Meta incelemesine girer; sabah senkronu gerçek durumu yazar.
      effectiveStatus: "PENDING_REVIEW",
    },
  ];
  if (keys.has("activateCampaign")) {
    rows.push({ ...base, level: "campaign", objectId: setup.testCampaignId, parentId: null, name: TEST_CAMPAIGN_NAME, contentCode: null });
  }
  if (keys.has("activateAdset")) {
    rows.push({
      ...base,
      level: "adset",
      objectId: setup.testAdsetId,
      parentId: setup.testCampaignId,
      name: `Test · Okul çevresi ${template.yaricapKm} km`,
      contentCode: null,
    });
  }
  return rows;
}

/**
 * Z4 "Reklam testine al" (§4): Test setine yalnız kreatif + reklam ekler; kampanya ve set Z6 kurulumundan gelir.
 * "kur": 9 kontrol yeşil olmalı, içerik için kurulu/kuruluyor reklam olmamalı, haftalık sınır (şablon) aşılmamalı;
 * kırmızı kapı ve 72 saat atlaması gerekçe ister (kayıt yazılmadan döner). "goster": hiçbir denetime takılmaz,
 * yalnız `uygulanmadi_kapali` kaydı yazar; aşama, `ad_objects` ve haftalık sayı değişmez.
 */
export async function launchAdTest(contentId: string, opts: LaunchAdTestOptions): Promise<LaunchAdTestResult> {
  const profile = await requireRole("yonetici");
  if (typeof contentId !== "string" || !UUID.test(contentId)) return { error: "Geçersiz içerik." };
  const mode = opts?.mode;
  if (mode !== "kur" && mode !== "goster") return { error: "Geçersiz kip." };
  const reason = typeof opts.reason === "string" ? opts.reason : undefined;
  const skip72h = opts.skip72h === true;
  const recommendationId = opts.recommendationId;
  if (recommendationId !== undefined && (typeof recommendationId !== "string" || !UUID.test(recommendationId))) {
    return { error: "Geçersiz öneri." };
  }
  // Review Focus 4: istemci atlatılıp skip72h gerekçesiz gelirse hiçbir şey okunmadan ve yazılmadan döner.
  if (mode === "kur" && skip72h && (reason?.trim().length ?? 0) < MIN_REASON) {
    return {
      error: `72 saat beklenmeden teste almak için nedenini yazın (en az ${MIN_REASON} karakter).`,
      needsReason: true,
    };
  }

  const db = createAdminSupabase() as unknown as SupabaseClient;
  const store = supabaseSetupStore(db);
  const now = new Date();
  const ctx = await buildAdTestContext(
    { db, store, env: process.env, fetchFn: fetch, now, actorName: profile.full_name },
    contentId,
    { skip72hReason: skip72h ? (reason ?? null) : null },
  );
  if ("error" in ctx) return { error: ctx.error };
  const { view, planned, content, setup } = ctx;
  const checklist = view.checklist;

  let cfg: MetaConfig | null;
  try {
    cfg = readMetaConfig(process.env);
  } catch {
    cfg = null;
  }
  const gateInput = { db, profileId: profile.id, now, mode, content, checklist, reason, skip72h, recommendationId };

  if (mode === "goster") {
    if (!planned || !cfg) {
      // Kurulacak adım yoksa kapı kayıt yazmaz ("Kurulacak adım yok."); nedeni ve kontrolleri döneriz.
      const why = view.blockText ?? "kurulum ya da Meta yapılandırması eksik";
      return { error: `Panel şunu kuracaktı: plan oluşturulamadı (${why})`, checklist };
    }
    const shown = await runLaunchGate({ ...gateInput, cfg, planned });
    revalidateAdPaths();
    return { ...shown, checklist };
  }

  // kur: kırmızı kontrol listesinin tek bekçisi (kapı gerekçeyle geçilir, kontrol listesi geçilmez).
  if (!checklist.ok || !planned || !setup || !cfg) {
    return {
      error: view.blockText ?? "Reklam kurulamaz: plan oluşturulamadı (kurulum ya da Meta yapılandırması eksik).",
      checklist,
    };
  }
  if (launching.has(content.id)) return { error: MSG_ALREADY_LAUNCHED };
  launching.add(content.id);
  try {
    let template: AdTemplate;
    try {
      const since = new Date(now.getTime() - IN_FLIGHT_MS).toISOString();
      const failedSince = new Date(now.getTime() - FAILED_BLOCK_MS).toISOString();
      const inFlight = await store.launchInFlight(content.id, since, failedSince);
      if (inFlight === "yarim") return { error: MSG_LAUNCH_PARTIAL };
      if (inFlight) return { error: MSG_ALREADY_LAUNCHED };
      template = await store.template();
      const limit = template.haftalikYeniReklam;
      if ((await store.weekLaunches(istanbulWeekStartIso(now))) >= limit) {
        return { error: `Bu hafta ${limit} reklam kuruldu; hesap güvenliği için yenisi gelecek Pazartesi.` };
      }
    } catch {
      console.error("[ads] reklam kurulumu için okuma başarısız");
      return { error: "İşlem yapılamadı, tekrar deneyin." };
    }

    const result = await runLaunchGate({ ...gateInput, cfg, planned });
    if (!("ok" in result) || result.status !== "uygulandi") {
      revalidateAdPaths();
      return result;
    }

    const adId = result.ids.ad;
    const keys = new Set(planned.steps.map((s) => s.key));
    try {
      await insertCreatedAdObjects(db, launchedRows(adId, content, setup, template, keys), profile.id);
    } catch {
      // Kayıt `uygulandi` olduğu için ikinci kurulum yine engellenir; sabah senkronu nesneleri Meta'dan yazar.
      console.error("[ads] kurulan reklam ad_objects'e yazılamadı");
    }

    let message = `Testte · reklam ${adId}`;
    if (result.message.endsWith("kayıt güncellenemedi")) message += " · kayıt güncellenemedi";
    if (content.kind === "reels" && content.stage === "organik") {
      // B3: aşama mevcut moveContentStage ile (kendi yönetici denetimi ve geçiş kuralıyla) değişir; hata kaydı bozmaz.
      try {
        const moved = await moveContentStage(content.id, "test");
        if ("error" in moved) message += ` · aşama değiştirilemedi: ${moved.error}`;
      } catch {
        message += " · aşama değiştirilemedi";
      }
    }

    if (recommendationId) {
      const recs = supabaseRecommendationStore(db);
      try {
        // Başkası karara bağladıysa (claim null) sonucu üzerine yazılmaz.
        if (await recs.claim(recommendationId, profile.id)) await recs.finish(recommendationId, message);
      } catch {
        console.error("[ads] öneri sonucu yazılamadı");
      }
    }

    revalidateAdPaths();
    return { ...result, message };
  } finally {
    launching.delete(content.id);
  }
}


/** Aynı süreçte aynı içerik için eşzamanlı "Büyütmeye taşı" kilidi (launching ile aynı amaç). */
const scaling = new Set<string>();

const MSG_ALREADY_SCALED = "Bu içerik Büyütme'ye zaten taşındı ya da taşınıyor.";
const MSG_SCALE_PARTIAL =
  "Bu içeriğin önceki Büyütme'ye taşıması yarıda kaldı ve Meta'da kopya açıldı; ikinci kez taşınmaz. Mert'e haber verin.";
const MSG_NO_SETUP = "Önce Ayarlar'da Test ve Büyütme kampanyalarını kurun.";
const SCALE_SOURCES = ["kampanyalar", "oneri"] as const;

export type MoveToScaleOptions = {
  mode: "kur" | "goster";
  reason?: string;
  source?: (typeof SCALE_SOURCES)[number];
  recommendationId?: string;
};

function scaledRows(
  copyId: string,
  testAd: TestAdRow,
  code: string,
  setup: AdSetup,
  template: AdTemplate,
  keys: Set<string>,
): AdObjectSyncRow[] {
  // Bütçe kampanyada (CBO); set ve reklam kampanyanın bütçesini ve kaynağını devralır (createdRows ile aynı).
  const scaleMicros = Math.round(template.buyutmeGunlukTl * MICROS_PER_TL);
  const testMicros = Math.round(template.testGunlukTl * MICROS_PER_TL);
  const scale = {
    platform: "meta" as const,
    campaignId: setup.scaleCampaignId,
    status: "ACTIVE",
    dailyBudgetMicros: scaleMicros,
    budgetResource: setup.scaleCampaignId,
  };
  const rows: AdObjectSyncRow[] = [
    // Kopya: sabah senkronu gerçek inceleme durumunu yazar.
    { ...scale, level: "ad", objectId: copyId, parentId: setup.scaleAdsetId, name: testAd.name, contentCode: code },
    {
      platform: "meta",
      level: "ad",
      objectId: testAd.adId,
      parentId: setup.testAdsetId,
      campaignId: setup.testCampaignId,
      name: testAd.name,
      status: "PAUSED",
      dailyBudgetMicros: testMicros,
      budgetResource: setup.testCampaignId,
      contentCode: code,
      effectiveStatus: "PAUSED",
      reviewFeedback: testAd.reviewFeedback,
    },
  ];
  if (keys.has("activateCampaign")) {
    rows.push({ ...scale, level: "campaign", objectId: setup.scaleCampaignId, parentId: null, name: SCALE_CAMPAIGN_NAME, contentCode: null });
  }
  if (keys.has("activateAdset")) {
    rows.push({
      ...scale,
      level: "adset",
      objectId: setup.scaleAdsetId,
      parentId: setup.scaleCampaignId,
      name: `Büyütme · Okul çevresi ${template.yaricapKm} km`,
      contentCode: null,
    });
  }
  return rows;
}

/**
 * "Büyütmeye taşı" (§4, M1): içeriğin Test'teki tek reklamı Büyütme setine kopyalanır, kopya açılır, Test'teki durur.
 * "kur": aylık tavan (B8) geçilemez; kırmızı kapı gerekçe ister (B7). Bayrak kapalıyken ya da "goster" kipinde
 * yalnız `uygulanmadi_kapali` kaydı yazılır; aşama ve `ad_objects` değişmez. Uygulanınca aşama `kazanan`.
 */
export async function moveToScale(contentId: string, opts: MoveToScaleOptions): Promise<SetupResult> {
  const profile = await requireRole("yonetici");
  if (typeof contentId !== "string" || !UUID.test(contentId)) return { error: "Geçersiz içerik." };
  const mode = opts?.mode;
  if (mode !== "kur" && mode !== "goster") return { error: "Geçersiz kip." };
  const source = opts.source ?? "kampanyalar";
  if (!(SCALE_SOURCES as readonly string[]).includes(source)) return { error: "Geçersiz kaynak." };
  const reason = typeof opts.reason === "string" ? opts.reason : undefined;
  const recommendationId = opts.recommendationId;
  if (recommendationId !== undefined && (typeof recommendationId !== "string" || !UUID.test(recommendationId))) {
    return { error: "Geçersiz öneri." };
  }

  let cfg: MetaConfig | null;
  try {
    cfg = readMetaConfig(process.env);
  } catch {
    cfg = null;
  }
  if (!cfg) return { error: "Meta bağlı değil" };
  const metaCfg = cfg;

  const db = createAdminSupabase() as unknown as SupabaseClient;
  const store = supabaseSetupStore(db);
  const now = new Date();
  const today = istanbulDateString(now);

  let content: ContentForAd;
  let setup: AdSetup;
  let testAd: TestAdRow;
  let template: AdTemplate;
  let campaignStatus: string | null;
  let adsetStatus: string | null;
  try {
    const found = await loadContentForAd(db, contentId);
    if (!found) return { error: "İçerik bulunamadı." };
    content = found;
    const current = await store.setup();
    if (!current) return { error: MSG_NO_SETUP };
    setup = current;
    const ads = await store.testAdForCode(content.code, setup.testAdsetId);
    if (ads.length === 0) return { error: "Bu içeriğin Test'te reklamı yok." };
    if (ads.length > 1) return { error: "Bu koda bağlı birden fazla Test reklamı var; Kampanyalar'dan seçin." };
    testAd = ads[0];
    [template, campaignStatus, adsetStatus] = await Promise.all([
      store.template(),
      store.objectStatus("campaign", setup.scaleCampaignId),
      store.objectStatus("adset", setup.scaleAdsetId),
    ]);
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
    console.error("[ads] büyütmeye taşıma için okuma başarısız");
    return { error: "İşlem yapılamadı, tekrar deneyin." };
  }

  const planned = planMoveToScale({
    setup,
    testAdId: testAd.adId,
    adName: testAd.name,
    activateCampaign: campaignStatus !== "ACTIVE",
    activateAdset: adsetStatus !== "ACTIVE",
  });
  const runGate = async (): Promise<SetupResult> => {
    try {
      return await executeSetupChange(
        {
          store: supabaseAdChangeStore(db),
          actorId: profile.id,
          env: process.env,
          gateStatus: async () => loadGateStatus(db, now, await getAdSettings(db)),
          run: (steps) => runSetupSteps(metaCfg, steps, fetch),
        },
        {
          action: "buyutmeye_tasi",
          level: "ad",
          objectId: testAd.adId,
          objectName: testAd.name,
          source,
          mode,
          ...(reason !== undefined ? { reason } : {}),
          ...(recommendationId ? { recommendationId } : {}),
          oldValue: { adId: testAd.adId, adsetId: setup.testAdsetId, status: testAd.status },
          planned,
          // contentCode: change-log latestByKey içerik koduyla eşler; kopyanın kimliği new_value.ids.copy'de.
          logExtra: { contentCode: content.code },
        },
      );
    } catch {
      console.error("[ads] büyütmeye taşıma kapısı başarısız");
      return { error: "İşlem yapılamadı, tekrar deneyin." };
    }
  };

  if (mode === "goster") {
    const shown = await runGate();
    revalidateAdPaths();
    return shown;
  }

  if (scaling.has(content.id)) return { error: MSG_ALREADY_SCALED };
  scaling.add(content.id);
  try {
    try {
      const since = new Date(now.getTime() - IN_FLIGHT_MS).toISOString();
      const failedSince = new Date(now.getTime() - FAILED_BLOCK_MS).toISOString();
      const inFlight = await store.scaleInFlight(testAd.adId, content.code, setup.scaleAdsetId, since, failedSince);
      if (inFlight === "yarim") return { error: MSG_SCALE_PARTIAL };
      if (inFlight) return { error: MSG_ALREADY_SCALED };
    } catch {
      console.error("[ads] büyütmeye taşıma için okuma başarısız");
      return { error: "İşlem yapılamadı, tekrar deneyin." };
    }

    const result = await runGate();
    if (!("ok" in result) || result.status !== "uygulandi") {
      revalidateAdPaths();
      return result;
    }

    const copyId = result.ids.copy;
    const keys = new Set(planned.steps.map((s) => s.key));
    try {
      await insertCreatedAdObjects(db, scaledRows(copyId, testAd, content.code, setup, template, keys), profile.id);
    } catch {
      // Kayıt `uygulandi` olduğu için ikinci taşıma yine engellenir; sabah senkronu nesneleri Meta'dan yazar.
      console.error("[ads] taşınan reklam ad_objects'e yazılamadı");
    }

    let message = `✓ ${content.code} Büyütme'ye taşındı · Test'teki reklam durdu`;
    if (result.message.endsWith("kayıt güncellenemedi")) message += " · kayıt güncellenemedi";
    if (content.stage !== "kazanan") {
      // B3: aşama mevcut moveContentStage ile (kendi yönetici denetimi ve geçiş kuralıyla); hata kaydı bozmaz.
      try {
        const moved = await moveContentStage(content.id, "kazanan");
        if ("error" in moved) message += ` · aşama değiştirilemedi: ${moved.error}`;
      } catch {
        message += " · aşama değiştirilemedi";
      }
    }

    if (recommendationId) {
      const recs = supabaseRecommendationStore(db);
      try {
        // Öneriden (approveRecommendation) gelindiyse öneri zaten ayrılmıştır (claim null); sonucu o yazar.
        if (await recs.claim(recommendationId, profile.id)) await recs.finish(recommendationId, message);
      } catch {
        console.error("[ads] öneri sonucu yazılamadı");
      }
    }

    revalidateAdPaths();
    return { ...result, message };
  } finally {
    scaling.delete(content.id);
  }
}
