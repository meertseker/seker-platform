// Mevcut veli dışlama kitlesinin haftalık (Pazartesi) güncellemesi (K23). Cron ve tek seferlik kurulum çağırır.
// Telefonlar yalnız `students.status = 'aktif'` satırlarından (velilerin yazılı onayı var). Her yazım
// `executeSetupChange` üzerinden: önce kayıt, sonra ADS_WRITE_ENABLED. Kayda yalnız sayılar girer (telefon/hash yok).
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "@/lib/content/board";
import { istanbulDateString } from "@/lib/lead-flow/business-hours";
import type { AdSetup } from "./ad-setup";
import type { AdTemplate } from "./ad-template";
import {
  createExclusionAudience,
  EXCLUSION_AUDIENCE_NAME,
  hashParentPhones,
  replaceAudienceUsers,
  updateAdsetExclusion,
} from "./meta/audiences";
import type { MetaConfig } from "./meta/config";
import { MetaApiError, sanitize } from "./meta/insights";
import { buildAdsetTargeting, ref, runSetupSteps, type SetupStep } from "./meta/setup";
import { executeSetupChange } from "./setup-gate";
import { supabaseSetupStore } from "./setup-store";
import type { FetchFn } from "./types";
import { mondayOf } from "./weekly";
import { supabaseAdChangeStore, type AdLogSource } from "./writes";

export type AudienceRefreshStatus = "atlandi" | "uygulandi" | "uygulanmadi_kapali" | "hata";
export type AudienceRefreshResult = { status: AudienceRefreshStatus; count: number; message: string };

/** `now` İstanbul takviminde Pazartesi mi (sunucunun yerel günü değil). */
export function isIstanbulMonday(now: Date): boolean {
  const day = istanbulDateString(now);
  return mondayOf(day) === day;
}

/** Aktif öğrencilerin dolu telefonları (boş telefon geçersiz sayılmaz, hiç gönderilmez). */
async function loadActiveParentPhones(db: SupabaseClient): Promise<string[]> {
  const rows = await fetchAllPages<{ phone: string | null }>((f, t) =>
    db.from("students").select("phone").eq("status", "aktif").order("id").range(f, t),
  );
  return rows.map((r) => (r.phone ?? "").trim()).filter(Boolean);
}

function skip(message: string): AudienceRefreshResult {
  return { status: "atlandi", count: 0, message };
}

/**
 * Şablonda "mevcut velileri hariç tut" açık ve kurulum varsa kitleyi aktif velilerin telefonlarıyla değiştirir.
 * Kitle yoksa önce kurar, iki setin hedeflemesine dışlamayı ekler ve kimliği `reklam_kurulum`'a yazar (yalnız
 * hepsi başarılıysa; yarıda kalırsa bir sonraki çalışma yeni kitleyle baştan dener). Atmaz.
 */
