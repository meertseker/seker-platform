// Meta'ya yazma: kampanya / reklam seti / reklam durumu ve günlük bütçe. Yalnız değişiklik kapısı çağırır.
import type { FetchFn } from "../types";
import { appSecretProof, META_GRAPH_API_VERSION, META_GRAPH_BASE, type MetaConfig } from "./config";
import { headers, MetaApiError, toApiError } from "./insights";

const WRITE_TIMEOUT_MS = 30_000;
const DIGITS = /^\d{1,30}$/;

/**
 * `POST /<id>` form gövdesiyle; anahtar yalnız başlıkta, appsecret_proof gövdede.
 * Yanıt `{success:true}`; başka her şey hata sayılır.
 */
async function postObject(
  cfg: MetaConfig,
  objectId: string,
  fields: Record<string, string>,
  label: string,
  fetchFn: FetchFn,
): Promise<void> {
  if (!DIGITS.test(objectId)) throw new MetaApiError("Geçersiz Meta nesne kimliği", 400);
  const body = new URLSearchParams({ ...fields, appsecret_proof: appSecretProof(cfg.accessToken, cfg.appSecret) });
  const response = await fetchFn(`${META_GRAPH_BASE}/${META_GRAPH_API_VERSION}/${objectId}`, {
    method: "POST",
    headers: { ...headers(cfg), "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
  });
  if (!response.ok) throw await toApiError(response, cfg, label);
  const data = (await response.json().catch(() => null)) as { success?: unknown } | null;
  if (data?.success !== true) throw new MetaApiError(`${label}: Meta başarı bildirmedi`, 502);
}

/**
 * Kampanya, reklam seti ya da reklamın durumunu değiştirir: `status=PAUSED|ACTIVE` → `{success:true}`.
 * Kaynak: https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/
 */
export async function metaSetStatus(
  cfg: MetaConfig,
  objectId: string,
  status: "PAUSED" | "ACTIVE",
  fetchFn: FetchFn = fetch,
): Promise<void> {
  await postObject(cfg, objectId, { status }, "Meta durumu değiştirilemedi", fetchFn);
}

/**
 * Günlük bütçeyi değiştirir. `daily_budget` int64, hesap para biriminin alt biriminde:
 * TRY için ×100 (kuruş) — bütçe için TEYİTSİZ, ilk gerçek hesapta Reklam Yöneticisi ile karşılaştırılacak.
 * Bütçe kampanyada ya da reklam setinde durur (ikisinde değil); çağıran bütçenin durduğu nesneyi verir.
 * Kaynak: https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/ ·
 * https://developers.facebook.com/docs/marketing-api/currencies
 */
export async function metaSetDailyBudget(
  cfg: MetaConfig,
  objectId: string,
  kurus: number,
  fetchFn: FetchFn = fetch,
): Promise<void> {
  if (!Number.isSafeInteger(kurus) || kurus <= 0) throw new MetaApiError("Geçersiz bütçe tutarı", 400);
  await postObject(cfg, objectId, { daily_budget: String(kurus) }, "Meta bütçesi değiştirilemedi", fetchFn);
}
