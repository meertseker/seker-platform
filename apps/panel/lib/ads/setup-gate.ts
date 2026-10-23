// Tek yazım kapısının kurulum kolu (B7): kampanya kurulumu, reklam kurulumu, büyütmeye taşıma, kitle güncelleme.
// Sıra: doğrula → (reklam_kur / buyutmeye_tasi, "kur") kırmızı kapı → ek gerekçe kuralı (72 saat) →
// ad_change_log (önce kayıt) → bayrak / "Sadece göster" → Meta adımları → kayıt sonucu.
// Kayıt yazılamazsa platforma gidilmez. Erişim anahtarı ve appsecret_proof hiçbir kayda ve metne girmez.
import { appSecretProof } from "./meta/config";
import { MetaApiError } from "./meta/insights";
import type { runSetupSteps, SetupStep } from "./meta/setup";
import type { PlannedChange } from "./setup-plans";
import { adsWriteEnabled, type AdChangeLogRow, type AdChangeStore, type AdLogSource, type GateStatus } from "./writes";

export type SetupAction = "kampanya_kur" | "reklam_kur" | "buyutmeye_tasi" | "kitle_guncelle";

export type SetupChangeInput = {
  action: SetupAction;
  level: "campaign" | "ad" | "audience";
  objectId: string;
  objectName: string;
  source: AdLogSource;
  mode: "kur" | "goster";
  reason?: string;
  /** Dolu ise (ör. "72 saatten önce teste alınamaz · kalan 20 saat") "kur" modunda en az 10 karakter gerekçe ister. */
  extraReasonRequired?: string | null;
  recommendationId?: string;
  oldValue: Record<string, unknown> | null;
  planned: PlannedChange;
  /** new_value'ya eklenen alanlar (ör. kitle sayısı, checklist). Gizli değer ya da hash taşımamalı. */
  logExtra?: Record<string, unknown>;
  /** false: adım parametreleri kayda yazılmaz (kitle: hash'ler). Varsayılan true. */
  logSteps?: boolean;
};

export type SetupDeps = {
  store: AdChangeStore;
  actorId: string;
  env: Record<string, string | undefined>;
  /** Sunucuda hesaplanan kapı durumu (`loadGateStatus`). */
  gateStatus: () => Promise<GateStatus>;
  run: (steps: SetupStep[]) => ReturnType<typeof runSetupSteps>;
};

export type SetupResult =
  | { ok: true; status: "uygulandi"; ids: Record<string, string>; message: string }
  | { ok: true; status: "uygulanmadi_kapali"; summary: string[]; message: string }
  | { error: string; needsReason?: boolean; ids?: Record<string, string> };

const MIN_REASON = 10;
const MAX_REASON = 500;
const MAX_NAME = 200;
const MAX_OBJECT_ID = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOURCES: AdLogSource[] = ["kampanyalar", "oneri", "icerik", "ayarlar", "cron"];
const LEVEL_OF: Record<SetupAction, SetupChangeInput["level"]> = {
  kampanya_kur: "campaign",
  reklam_kur: "ad",
  buyutmeye_tasi: "ad",
  kitle_guncelle: "audience",
};
/** Kapıya bakan eylemler (B7); kampanya kurulumu ve kitle güncellemesi bakmaz. */
const GATED: SetupAction[] = ["reklam_kur", "buyutmeye_tasi"];
const SECRET_KEYS = new Set(["access_token", "appsecret_proof"]);
/** new_value'da kapının kendi yazdığı alanlar; logExtra bunları taşıyamaz. */
const RESERVED_VALUE_KEYS = new Set(["mode", "summary", "steps", "ids", "failedKey"]);

const MSG_GOSTER = "Kaydedildi · uygulanmadı: sadece göster";
const MSG_CLOSED = "Kaydedildi · uygulanmadı: canlı yazım kapalı";
const MSG_LOG_FAILED = "Kayıt yazılamadı; değişiklik yapılmadı.";
const MSG_GATE_FAILED = "Bu haftanın kapıları hesaplanamadı; şimdilik kurulamaz.";
/** Platforma gitmeden yazılan kaydın bekleme metni; yanıt gelmezse kayıt bu metinle `hata` kalır. */
export const SETUP_PENDING_ERROR = "Platform yanıtı bekleniyor";

