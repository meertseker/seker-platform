import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdObjectRow } from "./writes";

/** Sabah senkronunun yazdığı satır: değişiklik ağ geçidinin okuduğu alanlar + hiyerarşi ve içerik kodu. */
export interface AdObjectSyncRow extends AdObjectRow {
  parentId: string | null;
  campaignId: string | null;
  contentCode: string | null;
}

const CHUNK = 500;

/**
 * Elle bağlanmış içerik kodları (`ad_content_links`, K11): reklam kimliği → kod.
 * Elle bağ, reklam adından çıkarılan koddan her zaman önceliklidir.
 */
export async function loadContentLinks(
  db: SupabaseClient,
  platform: "google" | "meta",
  adIds: string[],
): Promise<Map<string, string>> {
  const links = new Map<string, string>();
  const ids = [...new Set(adIds.filter(Boolean))];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await db
      .from("ad_content_links")
      .select("ad_id, content_code")
      .eq("platform", platform)
      .in("ad_id", ids.slice(i, i + CHUNK));
    if (error) throw new Error(`ad_content_links okunamadı: ${error.message}`);
    for (const row of (data ?? []) as { ad_id: string; content_code: string }[]) {
      links.set(row.ad_id, row.content_code);
    }
  }
  return links;
}

/**
 * Nesneleri `ad_objects`'e idempotent yazar. Reklam satırlarında elle bağlı kod varsa addan çıkarılanın yerine geçer.
 * Bağ okunamazsa yazım yapılmaz (adın kodu elle bağı sessizce ezmesin).
 */
export async function upsertAdObjects(db: SupabaseClient, rows: AdObjectSyncRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const links = new Map<string, string>();
  for (const platform of ["google", "meta"] as const) {
    const ids = rows.filter((r) => r.platform === platform && r.level === "ad").map((r) => r.objectId);
    if (ids.length === 0) continue;
    for (const [id, code] of await loadContentLinks(db, platform, ids)) links.set(`${platform}|${id}`, code);
  }
  const syncedAt = new Date().toISOString();
  const payload = rows.map((row) => ({
    platform: row.platform,
    level: row.level,
    object_id: row.objectId,
    parent_id: row.parentId,
    campaign_id: row.campaignId,
    name: row.name,
    status: row.status,
    daily_budget_micros: row.dailyBudgetMicros,
    budget_resource: row.budgetResource,
    content_code:
      row.level === "ad" ? (links.get(`${row.platform}|${row.objectId}`) ?? row.contentCode) : row.contentCode,
    synced_at: syncedAt,
  }));
  for (let i = 0; i < payload.length; i += CHUNK) {
    const { error } = await db
      .from("ad_objects")
      .upsert(payload.slice(i, i + CHUNK), { onConflict: "platform,level,object_id" });
    if (error) throw new Error(`ad_objects yazılamadı: ${error.message}`);
  }
  return rows.length;
}
