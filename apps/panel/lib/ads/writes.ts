// Reklam platformuna yazmanın tek kapısı: durdur, yeniden başlat, günlük bütçe.
// Her işlem önce ad_change_log'a yazılır; ADS_WRITE_ENABLED "true" değilse platforma gidilmez.
// Kampanya / reklam seti / reklam oluşturan bir yol yoktur.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getLeadFlowSettings } from "@/lib/lead-flow/settings";
import { istanbulDateString } from "@/lib/lead-flow/business-hours";
import { loadWeeklyData } from "@/lib/queries/weekly";
import { formatTl } from "@/lib/content/board";
import type { AdSettings } from "./ad-settings";
import { readAdsConfig, type AdsConfig } from "./config";
import { getAccessToken, GoogleApiError } from "./googleAds";
import { googleGetBudgetMicros, googleSetBudget, googleSetStatus } from "./google-writes";
import { readMetaConfig } from "./meta/config";
import { MetaApiError } from "./meta/insights";
import { metaGetDailyBudget, metaSetDailyBudget, metaSetStatus } from "./meta/writes";
import type { FetchFn } from "./types";
import { anyGateRed, computeWeekGates, lastCompletedWeekStart, mondayOf, weekRange } from "./weekly";

export type AdChangeAction = {
  platform: "google" | "meta";
  level: "campaign" | "adset" | "ad";
  objectId: string;
  objectName: string;
  kind: "pause" | "resume" | "budget";
  newDailyBudgetTl?: number;
  /** Öneriden gelen bütçe artışında önerinin yazıldığı andaki günlük bütçe (TL); değiştiyse öneri uygulanmaz. */
  expectedOldTl?: number;
};

export type AdChangeInput = AdChangeAction & {
  reason?: string;
  source: "kampanyalar" | "oneri";
  recommendationId?: string;
};

export type AdChangeResult =
  | { ok: true; status: "uygulandi" | "uygulanmadi_kapali"; message: string }
  | { error: string; needsReason?: boolean };

export type AdChangeStatus = "uygulandi" | "uygulanmadi_kapali" | "hata";

/** ad_objects satırı (sabah eşitlemesinden). `dailyBudgetMicros`: TL × 1.000.000. */
export type AdObjectRow = {
  platform: "google" | "meta";
  level: "campaign" | "adset" | "ad";
  objectId: string;
  name: string;
  status: string | null;
  dailyBudgetMicros: number | null;
  budgetResource: string | null;
};

export type AdChangeLogRow = {
  platform: "google" | "meta";
  level: "campaign" | "adset" | "ad";
  objectId: string;
  objectName: string;
  action: "pause" | "resume" | "budget";
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  reason: string | null;
  gateRed: boolean;
  source: "kampanyalar" | "oneri";
  recommendationId: string | null;
  status: AdChangeStatus;
  error: string | null;
  actorId: string;
};

export interface AdChangeStore {
  loadObject(platform: string, level: string, objectId: string): Promise<AdObjectRow | null>;
  /**
   * Bu bütçe kaynağına bu hafta (sinceIso'dan beri) uygulanmış ilk bütçe değişikliğinin eski değeri; yoksa null.
   * Kaynağı kayda geçmemiş eski satırlarda (3f2ab29 öncesi) nesne kimliğine düşer.
   */
  weekBudgetBaselineTl(platform: string, budgetResource: string, sinceIso: string, objectId: string): Promise<number | null>;
  insertLog(row: AdChangeLogRow): Promise<string>;
  updateLog(id: string, patch: Pick<AdChangeLogRow, "status" | "error">): Promise<void>;
  updateObject(platform: string, level: string, objectId: string, patch: Record<string, unknown>): Promise<void>;
  /** Aynı bütçe kaynağını taşıyan tüm satırların günlük bütçesi (paylaşılan / üst düzey bütçe). */
  updateBudgetRows(platform: string, budgetResource: string, micros: number): Promise<void>;
}

export type GateStatus = { red: boolean; labels: string[] };

