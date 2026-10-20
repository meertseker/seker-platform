// Reklam platformuna yazmanın tek kapısı: durdur, yeniden başlat, günlük bütçe.
// Her işlem önce ad_change_log'a yazılır; ADS_WRITE_ENABLED "true" değilse platforma gidilmez.
// Kampanya / reklam seti / reklam oluşturan bir yol yoktur.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getLeadFlowSettings } from "@/lib/lead-flow/settings";
import { istanbulDateString } from "@/lib/lead-flow/business-hours";
import { loadWeeklyData } from "@/lib/queries/weekly";
import { formatTl } from "@/lib/content/board";
import type { AdSettings } from "./ad-settings";
import { readAdsConfig } from "./config";
import { getAccessToken, GoogleApiError } from "./googleAds";
import { googleSetBudget, googleSetStatus } from "./google-writes";
import { readMetaConfig } from "./meta/config";
import { MetaApiError } from "./meta/insights";
import { metaSetDailyBudget, metaSetStatus } from "./meta/writes";
import type { FetchFn } from "./types";
import { anyGateRed, computeWeekGates, lastCompletedWeekStart, mondayOf, weekRange } from "./weekly";

export type AdChangeAction = {
  platform: "google" | "meta";
  level: "campaign" | "adset" | "ad";
  objectId: string;
  objectName: string;
  kind: "pause" | "resume" | "budget";
  newDailyBudgetTl?: number;
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
  /** Bu hafta (sinceIso'dan beri) platforma uygulanmış ilk bütçe değişikliğinin eski değeri; yoksa null. */
  weekBudgetBaselineTl(platform: string, level: string, objectId: string, sinceIso: string): Promise<number | null>;
  insertLog(row: AdChangeLogRow): Promise<string>;
  updateLog(id: string, patch: Pick<AdChangeLogRow, "status" | "error">): Promise<void>;
  updateObject(platform: string, level: string, objectId: string, patch: Record<string, unknown>): Promise<void>;
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
const MIN_REASON = 10;
const MAX_REASON = 500;
const MAX_NAME = 200;
const MAX_BUDGET_TL = 1_000_000;
const DIGITS = /^\d{1,30}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAUSED = new Set(["PAUSED"]);
const RUNNING = new Set(["ENABLED", "ACTIVE"]);

/** Canlı yazım yalnız `ADS_WRITE_ENABLED === "true"` iken açık. */
export function adsWriteEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.ADS_WRITE_ENABLED === "true";
}

