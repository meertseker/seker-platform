import { createHash } from "node:crypto";
import { adUserDataFor } from "../consent";
import type { MetaPendingEvent, MetaStore } from "../store";
import type { FetchFn, UploadOutcome } from "../types";
import { appSecretProof, META_GRAPH_API_VERSION, META_GRAPH_BASE, type MetaConfig } from "./config";
import { sanitize } from "./insights";

const CAPI_TIMEOUT_MS = 15_000;

/**
 * Meta `event_time` en çok 7 gün eski olabilir; topluda tek eski olay tüm isteği düşürür.
 * Kuyruk ile gönderim arasındaki gecikmeye karşı 4 saat pay: 6 gün 20 saat.
 * Kaynak: https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/server-event
 */
const MAX_EVENT_AGE_MS = (6 * 24 + 20) * 3_600_000;

/**
 * Panel aşaması → Meta olay adı. `Enrolled` özel olay (ad serbest).
 * Kaynak: https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/server-event
 */
export const META_EVENT_NAMES: Record<MetaPendingEvent["action"], "Lead" | "Schedule" | "Enrolled"> = {
  lead: "Lead",
  randevu: "Schedule",
  kayit: "Enrolled",
};

/** Olay kimliği soneki; DB tetikleyicisi randevu/kayıt için zaten `<lead_id>:schedule|enrolled` yazar. */
const EVENT_ID_SUFFIX: Record<MetaPendingEvent["action"], string> = {
  lead: "lead",
  randevu: "schedule",
  kayit: "enrolled",
};

/**
 * CRM aşama olayları için sabit custom_data.
 * Kaynak: https://developers.facebook.com/docs/marketing-api/conversions-api/guides/conversions-api-for-crm
 */
const CRM_CUSTOM_DATA = { event_source: "crm", lead_event_source: "Seker Panel" } as const;

