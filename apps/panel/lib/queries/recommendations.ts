// Öneri kurallarının girdisi ve haftanın kayıtlı önerileri (okuma).
// İçerik sayıları loadContentPerf'ten; reklam nesneleri ad_objects.content_code'dan; yorgunluk için tıklama oranı
// ve sıklık Meta reklam satırlarından (ad_spend_daily); organik 72 saat compare72h ile.
import type { SupabaseClient } from "@supabase/supabase-js";
import { IN_CHUNK, chunk, fetchAllPages, loadContentPerf } from "@/lib/content/board";
import { compare72h, type CompareInput } from "@/lib/content/organic";
import { addDaysToDateString, istanbulDateString } from "@/lib/lead-flow/business-hours";
import { readWeekRecommendations, type RecAdObject, type RecInput, type RecommendationRow } from "@/lib/ads/recommendations";
import { weekRange } from "@/lib/ads/weekly";

const DAY_MS = 24 * 60 * 60 * 1000;
const RULE_STAGES = ["organik", "test", "kazanan"];

type ItemRow = {
  id: string;
  code: string;
  kind: string;
  platform: string;
  stage: string;
  stage_changed_at: string;
  week_start: string;
  ig_media_id: string | null;
  ig_published_at: string | null;
};

type ObjectRow = {
  platform: "google" | "meta";
  level: string;
  object_id: string;
  name: string;
  status: string | null;
  daily_budget_micros: number | string | null;
  budget_resource: string | null;
  content_code: string;
};

type SpendRow = {
  content_code: string;
  date: string;
  cost_micros: number | string | null;
  clicks: number | null;
  impressions: number | null;
  reach: number | null;
};

type LeadRow = { content_code: string; created_at: string };

/** Günlük satırlar: tarih "YYYY-MM-DD" (İstanbul günü). */
export type DailySpend = { date: string; costMicros: number; clicks: number; impressions: number; reach: number | null };

/** Tıklama oranı: tıklama / gösterim; gösterim yoksa null. */
function ctr(rows: DailySpend[]): number | null {
  const imp = rows.reduce((a, r) => a + r.impressions, 0);
  return imp > 0 ? rows.reduce((a, r) => a + r.clicks, 0) / imp : null;
}

/**
 * Yorgunluk sayıları (saf). İlk hafta: ilk gösterim gününden 7 gün; son hafta: toplantı haftası.
 * İlk hafta toplantı haftasıyla çakışıyorsa (iki haftalık veri yok) ilk hafta null.
 * Sıklık günlük satırlardan birleştirilemez (tekil kişi toplanmaz); haftalık sıklık
 * gösterim / en yüksek günlük erişim ile yaklaşık hesaplanır (üst sınır).
 */
export function fatigueNumbers(
  rows: DailySpend[],
  qualifiedDays: string[],
  weekStart: string,
): Pick<RecInput, "firstWeekCtr" | "lastWeekCtr" | "frequency" | "costPerQualifiedTrend"> {
  const weekEnd = addDaysToDateString(weekStart, 7);
  const prevStart = addDaysToDateString(weekStart, -7);
  const inRange = (d: string, from: string, to: string) => d >= from && d < to;
  const last = rows.filter((r) => inRange(r.date, weekStart, weekEnd));
  const shown = rows.filter((r) => r.impressions > 0).map((r) => r.date).sort();

  let firstWeekCtr: number | null = null;
  if (shown.length > 0) {
    const firstEnd = addDaysToDateString(shown[0], 7);
    if (firstEnd <= weekStart) firstWeekCtr = ctr(rows.filter((r) => inRange(r.date, shown[0], firstEnd)));
  }

  const lastImp = last.reduce((a, r) => a + r.impressions, 0);
  const maxReach = Math.max(0, ...last.map((r) => r.reach ?? 0));
  const frequency = lastImp > 0 && maxReach > 0 ? lastImp / maxReach : null;

  const cpq = (from: string, to: string): number | null => {
    const spend = rows.filter((r) => inRange(r.date, from, to)).reduce((a, r) => a + r.costMicros, 0);
    if (spend <= 0) return null;
    const q = qualifiedDays.filter((d) => inRange(d, from, to)).length;
    return q > 0 ? spend / q : Number.POSITIVE_INFINITY;
  };
  const now = cpq(weekStart, weekEnd);
  const prev = cpq(prevStart, weekStart);
  const costPerQualifiedTrend =
    now === null || prev === null ? null : now === prev ? "flat" : now > prev ? "up" : "down";

  return { firstWeekCtr, lastWeekCtr: ctr(last), frequency, costPerQualifiedTrend };
}