export async function refreshExclusionAudience(deps: {
  db: SupabaseClient;
  cfg: MetaConfig;
  env: Record<string, string | undefined>;
  fetchFn?: FetchFn;
  now: Date;
  /** Varsayılan "cron"; kurulum sonrası "ayarlar". */
  source?: AdLogSource;
  /** Varsayılan şablonu son kaydeden (B2). */
  actorId?: string;
}): Promise<AudienceRefreshResult> {
  const { db, cfg } = deps;
  const fetchFn = deps.fetchFn ?? fetch;
  const store = supabaseSetupStore(db);

  let template: AdTemplate;
  let setup: AdSetup | null;
  try {
    [template, setup] = await Promise.all([store.template(), store.setup()]);
  } catch {
    return { status: "hata", count: 0, message: "Reklam şablonu ya da kurulum okunamadı" };
  }
  if (!template.mevcutVelileriHaricTut) return skip("Şablonda mevcut veliler hariç tutulmuyor");
  if (!setup) return skip("Test ve Büyütme kampanyaları kurulu değil");
  const actorId = deps.actorId ?? template.updatedBy;
  if (!actorId) return skip("Şablonu kaydeden yok; kitle güncellenmedi");

  let phones: string[];
  try {
    phones = await loadActiveParentPhones(db);
  } catch {
    return { status: "hata", count: 0, message: "Öğrenci telefonları okunamadı" };
  }
  const { hashes, skipped } = hashParentPhones(phones);
  const count = hashes.length;
  if (count === 0) return skip("Aktif öğrencilerde geçerli telefon yok");

  const current = setup;
  const audienceId = current.exclusionAudienceId;
  const steps: SetupStep[] = [];
  const summary: string[] = [];
  if (!audienceId) {
    try {
      buildAdsetTargeting(template, ref("audience"));
    } catch {
      return { status: "hata", count, message: "Okul konumu eksik; kitle reklam setlerine eklenemez" };
    }
    steps.push(createExclusionAudience(cfg.adAccountId, "audience"));
    summary.push(`Özel Hedef Kitle kurulur: ${EXCLUSION_AUDIENCE_NAME}`);
  }
  // Yük kayda yazılmaz (logSteps:false); gönderimde hash'ler `run` içinde eklenir.
  steps.push({
    key: "users",
    label: `Kitleye ${count} telefon yükle (SHA-256)`,
    path: audienceId ? `${audienceId}/usersreplace` : { ref: "audience", suffix: "/usersreplace" },
    params: { count },
    result: "success",
  });
  summary.push(
    `Kitle üyeleri değiştirilir: ${count} veli telefonu (SHA-256)` + (skipped > 0 ? ` · ${skipped} geçersiz numara atlandı` : ""),
  );
  if (!audienceId) {
    steps.push(
      updateAdsetExclusion(current.testAdsetId, buildAdsetTargeting(template, ref("audience")), "testAdsetExclusion"),
      updateAdsetExclusion(current.scaleAdsetId, buildAdsetTargeting(template, ref("audience")), "scaleAdsetExclusion"),
    );
    summary.push("Test ve Büyütme reklam setlerinde mevcut veliler hariç");
  }

  const run = async (): ReturnType<typeof runSetupSteps> => {
    const ids: Record<string, string> = {};
    let id = audienceId;
    if (!id) {
      const created = await runSetupSteps(cfg, [createExclusionAudience(cfg.adAccountId, "audience")], fetchFn);
      if (!created.ok) return created;
      id = created.ids.audience;
      ids.audience = id;
    }
    try {
      await replaceAudienceUsers(cfg, id, hashes, deps.now.getTime(), fetchFn);
    } catch (err) {
      const text =
        err instanceof MetaApiError ? err.message : `Kitle yüklemesi başarısız (${err instanceof Error ? err.name : "bilinmeyen"})`;
      return { ok: false, ids: { ...ids }, failedKey: "users", error: sanitize(text, cfg) };
    }
    if (ids.audience) {
      const updates = await runSetupSteps(
        cfg,
        [
          updateAdsetExclusion(current.testAdsetId, buildAdsetTargeting(template, id), "testAdsetExclusion"),
          updateAdsetExclusion(current.scaleAdsetId, buildAdsetTargeting(template, id), "scaleAdsetExclusion"),
        ],
        fetchFn,
      );
      if (!updates.ok) return { ...updates, ids: { ...ids, ...updates.ids } };
    }
    return { ok: true, ids };
  };

  const result = await executeSetupChange(
    {
      store: supabaseAdChangeStore(db),
      actorId,
      env: deps.env,
      // kitle_guncelle kapıya bakmaz (B7); tip gereği verilir.
      gateStatus: async () => ({ red: false, labels: [] }),
      run,
    },
    {
      action: "kitle_guncelle",
      level: "audience",
      objectId: audienceId ?? "kitle",
      objectName: EXCLUSION_AUDIENCE_NAME,
      source: deps.source ?? "cron",
      mode: "kur",
      oldValue: audienceId ? { audienceId } : null,
      planned: { steps, summary },
      logSteps: false,
      logExtra: { count, skipped },
    },
  ).catch(() => ({ error: "Kitle güncellemesi yapılamadı" }) as const);

  if ("error" in result) return { status: "hata", count, message: result.error };
  if (result.status === "uygulanmadi_kapali") return { status: "uygulanmadi_kapali", count, message: result.message };

  const created = result.ids.audience;
  if (created) {
    try {
      await store.saveSetup({ ...current, exclusionAudienceId: created });
    } catch {
      return { status: "hata", count, message: `Kitle Meta'da kuruldu (${created}) ama kimliği panele kaydedilemedi` };
    }
  }
  return { status: "uygulandi", count, message: result.message };
}