function sha256Hex(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * `ph`: ülke kodlu, `+`'sız rakamların SHA-256'sı, küçük harf hex.
 * Kaynak: https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/server-event
 */
export function hashPhone(e164: string): string {
  return sha256Hex(e164.replace(/\D/g, ""));
}

/** `external_id`: küçük harf lead id'nin SHA-256'sı (aynı kaynak, hash önerilir). */
export function hashExternalId(leadId: string): string {
  return sha256Hex(leadId.trim().toLowerCase());
}

/** Lead olayı başvuru anında olur; aşama olayları dönüşüm anında. */
function eventTimeMs(ev: MetaPendingEvent): number {
  return new Date(ev.action === "lead" ? ev.lead.createdAt : ev.conversionAt).getTime();
}

/**
 * K9: olay Meta'ya gidebilir mi? Sırayla:
 *  1. reklam verisi onayı yok (içe aktarılan, arama onaylı, iptal edilmiş ya da onay kaydı yok)
 *  2. onay sürümü 2'den küçük (v1 metni Meta'yı kapsamaz)
 *  3. Lead için çerez onayı yok (piksel/fbc/fbp KVKK çerez rehberine bağlı)
 *  4. olay 6 gün 20 saatten eski
 */
export function metaEligibility(ev: MetaPendingEvent, now: Date): { ok: true } | { ok: false; reason: string } {
  const adUserData = adUserDataFor({
    consent_at: ev.lead.consentAt,
    ad_consent_revoked_at: ev.lead.adConsentRevokedAt,
    web_payload: ev.lead.webPayload,
  });
  // "denied" yanında null (onay kaydı yok) da gönderilmez: Meta'ya veri yalnız açık onayla gider.
  if (adUserData !== "granted") return { ok: false, reason: "reklam verisi onayı yok" };
  if (ev.lead.consentVersion == null || ev.lead.consentVersion < 2) {
    return { ok: false, reason: "onay sürümü eski (Meta yok)" };
  }
  if (ev.action === "lead" && ev.lead.adCookieConsent !== true) return { ok: false, reason: "çerez onayı yok" };
  const at = eventTimeMs(ev);
  if (!Number.isFinite(at) || now.getTime() - at > MAX_EVENT_AGE_MS) return { ok: false, reason: "olay 7 günden eski" };
  return { ok: true };
}

/** `website` olayında zorunlu; site adresi yoksa null. */
function eventSourceUrl(siteUrl: string | null, landingPath: string | null): string | null {
  const base = siteUrl?.trim().replace(/\/+$/, "");
  if (!base) return null;
  const path = landingPath?.trim() || "/";
  return base + (path.startsWith("/") ? path : `/${path}`);
}

/**
 * Tek CAPI olayı. Yalnız izin verilen alanlar: çocuk verisi, düz telefon, not, semt yük'e hiç girmez.
 * fbc/fbp hash'lenmez ve yalnız çerez onayı varsa eklenir (her olay türünde); client_user_agent yalnız Lead'de.
 * Kaynak: https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/fbp-and-fbc
 */
export function buildCapiEvent(ev: MetaPendingEvent, siteUrl: string | null): Record<string, unknown> {
  const userData: Record<string, unknown> = {
    ph: [hashPhone(ev.lead.phone)],
    external_id: [hashExternalId(ev.leadId)],
  };
  if (ev.lead.adCookieConsent === true) {
    if (ev.lead.fbc) userData.fbc = ev.lead.fbc;
    if (ev.lead.fbp) userData.fbp = ev.lead.fbp;
    // website olayında zorunlu; hash'lenmez. Yalnız Lead'de (aşama olayları system_generated).
    const ua = ev.lead.clientUserAgent?.trim();
    if (ev.action === "lead" && ua) userData.client_user_agent = ua;
  }

  const event: Record<string, unknown> = {
    event_name: META_EVENT_NAMES[ev.action],
    event_time: Math.floor(eventTimeMs(ev) / 1000),
    // Lead'de piksel ile aynı kimlik (tekilleştirme); boşsa kararlı yedek.
    event_id: ev.eventId || `${ev.leadId}:${EVENT_ID_SUFFIX[ev.action]}`,
  };

  if (ev.action === "lead") {
    event.action_source = "website";
    const url = eventSourceUrl(siteUrl, ev.lead.landingPath);
    if (url) event.event_source_url = url;
  } else {
    // `crm` geçerli action_source değil; CRM aşamaları system_generated.
    event.action_source = "system_generated";
  }

  event.user_data = userData;

  if (ev.action !== "lead") {
    const customData: Record<string, unknown> = { ...CRM_CUSTOM_DATA };
    if (ev.action === "kayit" && ev.value != null && ev.value > 0) {
      customData.value = ev.value;
      customData.currency = "TRY";
    }
    event.custom_data = customData;
  }
  return event;
}

/**
 * Olayları tek istekte piksele gönderir. Erişim anahtarı yalnız başlıkta; hata metni temizlenir.
 * Kaynak: https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/server-event
 */
export async function sendCapiBatch(
  cfg: MetaConfig,
  events: Record<string, unknown>[],
  fetchFn: FetchFn = fetch,
): Promise<{ ok: true; received: number } | { ok: false; error: string }> {
  const result = await sendCapiRequest(cfg, events, fetchFn);
  return result.ok ? result : { ok: false, error: result.error };
}

type CapiResult = { ok: true; received: number } | { ok: false; error: string; transient: boolean };

/** Geçici hata: ağ/zaman aşımı, HTTP 5xx ve 429. Bunlar sonraki koşuda yeniden denenir; diğer 4xx kalıcıdır. */
function isTransientStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

async function sendCapiRequest(
  cfg: MetaConfig,
  events: Record<string, unknown>[],
  fetchFn: FetchFn = fetch,
): Promise<CapiResult> {
  if (!cfg.pixelId) return { ok: false, error: "Meta piksel kimliği yok", transient: false };
  if (events.length === 0) return { ok: true, received: 0 };

  const url = new URL(`${META_GRAPH_BASE}/${META_GRAPH_API_VERSION}/${cfg.pixelId}/events`);
  url.searchParams.set("appsecret_proof", appSecretProof(cfg.accessToken, cfg.appSecret));
  const body: Record<string, unknown> = { data: events };
  if (cfg.testEventCode) body.test_event_code = cfg.testEventCode;

  try {
    const response = await fetchFn(url.toString(), {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(CAPI_TIMEOUT_MS),
    });
    const raw = await response.text();
    if (!response.ok) {
      let message = raw ? `HTTP ${response.status}: ${raw}` : `HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(raw) as { error?: { message?: string } };
        if (parsed.error?.message) message = parsed.error.message;
      } catch {
        // JSON değilse ham metin
      }
      return {
        ok: false,
        error: `Meta CAPI isteği başarısız: ${sanitize(message, cfg)}`,
        transient: isTransientStatus(response.status),
      };
    }
    // Yanıt biçimi `{events_received, messages, fbtrace_id}` (araştırma notu: TEYİTSİZ).
    let received = 0;
    try {
      const parsed = JSON.parse(raw) as { events_received?: unknown };
      if (typeof parsed.events_received === "number") received = parsed.events_received;
    } catch {
      // gövde okunamazsa sayı 0 kalır; HTTP 2xx başarı sayılır
    }
    return { ok: true, received };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Meta CAPI isteği başarısız: ${sanitize(message, cfg)}`, transient: true };
  }
}

/** Başarısız istek sonucunu satıra çevirir: geçici hata `bekliyor` (yeniden denenir), kalıcı hata `hata`. */
function failedOutcome(id: string, result: { error: string; transient: boolean }): UploadOutcome {
  return { id, status: result.transient ? "bekliyor" : "hata", error: result.error };
}

/**
 * Bir grubu gönderir. Toplu istek kalıcı hatayla (4xx, 429 dışı) düşerse olaylar tek tek denenir; böylece
 * yalnız bozuk olay `hata` olur. Geçici hatada (ağ, 5xx, 429) satırlar `bekliyor` kalır ve hata metni yazılır;
 * sonraki cron yeniden dener. Sınır: 6 gün 20 saati geçen olay uygunluktan düşer (`atlandi`), sonsuz deneme olmaz.
 */
async function sendGroup(
  cfg: MetaConfig,
  group: MetaPendingEvent[],
  siteUrl: string | null,
  fetchFn: FetchFn | undefined,
): Promise<UploadOutcome[]> {
  const result = await sendCapiRequest(cfg, group.map((ev) => buildCapiEvent(ev, siteUrl)), fetchFn);
  if (result.ok) return group.map((ev) => ({ id: ev.id, status: "gonderildi", error: null }));
  if (result.transient || group.length === 1) return group.map((ev) => failedOutcome(ev.id, result));

  const outcomes: UploadOutcome[] = [];
  for (const ev of group) {
    const single = await sendCapiRequest(cfg, [buildCapiEvent(ev, siteUrl)], fetchFn);
    outcomes.push(single.ok ? { id: ev.id, status: "gonderildi", error: null } : failedOutcome(ev.id, single));
  }
  return outcomes;
}

/**
 * Bekleyen Meta olaylarını gönderir. `capiEnabled` kapalıysa kuyruğa dokunmaz (satırlar `bekliyor` kalır).
 * Uygun olmayanlar nedeniyle `atlandi`. Uygunlar iki ayrı grupta gider: Lead (website) ve aşama
 * olayları (Schedule/Enrolled); topluda tek bozuk olay tüm isteği düşürdüğü için bozuk bir Lead aşama
 * olaylarını batırmasın. Hata ayrımı için bkz. sendGroup. `failed`: gönderilemeyen (hata + yeniden denenecek).
 */
export async function uploadMetaPending(
  deps: { cfg: MetaConfig; store: MetaStore; siteUrl: string | null; fetchFn?: FetchFn; now?: Date },
  limit = 50,
): Promise<{ sent: number; failed: number; skipped: number }> {
  const { cfg, store, siteUrl } = deps;
  if (!cfg.capiEnabled) return { sent: 0, failed: 0, skipped: 0 };
  const now = deps.now ?? new Date();

  const pending = await store.listPending(limit);
  const outcomes: UploadOutcome[] = [];
  const eligible: MetaPendingEvent[] = [];
  for (const ev of pending) {
    const check = metaEligibility(ev, now);
    if (!check.ok) {
      outcomes.push({ id: ev.id, status: "atlandi", error: check.reason });
    } else if (ev.action === "lead" && eventSourceUrl(siteUrl, ev.lead.landingPath) === null) {
      // website olayında event_source_url zorunlu; eksik olay tüm toplu isteği düşürmesin.
      outcomes.push({ id: ev.id, status: "atlandi", error: "site adresi yok" });
    } else if (ev.action === "lead" && !ev.lead.clientUserAgent?.trim()) {
      // website olayında client_user_agent da zorunlu.
      outcomes.push({ id: ev.id, status: "atlandi", error: "tarayıcı bilgisi yok" });
    } else {
      eligible.push(ev);
    }
  }

  let sent = 0;
  let failed = 0;
  const groups = [eligible.filter((ev) => ev.action === "lead"), eligible.filter((ev) => ev.action !== "lead")];
  for (const group of groups) {
    if (group.length === 0) continue;
    for (const outcome of await sendGroup(cfg, group, siteUrl, deps.fetchFn)) {
      outcomes.push(outcome);
      if (outcome.status === "gonderildi") sent += 1;
      else failed += 1;
    }
  }

  if (outcomes.length > 0) await store.saveOutcomes(outcomes);
  return { sent, failed, skipped: outcomes.length - sent - failed };
}