const DONE_TEXT: Record<SetupAction, string> = {
  kampanya_kur: "Kampanyalar kuruldu",
  reklam_kur: "Reklam kuruldu",
  buyutmeye_tasi: "Büyütmeye taşındı",
  kitle_guncelle: "Kitle güncellendi",
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validate(input: SetupChangeInput): string | null {
  if (!isRecord(input)) return "Geçersiz istek.";
  if (!Object.prototype.hasOwnProperty.call(LEVEL_OF, input.action)) return "Geçersiz işlem.";
  if (LEVEL_OF[input.action] !== input.level) return "Geçersiz düzey.";
  if (typeof input.objectId !== "string" || !input.objectId.trim() || input.objectId.length > MAX_OBJECT_ID) {
    return "Geçersiz nesne kimliği.";
  }
  if (typeof input.objectName !== "string") return "Geçersiz ad.";
  if (!SOURCES.includes(input.source)) return "Geçersiz kaynak.";
  if (input.mode !== "kur" && input.mode !== "goster") return "Geçersiz kip.";
  if (input.reason !== undefined && typeof input.reason !== "string") return "Geçersiz gerekçe.";
  if (input.extraReasonRequired != null && typeof input.extraReasonRequired !== "string") return "Geçersiz istek.";
  if (input.recommendationId !== undefined && (typeof input.recommendationId !== "string" || !UUID.test(input.recommendationId))) {
    return "Geçersiz öneri.";
  }
  if (input.oldValue !== null && !isRecord(input.oldValue)) return "Geçersiz eski değer.";
  if (input.logExtra !== undefined && !isRecord(input.logExtra)) return "Geçersiz istek.";
  const p = input.planned;
  if (!isRecord(p) || !Array.isArray(p.steps) || p.steps.length === 0) return "Kurulacak adım yok.";
  if (!Array.isArray(p.summary) || p.summary.some((l) => typeof l !== "string")) return "Geçersiz özet.";
  return null;
}

/** Savunma: kayda giden yükten erişim anahtarı / appsecret_proof alanlarını (iç içe) atar. */
function stripSecretKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSecretKeys);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => !SECRET_KEYS.has(k))
        .map(([k, v]) => [k, stripSecretKeys(v)]),
    );
  }
  return value;
}

function secretsOf(env: Record<string, string | undefined>): string[] {
  const out: string[] = [];
  const token = env.META_ACCESS_TOKEN;
  const secret = env.META_APP_SECRET;
  if (token) out.push(token);
  if (secret) out.push(secret);
  if (token && secret) out.push(appSecretProof(token, secret));
  return out;
}

/** Hata metninden yapılandırmadaki gizli değerleri siler ve kısaltır (runSetupSteps zaten `sanitize` eder; ikinci kat). */
function scrub(text: string, secrets: string[]): string {
  let out = text;
  for (const s of secrets) if (s.length >= 4) out = out.split(s).join("[gizli]");
  return out.length > MAX_REASON ? out.slice(0, MAX_REASON) : out;
}

/**
 * Kurulum kapısı. "kur" modunda reklam_kur / buyutmeye_tasi kapı kırmızıyken en az 10 karakter gerekçe ister
 * (engellemez); extraReasonRequired (72 saat) da aynı gerekçeyi ister. "goster" modu hiçbir kontrole takılmaz,
 * kayıt `uygulanmadi_kapali` olur ve platforma gidilmez. Bayrak kapalıyken de aynı.
 */