/** Bu hafta ve geçen tamamlanmış hafta (Pazartesi toplantısının haftası); biri kırmızıysa kırmızı. */
export async function loadGateStatus(supabase: SupabaseClient, now: Date, settings: AdSettings): Promise<GateStatus> {
  const { hours } = await getLeadFlowSettings(supabase);
  const weeks = [mondayOf(istanbulDateString(now)), lastCompletedWeekStart(now)];
  const data = await Promise.all(weeks.map((w) => loadWeeklyData(supabase, w)));
  const labels = new Set<string>();
  // "Bu hafta" ekranıyla aynı hesap: ulaşma önceki haftanın olgun kohortu, gelme takvim haftasının randevuları.
  for (const d of data) for (const l of anyGateRed(computeWeekGates(d, now, hours, settings)).labels) labels.add(l);
  return { red: labels.size > 0, labels: [...labels] };
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

/** Platform çağrısı; başarıda ad_objects'e yazılacak yamayı döner. Başarısızlıkta fırlatır. */
async function callPlatform(
  input: AdChangeInput,
  plan: Plan,
  deps: AdChangeDeps,
  secrets: string[],
): Promise<Record<string, unknown>> {
  if (input.platform === "google") {
    const cfg = readAdsConfig(deps.env);
    if (!cfg) throw new GoogleApiError("Google Ads yapılandırılmamış", 400);
    const token = await getAccessToken(cfg, deps.fetchFn);
    secrets.push(token);
    if (plan.kind === "budget") {
      const micros = Math.round(plan.newTl * 1_000_000);
      await googleSetBudget(cfg, token, plan.target, micros, deps.fetchFn);
      return { daily_budget_micros: micros };
    }
    const status = plan.kind === "pause" ? "PAUSED" : "ENABLED";
    await googleSetStatus(cfg, token, input.objectId, status, deps.fetchFn);
    return { status };
  }

  const cfg = readMetaConfig(deps.env);
  if (!cfg) throw new MetaApiError("Meta yapılandırılmamış", 400);
  if (plan.kind === "budget") {
    // TRY ×100 (kuruş) — TEYİTSİZ (meta/writes.ts).
    await metaSetDailyBudget(cfg, plan.target, Math.round(plan.newTl * 100), deps.fetchFn);
    return { daily_budget_micros: Math.round(plan.newTl * 1_000_000) };
  }
  const status = plan.kind === "pause" ? "PAUSED" : "ACTIVE";
  await metaSetStatus(cfg, input.objectId, status, deps.fetchFn);
  return { status };
}

function successMessage(name: string, plan: Plan): string {
  if (plan.kind !== "budget") {
    return plan.kind === "pause" ? `✓ ${name} durduruldu · kayda geçti` : `✓ ${name} yeniden başladı · kayda geçti`;
  }
  const old = plan.oldTl === null ? "?" : tlText(plan.oldTl).replace(/ TL$/, "");
  return `✓ Bütçe ${old} TL → ${tlText(plan.newTl)} · kayda geçti`;
}

/**
 * Değişiklik kapısı. Sıra: doğrula → ad_objects'ten eski değer → (artışta) kapı ve büyütme sınırı →
 * ad_change_log → canlı yazım açıksa platform → kayıt sonucu (+ ad_objects).
 * Kırmızı kapıda ya da haftalık büyütme sınırını aşan artışta en az 10 karakter gerekçe zorunlu;
 * durdurma, başlatma ve azaltma gerekçesiz.
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

  let plan: Plan;
  if (input.kind === "budget") {
    if (!obj.budgetResource) return { error: "Bu nesnenin günlük bütçesi yok; bütçe başka düzeyde olabilir." };
    const oldTl = obj.dailyBudgetMicros === null ? null : roundKurus(obj.dailyBudgetMicros / 1_000_000);
    const newTl = roundKurus(input.newDailyBudgetTl as number);
    if (oldTl !== null && newTl === oldTl) return { error: "Bütçe değişmedi." };
    plan = { kind: "budget", target: obj.budgetResource, oldTl, newTl };
  } else if (input.kind === "pause") {
    if (obj.status && PAUSED.has(obj.status)) return { error: "Bu reklam zaten durdurulmuş." };
    plan = { kind: "pause", oldStatus: obj.status, newStatus: "PAUSED" };
  } else {
    if (obj.status && RUNNING.has(obj.status)) return { error: "Bu reklam zaten çalışıyor." };
    plan = { kind: "resume", oldStatus: obj.status, newStatus: input.platform === "google" ? "ENABLED" : "ACTIVE" };
  }

  const isIncrease = plan.kind === "budget" ? plan.oldTl === null || plan.newTl > plan.oldTl : false;

  // Kapılar her işlemde kayda geçmek için hesaplanır; yalnız artışta engeller (Review Focus 1-2).
  let gate: GateStatus = { red: false, labels: [] };
  try {
    gate = await deps.gateStatus();
  } catch {
    if (isIncrease) return { error: "Bu haftanın kapıları hesaplanamadı; bütçe artışı şimdilik yapılamaz." };
  }

  if (isIncrease && plan.kind === "budget") {
    // Sınır haftanın başındaki bütçeye göre: 150→180→216 gibi basamaklı artış da yakalanır.
    if (gate.red && !hasReason) {
      return {
        error: `Bu hafta bir kapı kırmızı (${gate.labels.join(", ")}). Bütçe artışı önerilmiyor. Yine de yapacaksanız nedenini yazın (en az ${MIN_REASON} karakter).`,
        needsReason: true,
      };
    }
    const settings = await deps.settings();
    const base =
      (await deps.store.weekBudgetBaselineTl(input.platform, input.level, input.objectId, weekRange(mondayOf(istanbulDateString(now))).from)) ??
      plan.oldTl;
    const pct = base && base > 0 ? ((plan.newTl - base) / base) * 100 : Number.POSITIVE_INFINITY;
    if (pct > settings.scaleMaxPct + 1e-9 && !hasReason) {
      const detail = Number.isFinite(pct) ? ` (bu hafta +%${Math.round(pct)})` : " (eski bütçe bilinmiyor)";
      return {
        error: `Artış haftalık %${settings.scaleMaxPct} büyütme sınırını aşıyor${detail}. Yine de yapacaksanız nedenini yazın (en az ${MIN_REASON} karakter).`,
        needsReason: true,
      };
    }
  }

  const enabled = adsWriteEnabled(deps.env);
  const row: AdChangeLogRow = {
    platform: input.platform,
    level: input.level,
    objectId: input.objectId,
    objectName: name,
    action: input.kind,
    oldValue: plan.kind === "budget" ? { daily_budget_tl: plan.oldTl } : { status: plan.oldStatus },
    newValue: plan.kind === "budget" ? { daily_budget_tl: plan.newTl } : { status: plan.newStatus },
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

  const secrets: string[] = [];
  let patch: Record<string, unknown>;
  try {
    patch = await callPlatform(input, plan, deps, secrets);
  } catch (err) {
    const text = platformErrorText(err, deps.env, secrets);
    await deps.store.updateLog(logId, { status: "hata", error: text }).catch(() => undefined);
    return { error: `Uygulanamadı: ${text} · kayda geçti` };
  }

  try {
    await deps.store.updateLog(logId, { status: "uygulandi", error: null });
    await deps.store.updateObject(input.platform, input.level, input.objectId, patch);
  } catch {
    // Platformda uygulandı; kayıt güncellenemezse sabah eşitlemesi ad_objects'i düzeltir.
    console.error("[ads] değişiklik kaydı güncellenemedi");
  }
  return { ok: true, status: "uygulandi", message: successMessage(name, plan) };
}

// ---- Supabase deposu (yalnız gizli anahtarlı istemciyle, requireRole sonrası) ----

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
    async weekBudgetBaselineTl(platform, level, objectId, sinceIso) {
      const { data, error } = await db
        .from("ad_change_log")
        .select("old_value")
        .eq("platform", platform)
        .eq("level", level)
        .eq("object_id", objectId)
        .eq("action", "budget")
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
