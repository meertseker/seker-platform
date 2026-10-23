// Mevcut veli dışlama kitlesi (K23): Özel Hedef Kitle kurulumu, telefon yüklemesi (usersreplace) ve reklam
// setlerinin hedeflemesine dışlamanın eklenmesi. Velilerin yazılı onayı var; Meta'ya yalnız SHA-256 telefon gider.
// Telefon ve hash hiçbir kayda, hata metnine ya da konsola girmez (yalnız sayılar).
//
// Kaynak (Özel Hedef Kitle, customaudiences, usersreplace, PHONE normalizasyonu, 10.000/istek, 200/1870090):
//   https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/guides/custom-audiences.md
// Dışlama alanı excluded_custom_audiences:
//   https://developers.facebook.com/documentation/ads-commerce/marketing-api/marketing-api-changelog/version22.0.md
import { normalizeTurkishPhone } from "@seker/shared/phone";
import type { FetchFn } from "../types";
import { hashPhone } from "./capi";
import { appSecretProof, META_GRAPH_API_VERSION, META_GRAPH_BASE, type MetaConfig } from "./config";
import { headers, MetaApiError, sanitize } from "./insights";
import type { SetupStep } from "./setup";

export const EXCLUSION_AUDIENCE_NAME = "Mevcut veliler (panel)";
export const EXCLUSION_AUDIENCE_DESCRIPTION = "Yazılı onaylı mevcut velilerin SHA-256 telefonları; dışlama için.";

/** usersreplace istek başına en çok kayıt (Meta sınırı 10.000). */
export const USERS_REPLACE_BATCH = 10_000;

export const MSG_TERMS_NOT_ACCEPTED = "Meta'da Özel Hedef Kitle şartları kabul edilmemiş · Mert kabul eder";

const TERMS_SUBCODE = 1_870_090;
const TIMEOUT_MS = 60_000;
const ID = /^\d{1,30}$/;

/**
 * Telefonları Meta biçimine (ülke kodlu rakamlar, baştaki 0 yok) getirip SHA-256 küçük hex'e çevirir, tekilleştirir.
 * Geçersiz (Türk cep telefonu olmayan) numaralar `skipped`.
 */
export function hashParentPhones(phones: string[]): { hashes: string[]; skipped: number } {
  const seen = new Set<string>();
  let skipped = 0;
  for (const raw of phones) {
    const e164 = typeof raw === "string" ? normalizeTurkishPhone(raw) : null;
    if (!e164) {
      skipped++;
      continue;
    }
    // hashPhone: "+90…" → "90…" rakamları → SHA-256 küçük hex.
    seen.add(hashPhone(e164));
  }
  return { hashes: [...seen], skipped };
}

/** `POST /act_<id>/customaudiences` → `{id}`. */
export function createExclusionAudience(adAccountId: string, key: string): SetupStep {
  return {
    key,
    label: `Özel Hedef Kitle: ${EXCLUSION_AUDIENCE_NAME}`,
    path: `${adAccountId}/customaudiences`,
    params: {
      name: EXCLUSION_AUDIENCE_NAME,
      subtype: "CUSTOM",
      customer_file_source: "USER_PROVIDED_ONLY",
      description: EXCLUSION_AUDIENCE_DESCRIPTION,
    },
    result: "id",
  };
}

/**
 * Mevcut kurulumda kitle sonradan eklenirse iki setin `targeting`'i yeniden gönderilir (`POST /<adset_id>` →
 * `{success:true}`). `targeting`, `createAdSet` ile aynı `buildAdsetTargeting`'den üretilmelidir.
 */
export function updateAdsetExclusion(adsetId: string, targeting: Record<string, unknown>, key: string): SetupStep {
  return {
    key,
    label: "Reklam seti hedeflemesi: mevcut veliler hariç",
    path: adsetId,
    params: { targeting },
    result: "success",
  };
}

/** Hata metninden hash (64 hex) ve uzun rakam dizilerini (telefon) siler; sonra anahtarları (`sanitize`). */
function scrubAudienceText(text: string, cfg: MetaConfig): string {
  return sanitize(text.replace(/[0-9a-f]{64}/gi, "[hash]").replace(/\d{9,}/g, "[sayı]"), cfg);
}

async function audienceError(response: Response, cfg: MetaConfig): Promise<MetaApiError> {
  const raw = await response.text().catch(() => "");
  let message = "";
  let code: number | null = null;
  let subcode: number | null = null;
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: unknown; code?: unknown; error_subcode?: unknown } };
    if (typeof parsed.error?.message === "string") message = parsed.error.message;
    if (typeof parsed.error?.code === "number") code = parsed.error.code;
    if (typeof parsed.error?.error_subcode === "number") subcode = parsed.error.error_subcode;
  } catch {
    // JSON değil: ham gövde metne alınmaz (hash yankılanabilir).
  }
  if (subcode === TERMS_SUBCODE || code === TERMS_SUBCODE) {
    return new MetaApiError(MSG_TERMS_NOT_ACCEPTED, response.status, code, subcode);
  }
  const detail = message ? `: ${scrubAudienceText(message, cfg)}` : "";
  const codeText = code !== null ? `, kod ${code}` : "";
  return new MetaApiError(`Kitle yüklemesi başarısız (HTTP ${response.status}${codeText})${detail}`, response.status, code, subcode);
}

/**
 * Kitlenin tüm üyelerini verilen hash'lerle değiştirir: `POST /<audience_id>/usersreplace`, 10.000'lik partiler,
 * `batch_seq` 1'den, son partide `last_batch_flag:true`. Hata 200/1870090 → şartlar kabul edilmemiş mesajı.
 * Yanıttaki `invalid_entry_samples` okunmaz (hash taşır).
 */
export async function replaceAudienceUsers(
  cfg: MetaConfig,
  audienceId: string,
  hashes: string[],
  sessionId: number,
  fetchFn: FetchFn = fetch,
): Promise<{ received: number; invalid: number }> {
  if (!ID.test(audienceId)) throw new MetaApiError("Geçersiz kitle kimliği", 400);
  if (hashes.length === 0) throw new MetaApiError("Yüklenecek telefon yok", 400);
  const url = `${META_GRAPH_BASE}/${META_GRAPH_API_VERSION}/${audienceId}/usersreplace`;
  const total = hashes.length;
  const batches = Math.ceil(total / USERS_REPLACE_BATCH);
  let received = 0;
  let invalid = 0;
  for (let i = 0; i < batches; i++) {
    const part = hashes.slice(i * USERS_REPLACE_BATCH, (i + 1) * USERS_REPLACE_BATCH);
    const body = new URLSearchParams();
    body.set("payload", JSON.stringify({ schema: ["PHONE"], data: part.map((h) => [h]) }));
    body.set(
      "session",
      JSON.stringify({
        session_id: sessionId,
        batch_seq: i + 1,
        last_batch_flag: i === batches - 1,
        estimated_num_total: total,
      }),
    );
    body.set("appsecret_proof", appSecretProof(cfg.accessToken, cfg.appSecret));
    const response = await fetchFn(url, {
      method: "POST",
      headers: { ...headers(cfg), "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw await audienceError(response, cfg);
    const data = (await response.json().catch(() => null)) as { num_received?: unknown; num_invalid_entries?: unknown } | null;
    received += Number(data?.num_received) || 0;
    invalid += Number(data?.num_invalid_entries) || 0;
  }
  return { received, invalid };
}
