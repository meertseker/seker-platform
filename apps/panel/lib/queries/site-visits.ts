import { createServerSupabase } from "@/lib/supabase/server";

/** Çerezsiz anonim sayaç (site_visit_daily) özeti. Sayfa site'nin VisitBeacon'ı ile dolar; çerez onayından bağımsızdır. */

export const VISIT_SOURCE_LABELS: Record<string, string> = {
  google_ads: "Google Ads reklamı",
  arama: "Arama motoru (Google vb., ücretsiz)",
  sosyal: "Sosyal medya",
  kampanya: "Kampanya bağlantısı (UTM)",
  diger_site: "Başka siteden bağlantı",
  dogrudan: "Doğrudan (adres yazarak / yer imi / WhatsApp)",
};

export interface VisitRow {
  path: string;
  source: string;
  device: string;
  pageviews: number;
  entrances: number;
}

export interface VisitSummary {
  visits: number;
  pageViews: number;
  mobileShare: number | null; // 0–1, girişlere göre
  sources: { label: string; visits: number }[];
  pages: { path: string; views: number; entrances: number }[];
}

/** Saf toplama: testlenebilir olsun diye sorgudan ayrı. */
export function summarizeVisits(rows: VisitRow[]): VisitSummary {
  let visits = 0;
  let pageViews = 0;
  let mobile = 0;
  const bySource = new Map<string, number>();
  const byPath = new Map<string, { views: number; entrances: number }>();

  for (const row of rows) {
    visits += row.entrances;
    pageViews += row.pageviews;
    if (row.device === "mobil") mobile += row.entrances;
    if (row.entrances > 0) bySource.set(row.source, (bySource.get(row.source) ?? 0) + row.entrances);
    const page = byPath.get(row.path) ?? { views: 0, entrances: 0 };
    page.views += row.pageviews;
    page.entrances += row.entrances;
    byPath.set(row.path, page);
  }

  return {
    visits,
    pageViews,
    mobileShare: visits > 0 ? mobile / visits : null,
    sources: [...bySource.entries()]
      .map(([source, count]) => ({ label: VISIT_SOURCE_LABELS[source] ?? source, visits: count }))
      .sort((a, b) => b.visits - a.visits),
    pages: [...byPath.entries()]
      .map(([path, v]) => ({ path, ...v }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10),
  };
}

const PAGE_SIZE = 1000; // PostgREST max_rows

/** Tarih aralığı (YYYY-MM-DD, iki uç dahil; günler İstanbul saatine göre yazılır). RLS: yalnızca yönetici okur. */
export async function getSiteVisits(from: string, to: string): Promise<VisitSummary> {
  const db = await createServerSupabase();
  const rows: VisitRow[] = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await db
      .from("site_visit_daily")
      .select("path, source, device, pageviews, entrances")
      .gte("day", from)
      .lte("day", to)
      .order("day")
      .order("path")
      .order("source")
      .order("device")
      .range(start, start + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as VisitRow[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return summarizeVisits(rows);
}