/** Aynı haftanın organik Reels'leri arasında öndekinin karşılaştırıldığı ikinci Reels (izlenme, sonra kayıt+paylaşım). */
function runnerUpOf(inputs: CompareInput[], leadCode: string): string | null {
  const key = (i: CompareInput) => [i.views, i.saves + i.shares] as const;
  const top = inputs.find((i) => i.code === leadCode);
  if (!top) return null;
  const rest = inputs
    .filter((i) => key(i)[0] !== key(top)[0] || key(i)[1] !== key(top)[1])
    .sort((a, b) => key(b)[0] - key(a)[0] || key(b)[1] - key(a)[1]);
  return rest[0]?.code ?? null;
}

async function loadOrganic(
  supabase: SupabaseClient,
  items: ItemRow[],
  now: Date,
): Promise<Map<string, NonNullable<RecInput["organic72h"]>>> {
  const out = new Map<string, NonNullable<RecInput["organic72h"]>>();
  const organik = items.filter((i) => i.stage === "organik" && i.kind === "reels" && i.ig_media_id && i.ig_published_at);
  if (organik.length === 0) return out;

  const latest = new Map<string, { views: number; saved: number; shares: number }>();
  for (const part of chunk(organik.map((i) => i.id), IN_CHUNK)) {
    const { data, error } = await supabase
      .from("content_organic_stats")
      .select("content_id, day, views, saved, shares")
      .in("content_id", part)
      .order("day", { ascending: false });
    if (error) throw new Error(`content_organic_stats: ${error.code ?? "okunamadı"}`);
    for (const r of (data ?? []) as { content_id: string; views: number | null; saved: number | null; shares: number | null }[]) {
      if (!latest.has(r.content_id)) latest.set(r.content_id, { views: r.views ?? 0, saved: r.saved ?? 0, shares: r.shares ?? 0 });
    }
  }

  const byWeek = new Map<string, ItemRow[]>();
  for (const i of organik) byWeek.set(i.week_start, [...(byWeek.get(i.week_start) ?? []), i]);
  for (const group of byWeek.values()) {
    const inputs: CompareInput[] = group.flatMap((i) => {
      const s = latest.get(i.id);
      return s ? [{ code: i.code, publishedAt: i.ig_published_at as string, views: s.views, saves: s.saved, shares: s.shares }] : [];
    });
    const done = inputs.filter((i) => now.getTime() - Date.parse(i.publishedAt) >= 72 * 60 * 60 * 1000);
    for (const r of compare72h(inputs, now)) {
      if (!r.done) continue;
      out.set(r.code, { lead: r.lead, ratio: r.ratio, versus: r.lead === "onde" ? runnerUpOf(done, r.code) : null });
    }
  }
  return out;
}

/**
 * Meta'da bütçe reklam setinde ya da kampanyada durur (reklam satırı üstün bütçesini taşır). Bütçe önerisi
 * sahibine uygulanıp onun adıyla yazılsın diye sahip satırları (object_id = budget_resource) eklenir.
 */
async function attachMetaBudgetOwners(supabase: SupabaseClient, rows: RecAdObject[]): Promise<void> {
  const resources = [...new Set(rows.map((r) => r.budgetResource).filter((r): r is string => !!r))];
  const owners = new Map<string, NonNullable<RecAdObject["budgetOwner"]>>();
  for (const part of chunk(resources, IN_CHUNK)) {
    const { data, error } = await supabase
      .from("ad_objects")
      .select("level, object_id, name")
      .eq("platform", "meta")
      .in("level", ["campaign", "adset"])
      .in("object_id", part);
    if (error) throw new Error(`ad_objects: ${error.code ?? "okunamadı"}`);
    for (const o of (data ?? []) as { level: "campaign" | "adset"; object_id: string; name: string }[]) {
      // Aynı kimlik iki düzeyde olamaz; olursa reklam seti (bütçeye daha yakın) kazanır.
      if (!owners.has(o.object_id) || o.level === "adset") owners.set(o.object_id, { level: o.level, objectId: o.object_id, name: o.name });
    }
  }
  for (const r of rows) r.budgetOwner = r.budgetResource ? (owners.get(r.budgetResource) ?? null) : null;
}

/**
 * Organik, test ve büyütme aşamasındaki içeriklerin kural girdileri. `weekStart` toplantı haftası
 * (son hafta tıklama oranı, sıklık ve maliyet yönü bu haftadan).
 */
