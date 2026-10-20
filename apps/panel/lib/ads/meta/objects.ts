import { parseContentCode } from "../content-code";
import type { AdObjectSyncRow } from "../objects-store";
import type { FetchFn } from "../types";
import { appSecretProof, META_GRAPH_API_VERSION, META_GRAPH_BASE, type MetaConfig } from "./config";
import { headers, MetaApiError, nextUrl, toApiError } from "./insights";

const OBJECTS_TIMEOUT_MS = 30_000;
/** Sonsuz sayfalama döngüsüne karşı üst sınır (insights ile aynı). */
const MAX_PAGES = 20;

/**
 * Meta `daily_budget` hesabın en küçük para biriminde gelir; TRY için kuruş (×100) — TEYİTSİZ, ilk gerçek hesapta
 * Reklam Yöneticisi ile karşılaştırılacak (bkz. 2026-10-19-02-meta-api-notlari.md). Panel birimi TL × 1.000.000
 * olduğundan kuruş × 10.000.
 */
const MICROS_PER_MINOR_UNIT = 10_000;

interface RawObject {
  id?: string;
  name?: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string;
  campaign_id?: string;
  adset_id?: string;
}

function firstUrl(cfg: MetaConfig, edge: string, fields: string): URL {
  const url = new URL(`${META_GRAPH_BASE}/${META_GRAPH_API_VERSION}/${cfg.adAccountId}/${edge}`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("limit", "500");
  url.searchParams.set("appsecret_proof", appSecretProof(cfg.accessToken, cfg.appSecret));
  return url;
}

async function fetchAll(cfg: MetaConfig, edge: string, fields: string, fetchFn: FetchFn): Promise<RawObject[]> {
  const out: RawObject[] = [];
  let url: URL | null = firstUrl(cfg, edge, fields);
  for (let page = 0; url && page < MAX_PAGES; page++) {
    const response: Response = await fetchFn(url.toString(), {
      method: "GET",
      headers: headers(cfg),
      signal: AbortSignal.timeout(OBJECTS_TIMEOUT_MS),
    });
    if (!response.ok) throw await toApiError(response, cfg, `Meta ${edge} isteği başarısız`);
    const body = (await response.json()) as { data?: RawObject[]; paging?: { next?: string } };
    if (!Array.isArray(body.data)) throw new MetaApiError("Meta yanıtı beklenmeyen biçimde", 502);
    out.push(...body.data);
    url = body.paging?.next ? nextUrl(body.paging.next, cfg) : null;
  }
  return out;
}

/** Bütçe yoksa (ya da sayı değilse) null; bütçe bu nesnede değilse satırında null kalır. */
function budgetMicros(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") return null;
  const minor = Number(raw);
  return Number.isFinite(minor) ? minor * MICROS_PER_MINOR_UNIT : null;
}

/**
 * Kampanya, reklam kümesi ve reklam durumları ile bütçeleri. `status` platformun ham ayar durumudur
 * (ACTIVE/PAUSED); değişiklik ağ geçidi bunu okur. Bütçe kampanyada ya da kümede durur; `budgetResource`
 * bütçeyi taşıyan nesnenin kimliğidir. İçerik kodu reklam adından çıkarılır; elle bağ yazım katmanında
 * (`upsertAdObjects`) adın üstüne geçer.
 */
export async function fetchMetaObjects(cfg: MetaConfig, fetchFn: FetchFn = fetch): Promise<AdObjectSyncRow[]> {
  const campaigns = await fetchAll(cfg, "campaigns", "id,name,status,effective_status,daily_budget", fetchFn);
  const adsets = await fetchAll(cfg, "adsets", "id,name,campaign_id,status,daily_budget", fetchFn);
  const ads = await fetchAll(cfg, "ads", "id,name,adset_id,campaign_id,status,effective_status", fetchFn);

  // Bütçe kampanyada ya da kümede durur; ağ geçidi eski değeri istenen satırdan okuyup bütçe kaynağına yazar.
  // Bu yüzden alt satırlar (küme, reklam) bütçesi olmayan üstün bütçesini ve kaynağını devralır.
  type Budget = { micros: number; resource: string };
  const campaignBudget = new Map<string, Budget>();
  const adsetBudget = new Map<string, Budget>();

  const rows: AdObjectSyncRow[] = [];
  for (const c of campaigns) {
    if (!c.id) continue;
    const micros = budgetMicros(c.daily_budget);
    if (micros !== null) campaignBudget.set(String(c.id), { micros, resource: String(c.id) });
    rows.push({
      platform: "meta",
      level: "campaign",
      objectId: String(c.id),
      parentId: null,
      campaignId: String(c.id),
      name: c.name ?? "",
      status: c.status ?? null,
      dailyBudgetMicros: micros,
      budgetResource: micros === null ? null : String(c.id),
      contentCode: null,
    });
  }
  for (const s of adsets) {
    if (!s.id) continue;
    const own = budgetMicros(s.daily_budget);
    const budget: Budget | null =
      own !== null
        ? { micros: own, resource: String(s.id) }
        : ((s.campaign_id ? campaignBudget.get(String(s.campaign_id)) : undefined) ?? null);
    if (budget) adsetBudget.set(String(s.id), budget);
    rows.push({
      platform: "meta",
      level: "adset",
      objectId: String(s.id),
      parentId: s.campaign_id ? String(s.campaign_id) : null,
      campaignId: s.campaign_id ? String(s.campaign_id) : null,
      name: s.name ?? "",
      status: s.status ?? null,
      dailyBudgetMicros: budget?.micros ?? null,
      budgetResource: budget?.resource ?? null,
      contentCode: null,
    });
  }
  for (const a of ads) {
    if (!a.id) continue;
    const budget = (a.adset_id ? adsetBudget.get(String(a.adset_id)) : undefined) ?? null;
    rows.push({
      platform: "meta",
      level: "ad",
      objectId: String(a.id),
      parentId: a.adset_id ? String(a.adset_id) : null,
      campaignId: a.campaign_id ? String(a.campaign_id) : null,
      name: a.name ?? "",
      status: a.status ?? null,
      dailyBudgetMicros: budget?.micros ?? null,
      budgetResource: budget?.resource ?? null,
      contentCode: parseContentCode(a.name),
    });
  }
  return rows;
}