export type AdChangeDeps = {
  store: AdChangeStore;
  actorId: string;
  env: Record<string, string | undefined>;
  fetchFn: FetchFn;
  settings: () => Promise<AdSettings>;
  /** Sunucuda hesaplanan kapı durumu; istemcinin beyanı hiç kullanılmaz. */
  gateStatus: () => Promise<GateStatus>;
  now?: () => Date;
};

const CLOSED_MESSAGE = "Kaydedildi · uygulanmadı: canlı yazım kapalı";
const REC_BUDGET_CHANGED = "Bütçe öneriden sonra değişti; sayfayı yenileyin.";
const MIN_REASON = 10;
const MAX_REASON = 500;
const MAX_NAME = 200;
const MAX_BUDGET_TL = 1_000_000;
const DIGITS = /^\d{1,30}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Canlı yazım yalnız `ADS_WRITE_ENABLED === "true"` iken açık. */
export function adsWriteEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.ADS_WRITE_ENABLED === "true";
}

/**
 * Bu hafta ve geçen tamamlanmış hafta (Pazartesi toplantısının haftası); biri kırmızıysa kırmızı.
 * Etiket hangi haftanın kırmızı olduğunu söyler: "Randevu verilen · geçen hafta".
 */
export async function loadGateStatus(supabase: SupabaseClient, now: Date, settings: AdSettings): Promise<GateStatus> {
  const { hours } = await getLeadFlowSettings(supabase);
  const weeks = [
    { start: mondayOf(istanbulDateString(now)), name: "bu hafta" },
    { start: lastCompletedWeekStart(now), name: "geçen hafta" },
  ];
  const data = await Promise.all(weeks.map((w) => loadWeeklyData(supabase, w.start)));
  const labels: string[] = [];
  // "Bu hafta" ekranıyla aynı hesap: ulaşma önceki haftanın olgun kohortu, gelme takvim haftasının randevuları.
  data.forEach((d, i) => {
    for (const l of anyGateRed(computeWeekGates(d, now, hours, settings)).labels) labels.push(`${l} · ${weeks[i].name}`);
  });
  return { red: labels.length > 0, labels };
}

function validate(input: AdChangeInput): string | null {
  if (!input || typeof input !== "object") return "Geçersiz istek.";
  if (input.platform !== "google" && input.platform !== "meta") return "Geçersiz platform.";
  if (!["campaign", "adset", "ad"].includes(input.level)) return "Geçersiz düzey.";
  if (typeof input.objectId !== "string" || !DIGITS.test(input.objectId)) return "Geçersiz reklam kimliği.";
  if (!["pause", "resume", "budget"].includes(input.kind)) return "Geçersiz işlem.";
  if (input.source !== "kampanyalar" && input.source !== "oneri") return "Geçersiz kaynak.";
  if (input.recommendationId !== undefined && (typeof input.recommendationId !== "string" || !UUID.test(input.recommendationId))) {
    return "Geçersiz öneri.";
  }
  if (input.reason !== undefined && typeof input.reason !== "string") return "Geçersiz gerekçe.";
  if (input.platform === "google" && input.level !== "campaign") return "Google'da yalnız kampanya düzeyinde değişiklik yapılabilir.";
  if (input.kind === "budget") {
    const tl = input.newDailyBudgetTl;
    if (typeof tl !== "number" || !Number.isFinite(tl) || tl < 1 || tl > MAX_BUDGET_TL) {
      return "Günlük bütçe 1 ile 1.000.000 TL arasında olmalı.";
    }
    const old = input.expectedOldTl;
    if (old !== undefined && (typeof old !== "number" || !Number.isFinite(old) || old < 0 || old > MAX_BUDGET_TL)) {
      return "Geçersiz eski bütçe.";
    }
  }
  return null;
}

function roundKurus(tl: number): number {
  return Math.round(tl * 100) / 100;
}