export async function loadRecInputs(supabase: SupabaseClient, weekStart: string, now: Date): Promise<RecInput[]> {
  const { data, error } = await supabase
    .from("content_items")
    .select("id, code, kind, platform, stage, stage_changed_at, week_start, ig_media_id, ig_published_at")
    .in("stage", RULE_STAGES)
    .order("code");
  if (error) throw new Error(`content_items: ${error.code ?? "okunamadı"}`);
  const items = (data ?? []) as ItemRow[];
  if (items.length === 0) return [];
  const codes = items.map((i) => i.code);

  const objects = new Map<string, RecAdObject[]>();
  const daily = new Map<string, DailySpend[]>();
  const qualifiedDays = new Map<string, string[]>();
  const since = addDaysToDateString(weekStart, -7);

  for (const part of chunk(codes, IN_CHUNK)) {
    const [objRows, spendRows, leadRows] = await Promise.all([
      fetchAllPages<ObjectRow>((from, to) =>
        supabase
          .from("ad_objects")
          .select("platform, level, object_id, name, status, daily_budget_micros, budget_resource, content_code")
          .in("content_code", part)
          .order("platform")
          .order("level")
          .order("object_id")
          .range(from, to),
      ),
      fetchAllPages<SpendRow>((from, to) =>
        supabase
          .from("ad_spend_daily")
          .select("content_code, date, cost_micros, clicks, impressions, reach")
          .eq("platform", "meta")
          .eq("level", "ad")
          .in("content_code", part)
          .order("date")
          .order("object_id")
          .range(from, to),
      ),
      fetchAllPages<LeadRow>((from, to) =>
        supabase
          .from("leads")
          .select("content_code, created_at")
          .in("content_code", part)
          .eq("is_qualified", true)
          .gte("created_at", weekRange(since).from)
          .order("id")
          .range(from, to),
      ),
    ]);
    for (const o of objRows) {
      const key = `${o.platform}|${o.content_code}`;
      objects.set(key, [
        ...(objects.get(key) ?? []),
        {
          objectId: o.object_id,
          level: o.level,
          name: o.name,
          status: o.status,
          dailyBudgetMicros: o.daily_budget_micros === null ? null : Number(o.daily_budget_micros),
          budgetResource: o.budget_resource,
        },
      ]);
    }
    for (const r of spendRows) {
      daily.set(r.content_code, [
        ...(daily.get(r.content_code) ?? []),
        {
          date: r.date,
          costMicros: Number(r.cost_micros ?? 0),
          clicks: Number(r.clicks ?? 0),
          impressions: Number(r.impressions ?? 0),
          reach: r.reach === null ? null : Number(r.reach),
        },
      ]);
    }
    for (const l of leadRows) {
      qualifiedDays.set(l.content_code, [...(qualifiedDays.get(l.content_code) ?? []), istanbulDateString(new Date(l.created_at))]);
    }
  }

  await attachMetaBudgetOwners(supabase, [...objects.entries()].filter(([k]) => k.startsWith("meta|")).flatMap(([, v]) => v));

  const [perf, organic] = await Promise.all([loadContentPerf(supabase, codes), loadOrganic(supabase, items, now)]);

  return items.map((i): RecInput => {
    const platform = i.platform === "google" ? "google" : "meta";
    const running = i.stage === "test" || i.stage === "kazanan";
    return {
      contentId: i.id,
      contentCode: i.code,
      platform,
      stage: i.stage,
      perf: perf.get(i.code) ?? { spendKurus: 0, clicks: 0, platformResults: 0, leads: 0, qualified: 0, appointments: 0 },
      weeksInTest: running ? Math.max(0, Math.floor((now.getTime() - Date.parse(i.stage_changed_at)) / (7 * DAY_MS))) : 0,
      // Meta'da kod reklam satırına bağlıdır; Google'da kampanyaya.
      adObjects: (objects.get(`${platform}|${i.code}`) ?? []).filter((o) => (platform === "meta" ? o.level === "ad" : o.level === "campaign")),
      ...fatigueNumbers(daily.get(i.code) ?? [], qualifiedDays.get(i.code) ?? [], weekStart),
      organic72h: organic.get(i.code) ?? null,
    };
  });
}

/** Haftanın kayıtlı önerileri (oturum istemcisiyle; RLS yalnız yöneticiye gösterir). */
export async function loadWeekRecommendations(supabase: SupabaseClient, weekStart: string): Promise<RecommendationRow[]> {
  return readWeekRecommendations(supabase, weekStart);
}