export async function executeSetupChange(deps: SetupDeps, input: SetupChangeInput): Promise<SetupResult> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const reason = typeof input.reason === "string" && input.reason.trim() ? input.reason.trim().slice(0, MAX_REASON) : null;
  const hasReason = (reason?.length ?? 0) >= MIN_REASON;
  const apply = input.mode === "kur";

  let gate: GateStatus = { red: false, labels: [] };
  if (apply && GATED.includes(input.action)) {
    try {
      gate = await deps.gateStatus();
    } catch {
      return { error: MSG_GATE_FAILED };
    }
    if (gate.red && !hasReason) {
      return {
        error: `Bir kapı kırmızı (${gate.labels.join(", ")}). Yine de yapacaksanız nedenini yazın (en az ${MIN_REASON} karakter).`,
        needsReason: true,
      };
    }
  }

  const extra = typeof input.extraReasonRequired === "string" ? input.extraReasonRequired.trim() : "";
  if (apply && extra && !hasReason) {
    return { error: `${extra}. Yine de yapacaksanız nedenini yazın (en az ${MIN_REASON} karakter).`, needsReason: true };
  }

  const live = apply && adsWriteEnabled(deps.env);
  const steps = input.planned.steps;
  const summary = [...input.planned.summary];
  // Çekirdek alanlar en son yayılır: logExtra bunları (ve sonradan eklenen ids/failedKey'i) ezemez.
  const extraValue = Object.fromEntries(
    Object.entries(input.logExtra ?? {}).filter(([k]) => !RESERVED_VALUE_KEYS.has(k)),
  );
  const baseValue = stripSecretKeys({
    ...extraValue,
    mode: input.mode,
    summary,
    ...(input.logSteps === false
      ? {}
      : { steps: steps.map((s) => ({ key: s.key, label: s.label, path: s.path, params: s.params })) }),
  }) as Record<string, unknown>;

  const row: AdChangeLogRow = {
    platform: "meta",
    level: input.level,
    objectId: input.objectId.trim(),
    objectName: (input.objectName || input.objectId).slice(0, MAX_NAME),
    action: input.action,
    oldValue: input.oldValue === null ? null : (stripSecretKeys(input.oldValue) as Record<string, unknown>),
    newValue: baseValue,
    reason,
    gateRed: gate.red,
    source: input.source,
    recommendationId: input.recommendationId ?? null,
    // Uygulanacaksa kayıt platforma gitmeden yazılır; yanıt gelmezse "hata" olarak kalır.
    status: live ? "hata" : "uygulanmadi_kapali",
    error: live ? SETUP_PENDING_ERROR : null,
    actorId: deps.actorId,
  };

  let logId: string;
  try {
    logId = await deps.store.insertLog(row);
  } catch {
    return { error: MSG_LOG_FAILED };
  }

  if (!live) {
    return { ok: true, status: "uygulanmadi_kapali", summary, message: apply ? MSG_CLOSED : MSG_GOSTER };
  }

  const secrets = secretsOf(deps.env);
  let outcome: Awaited<ReturnType<SetupDeps["run"]>>;
  try {
    outcome = await deps.run(steps);
  } catch (err) {
    const text =
      err instanceof MetaApiError
        ? scrub(err.message, secrets)
        : `Platform isteği başarısız (${err instanceof Error ? err.name : "bilinmeyen"})`;
    outcome = { ok: false, ids: {}, failedKey: "", error: text };
  }

  const ids = { ...outcome.ids };
  if (!outcome.ok) {
    const text = scrub(outcome.error, secrets);
    const newValue = { ...baseValue, ids, ...(outcome.failedKey ? { failedKey: outcome.failedKey } : {}) };
    await deps.store.updateLog(logId, { status: "hata", error: text, newValue }).catch(() => undefined);
    const built = Object.values(ids);
    const tail = built.length > 0 ? ` · Yarım kalan nesneler (hepsi DURAKLATILMIŞ): ${built.join(", ")}` : "";
    return { error: `Uygulanamadı: ${text} · kayda geçti${tail}`, ids };
  }

  // Platformda uygulandı: kayıt güncellenemese de başarı döner (yalan söylemez), mesaj bunu belirtir.
  let note = " · kayda geçti";
  try {
    await deps.store.updateLog(logId, { status: "uygulandi", error: null, newValue: { ...baseValue, ids } });
  } catch {
    console.error("[ads] kurulum kaydı güncellenemedi");
    note = " · kayıt güncellenemedi";
  }
  return { ok: true, status: "uygulandi", ids, message: `✓ ${DONE_TEXT[input.action]}${note}` };
}