function tlText(tl: number): string {
  return Number.isInteger(tl) ? formatTl(tl) : `${tl.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
}

/** Hata metninden yapılandırmadaki tüm gizli değerleri siler. */
function scrub(text: string, secrets: (string | null | undefined)[]): string {
  let out = text;
  for (const s of secrets) if (s && s.length >= 4) out = out.split(s).join("[gizli]");
  return out.length > MAX_REASON ? out.slice(0, MAX_REASON) : out;
}

/** Yalnız platform hata sınıflarının metni gösterilir; ağ hataları ve beklenmeyenler genel metinle. */
function platformErrorText(err: unknown, env: Record<string, string | undefined>, extra: string[]): string {
  const secrets = [
    env.GOOGLE_ADS_CLIENT_SECRET,
    env.GOOGLE_ADS_REFRESH_TOKEN,
    env.META_ACCESS_TOKEN,
    env.META_APP_SECRET,
    ...extra,
  ];
  if (err instanceof GoogleApiError || err instanceof MetaApiError) return scrub(err.message, secrets);
  const name = err instanceof Error ? err.name : "bilinmeyen";
  return `Platform isteği başarısız (${name})`;
}

type Plan =
  | { kind: "pause" | "resume"; oldStatus: string | null; newStatus: string }
  | { kind: "budget"; target: string; oldTl: number | null; newTl: number };

/** Tek işlem boyunca platform bağlantısı: yapılandırma bir kez okunur, Google erişim anahtarı bir kez alınır. */
type PlatformSession = {
  readBudgetTl(target: string): Promise<number>;
  apply(input: AdChangeInput, plan: Plan): Promise<void>;
};

function platformSession(platform: "google" | "meta", deps: AdChangeDeps, secrets: string[]): PlatformSession {
  if (platform === "google") {
    let tokenPromise: Promise<{ cfg: AdsConfig; token: string }> | null = null;
    const auth = () =>
      (tokenPromise ??= (async () => {
        const cfg = readAdsConfig(deps.env);
        if (!cfg) throw new GoogleApiError("Google Ads yapılandırılmamış", 400);
        const token = await getAccessToken(cfg, deps.fetchFn);
        secrets.push(token);
        return { cfg, token };
      })());
    return {
      async readBudgetTl(target) {
        const { cfg, token } = await auth();
        return (await googleGetBudgetMicros(cfg, token, target, deps.fetchFn)) / 1_000_000;
      },
      async apply(input, plan) {
        const { cfg, token } = await auth();
        if (plan.kind === "budget") {
          await googleSetBudget(cfg, token, plan.target, Math.round(plan.newTl * 1_000_000), deps.fetchFn);
        } else {
          await googleSetStatus(cfg, token, input.objectId, plan.kind === "pause" ? "PAUSED" : "ENABLED", deps.fetchFn);
        }
      },
    };
  }
  const metaCfg = () => {
    const cfg = readMetaConfig(deps.env);
    if (!cfg) throw new MetaApiError("Meta yapılandırılmamış", 400);
    return cfg;
  };
  return {
    async readBudgetTl(target) {
      // TRY ×100 (kuruş) — TEYİTSİZ (meta/writes.ts).
      return (await metaGetDailyBudget(metaCfg(), target, deps.fetchFn)) / 100;
    },
    async apply(input, plan) {
      const cfg = metaCfg();
      if (plan.kind === "budget") {
        await metaSetDailyBudget(cfg, plan.target, Math.round(plan.newTl * 100), deps.fetchFn);
      } else {
        await metaSetStatus(cfg, input.objectId, plan.kind === "pause" ? "PAUSED" : "ACTIVE", deps.fetchFn);
      }
    },
  };
}

function successMessage(name: string, plan: Plan): string {
  if (plan.kind !== "budget") {
    return plan.kind === "pause" ? `✓ ${name} durduruldu · kayda geçti` : `✓ ${name} yeniden başladı · kayda geçti`;
  }
  const old = plan.oldTl === null ? "?" : tlText(plan.oldTl).replace(/ TL$/, "");
  return `✓ Bütçe ${old} TL → ${tlText(plan.newTl)} · kayda geçti`;
}

/**
 * Değişiklik kapısı. Sıra: doğrula → ad_objects'ten eski değer (canlı yazım açıksa bütçe platformdan da okunur,
 * eski değer platformdaki tutar) → (artışta) kapı ve büyütme sınırı → ad_change_log → canlı yazım açıksa platform →
 * kayıt sonucu (+ ad_objects).
 * Kırmızı kapıda ya da haftalık büyütme sınırını aşan artışta en az 10 karakter gerekçe zorunlu;
 * durdurma, başlatma ve azaltma gerekçesiz. Canlı bütçe okunamazsa değişiklik artış sayılır.
 */
export async function executeAdChange(deps: AdChangeDeps, input: AdChangeInput): Promise<AdChangeResult> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const obj = await deps.store.loadObject(input.platform, input.level, input.objectId);
  if (!obj) return { error: "Bu reklam panelde bulunamadı; sabah eşitlemesinden sonra tekrar deneyin." };
  const name = (obj.name || String(input.objectName ?? "") || input.objectId).slice(0, MAX_NAME);
  const reason = typeof input.reason === "string" && input.reason.trim() ? input.reason.trim().slice(0, MAX_REASON) : null;
  const hasReason = (reason?.length ?? 0) >= MIN_REASON;
  const now = deps.now?.() ?? new Date();
  const enabled = adsWriteEnabled(deps.env);
  const secrets: string[] = [];
  const session = platformSession(input.platform, deps, secrets);

  let plan: Plan;
  // Bütçe için kayda geçen ek bilgi (canlı okuma).
  let liveNote: Record<string, unknown> = {};
  let liveFailed = false;
  if (input.kind === "budget") {
    if (!obj.budgetResource) return { error: "Bu nesnenin günlük bütçesi yok; bütçe başka düzeyde olabilir." };
    const rowTl = obj.dailyBudgetMicros === null ? null : roundKurus(obj.dailyBudgetMicros / 1_000_000);
    let oldTl = rowTl;
    if (enabled) {
      // Satır bayat olabilir (ör. Reklam Yöneticisi'nde 200→100 indirilmiş): eski değer platformdaki tutardır,
      // böylece 100→190 artışı satıra göre "200→190 azaltma" gibi görünüp kapıyı atlatamaz.
      try {
        const liveTl = roundKurus(await session.readBudgetTl(obj.budgetResource));
        oldTl = liveTl;
        liveNote = { live_budget_tl: liveTl };
      } catch {
        liveFailed = true;
        liveNote = { live_budget_tl: null, canli_okuma: "basarisiz" };
      }
    }
    const newTl = roundKurus(input.newDailyBudgetTl as number);
    // Öneri sabahki bütçeye göre yazıldı: bütçe o zamandan beri değiştiyse (ör. Reklam Yöneticisi'nde 300'e çıkarıldı)
    // önerinin tutarı artık artış değildir; uygulanmaz. Öneriden gelen bütçe değişikliği hiçbir zaman azaltma değildir.
    if (input.source === "oneri") {
      const expected = input.expectedOldTl === undefined ? null : roundKurus(input.expectedOldTl);
      if (expected === null || oldTl === null || oldTl !== expected || newTl <= oldTl) return { error: REC_BUDGET_CHANGED };
    }
    if (!liveFailed && oldTl !== null && newTl === oldTl) return { error: "Bütçe değişmedi." };
    plan = { kind: "budget", target: obj.budgetResource, oldTl, newTl };
  } else {
    // Satırdaki durum bayat olabilir; durdurma/başlatma platformda tekrar edilse de zararsız, engellenmez.
    plan =
      input.kind === "pause"
        ? { kind: "pause", oldStatus: obj.status, newStatus: "PAUSED" }
        : { kind: "resume", oldStatus: obj.status, newStatus: input.platform === "google" ? "ENABLED" : "ACTIVE" };
  }

  const isIncrease = plan.kind === "budget" ? liveFailed || plan.oldTl === null || plan.newTl > plan.oldTl : false;

  // Kapılar her işlemde kayda geçmek için hesaplanır; yalnız artışta engeller (Review Focus 1-2).
  let gate: GateStatus = { red: false, labels: [] };
  let gateFailed = false;
  try {
    gate = await deps.gateStatus();
  } catch {
    if (isIncrease) return { error: "Bu haftanın kapıları hesaplanamadı; bütçe artışı şimdilik yapılamaz." };
    gateFailed = true;
  }

  if (isIncrease && plan.kind === "budget") {
    if (gate.red && !hasReason) {
      return {
        error: `Bir kapı kırmızı (${gate.labels.join(", ")}). Bütçe artışı önerilmiyor. Yine de yapacaksanız nedenini yazın (en az ${MIN_REASON} karakter).`,
        needsReason: true,
      };
    }
    // Sınır haftanın başındaki bütçeye göre ve bütçe kaynağı başına: 150→180→216 gibi basamaklı artış da,
    // aynı bütçeyi paylaşan satırlardan ayrı ayrı artış da yakalanır.
    const settings = await deps.settings();
    const since = weekRange(mondayOf(istanbulDateString(now))).from;
    // Canlı okuma başarısızsa satır bayat olabilir: taban yoksa eski bütçe bilinmiyor sayılır (gerekçe ister).
    const base =
      (await deps.store.weekBudgetBaselineTl(input.platform, plan.target, since, input.objectId)) ??
      (liveFailed ? null : plan.oldTl);
    const pct = base && base > 0 ? ((plan.newTl - base) / base) * 100 : Number.POSITIVE_INFINITY;
    if (pct > settings.scaleMaxPct + 1e-9 && !hasReason) {
      const detail = Number.isFinite(pct) ? ` (bu hafta +%${Math.round(pct)})` : " (eski bütçe bilinmiyor)";
      return {
        error: `Artış haftalık %${settings.scaleMaxPct} büyütme sınırını aşıyor${detail}. Yine de yapacaksanız nedenini yazın (en az ${MIN_REASON} karakter).`,
        needsReason: true,
      };
    }
  }

  const gateNote = gateFailed ? { kapi: "hesaplanamadı" } : {};
  const row: AdChangeLogRow = {
    platform: input.platform,
    level: input.level,
    objectId: input.objectId,
    objectName: name,
    action: input.kind,
    oldValue:
      plan.kind === "budget"
        ? { daily_budget_tl: plan.oldTl, budget_resource: plan.target, ...liveNote }
        : { status: plan.oldStatus },
    newValue:
      plan.kind === "budget"
        ? { daily_budget_tl: plan.newTl, budget_resource: plan.target, ...gateNote }
        : { status: plan.newStatus, ...gateNote },
    reason,
    gateRed: gate.red,
    source: input.source,
    recommendationId: input.recommendationId ?? null,
    // Açıkken kayıt platforma gitmeden yazılır; yanıt gelmezse "hata" olarak kalır.
    status: enabled ? "hata" : "uygulanmadi_kapali",
    error: enabled ? "Platform yanıtı bekleniyor" : null,
    actorId: deps.actorId,
  };

  let logId: string;
  try {
    logId = await deps.store.insertLog(row);
  } catch {
    return { error: "Kayıt yazılamadı; değişiklik yapılmadı." };
  }

  if (!enabled) return { ok: true, status: "uygulanmadi_kapali", message: CLOSED_MESSAGE };

  try {
    await session.apply(input, plan);
  } catch (err) {
    const text = platformErrorText(err, deps.env, secrets);
    await deps.store.updateLog(logId, { status: "hata", error: text }).catch(() => undefined);
    return { error: `Uygulanamadı: ${text} · kayda geçti` };
  }

  // Platformda uygulandı. İki güncelleme ayrı: biri başarısız olsa da öteki yapılır; sabah eşitlemesi düzeltir.
  try {
    await deps.store.updateLog(logId, { status: "uygulandi", error: null });
  } catch {
    console.error("[ads] değişiklik kaydı güncellenemedi");
  }
  try {
    if (plan.kind === "budget") {
      await deps.store.updateBudgetRows(input.platform, plan.target, Math.round(plan.newTl * 1_000_000));
    } else {
      await deps.store.updateObject(input.platform, input.level, input.objectId, { status: plan.newStatus });
    }
  } catch {
    console.error("[ads] reklam nesnesi güncellenemedi");
  }
  return { ok: true, status: "uygulandi", message: successMessage(name, plan) };
}

// ---- Supabase deposu (yalnız gizli anahtarlı istemciyle, requireRole sonrası) ----

/** Google kaynak adı (customers/1/campaignBudgets/2) ya da Meta kimliği. */
const SAFE_FILTER_VALUE = /^[A-Za-z0-9_/]{1,200}$/;

type ObjectDbRow = {
  platform: "google" | "meta";
  level: "campaign" | "adset" | "ad";
  object_id: string;
  name: string;
  status: string | null;
  daily_budget_micros: number | string | null;
  budget_resource: string | null;
};

export function supabaseAdChangeStore(db: SupabaseClient): AdChangeStore & {
  linkContent(platform: "meta", adId: string, code: string, actorId: string): Promise<void>;
} {
  const must = (error: { message?: string } | null) => {
    if (error) throw new Error("db");
  };
  return {
    async loadObject(platform, level, objectId) {
      const { data, error } = await db
        .from("ad_objects")
        .select("platform, level, object_id, name, status, daily_budget_micros, budget_resource")
        .eq("platform", platform)
        .eq("level", level)
        .eq("object_id", objectId)
        .maybeSingle();
      must(error);
      const r = data as ObjectDbRow | null;
      if (!r) return null;
      return {
        platform: r.platform,
        level: r.level,
        objectId: r.object_id,
        name: r.name,
        status: r.status,
        dailyBudgetMicros: r.daily_budget_micros === null ? null : Number(r.daily_budget_micros),
        budgetResource: r.budget_resource,
      };
    },
    async weekBudgetBaselineTl(platform, budgetResource, sinceIso, objectId) {
      // PostgREST or() değerleri çift tırnakla verilir; tırnak, ters bölü ya da ayraç taşıyan değer sorguya girmez.
      if (!SAFE_FILTER_VALUE.test(budgetResource) || !SAFE_FILTER_VALUE.test(objectId)) throw new Error("Geçersiz bütçe kaynağı");
      const { data, error } = await db
        .from("ad_change_log")
        .select("old_value")
        .eq("platform", platform)
        .eq("action", "budget")
        .or(
          `new_value->>budget_resource.eq."${budgetResource}",and(new_value->>budget_resource.is.null,object_id.eq."${objectId}")`,
        )
        .eq("status", "uygulandi")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: true })
        .limit(1);
      must(error);
      const v = (data?.[0] as { old_value?: { daily_budget_tl?: unknown } } | undefined)?.old_value?.daily_budget_tl;
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    },
    async insertLog(row) {
      const { data, error } = await db
        .from("ad_change_log")
        .insert({
          platform: row.platform,
          level: row.level,
          object_id: row.objectId,
          object_name: row.objectName,
          action: row.action,
          old_value: row.oldValue,
          new_value: row.newValue,
          reason: row.reason,
          gate_red: row.gateRed,
          source: row.source,
          recommendation_id: row.recommendationId,
          status: row.status,
          error: row.error,
          actor_id: row.actorId,
        })
        .select("id")
        .single();
      must(error);
      return (data as { id: string }).id;
    },
    async updateLog(id, patch) {
      const { error } = await db.from("ad_change_log").update(patch).eq("id", id);
      must(error);
    },
    async updateObject(platform, level, objectId, patch) {
      const { error } = await db
        .from("ad_objects")
        .update(patch)
        .eq("platform", platform)
        .eq("level", level)
        .eq("object_id", objectId);
      must(error);
    },
    async updateBudgetRows(platform, budgetResource, micros) {
      const { error } = await db
        .from("ad_objects")
        .update({ daily_budget_micros: micros })
        .eq("platform", platform)
        .eq("budget_resource", budgetResource);
      must(error);
    },
    async linkContent(platform, adId, code, actorId) {
      const link = await db
        .from("ad_content_links")
        .upsert(
          { platform, ad_id: adId, content_code: code, linked_by: actorId, linked_at: new Date().toISOString() },
          { onConflict: "platform,ad_id" },
        );
      must(link.error);
      const spend = await db.from("ad_spend_daily").update({ content_code: code }).eq("platform", platform).eq("ad_id", adId);
      must(spend.error);
      const obj = await db
        .from("ad_objects")
        .update({ content_code: code })
        .eq("platform", platform)
        .eq("level", "ad")
        .eq("object_id", adId);
      must(obj.error);
    },
  };
}
