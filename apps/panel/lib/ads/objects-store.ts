import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdObjectRow } from "./writes";

/** Sabah senkronunun yazdığı satır: değişiklik ağ geçidinin okuduğu alanlar + hiyerarşi ve içerik kodu. */
export interface AdObjectSyncRow extends AdObjectRow {
  parentId: string | null;
  campaignId: string | null;
  contentCode: string | null;
  /** Meta reklamının inceleme dahil gerçek durumu; yalnız reklam satırlarında dolu. */
  effectiveStatus?: string | null;
  /** Meta ret açıklaması (`reviewFeedbackText`); yalnız reklam satırlarında dolu. */
  reviewFeedback?: string | null;
}

const CHUNK = 500;

/** İnceleme kolonları her satırda gönderilir (toplu upsert'te kolon kümesi aynı kalsın); reklam dışında null. */
function reviewColumns(row: AdObjectSyncRow): { effective_status: string | null; review_feedback: string | null } {
  return row.level === "ad"
    ? { effective_status: row.effectiveStatus ?? null, review_feedback: row.reviewFeedback ?? null }
    : { effective_status: null, review_feedback: null };
}
/** `.in()` adresi URL'ye girer; uzun adres isteği düşürmesin diye bağ sorgusu 100'lük parçalarla gider. */
const LINK_CHUNK = 100;

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
  for (let i = 0; i < ids.length; i += LINK_CHUNK) {
    const { data, error } = await db
      .from("ad_content_links")
      .select("ad_id, content_code")
      .eq("platform", platform)
      .in("ad_id", ids.slice(i, i + LINK_CHUNK));
    if (error) throw new Error(`ad_content_links okunamadı: ${error.message}`);
    for (const row of (data ?? []) as { ad_id: string; content_code: string }[]) {
      links.set(row.ad_id, row.content_code);
    }
  }
  return links;
}

/**
 * Bir platformun TAM nesne görüntüsünü `ad_objects`'e idempotent yazar (çağıran, tüm sayfaların başarıyla
 * çekildiğinden emin olmalı; çekim patlarsa bu fonksiyon hiç çağrılmaz). Yazım bitince o platformun bu koşuda
 * görülmeyen (synced_at daha eski) satırları silinir; silinmiş nesne üzerinde işlem yapılamasın.
 * Reklam satırlarında elle bağlı kod varsa addan çıkarılanın yerine geçer.
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
    ...reviewColumns(row),
    synced_at: syncedAt,
  }));
  for (let i = 0; i < payload.length; i += CHUNK) {
    const { error } = await db
      .from("ad_objects")
      .upsert(payload.slice(i, i + CHUNK), { onConflict: "platform,level,object_id" });
    if (error) throw new Error(`ad_objects yazılamadı: ${error.message}`);
  }
  // Temizlik (platform, seviye) bazlıdır ve yalnız bu koşuda en az bir satır gelen seviyeler için yapılır:
  // bir uç boş dönerse o seviyenin mevcut satırları silinmez.
  const seen = new Set(rows.map((r) => `${r.platform}|${r.level}`));
  for (const key of seen) {
    const [platform, level] = key.split("|");
    const { error } = await db
      .from("ad_objects")
      .delete()
      .eq("platform", platform)
      .eq("level", level)
      .lt("synced_at", syncedAt);
    if (error) throw new Error(`ad_objects temizlenemedi: ${error.message}`);
  }
  return rows.length;
}

/**
 * Panelin az önce Meta'da kurduğu nesneleri (kampanya, set, reklam) `ad_objects`'e yazar. Sabah senkronundan farkı:
 * temizlik (silme) YOK — liste tam görüntü değil; ertesi sabah senkron aynı satırları Meta'dan görüp günceller.
 * Reklam satırında içerik kodu varsa `ad_content_links`'e de (aynı kod, `linked_by` = aktör) yazılır; böylece
 * reklam adı sonradan değişse de kod elle bağ gibi korunur.
 */
export async function insertCreatedAdObjects(
  db: SupabaseClient,
  rows: AdObjectSyncRow[],
  actorId: string | null,
): Promise<void> {
  if (rows.length === 0) return;
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
    content_code: row.contentCode,
    ...reviewColumns(row),
    synced_at: syncedAt,
  }));
  const { error } = await db.from("ad_objects").upsert(payload, { onConflict: "platform,level,object_id" });
  if (error) throw new Error(`ad_objects yazılamadı: ${error.message}`);

  const links = rows
    .filter((row) => row.level === "ad" && row.contentCode)
    .map((row) => ({ platform: row.platform, ad_id: row.objectId, content_code: row.contentCode as string, linked_by: actorId }));
  if (links.length === 0) return;
  const { error: linkError } = await db.from("ad_content_links").upsert(links, { onConflict: "platform,ad_id" });
  if (linkError) throw new Error(`ad_content_links yazılamadı: ${linkError.message}`);
}
