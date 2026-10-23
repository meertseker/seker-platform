// Kampanyalar ekranının verisi: aralıktaki harcama, reklam nesneleri, ücretli reklam velileri (K10),
// bu ayın harcaması, son 8 haftanın içerik kodları ve bu haftanın kapı durumu.
// Oturum (RLS, yalnız yönetici okur) istemcisiyle; satırlar sayfa sayfa okunur.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadStatus } from "@/lib/constants";
import { getAdSettings, type AdSettings } from "@/lib/ads/ad-settings";
import { getAdSetup, type AdSetup } from "@/lib/ads/ad-setup";
import { changeLine, latestByKey, type ChangeLogEntry } from "@/lib/ads/change-log";
import type { CampaignLead, CampaignObject, CampaignSpendRow } from "@/lib/ads/campaigns";
import { adsWriteEnabled, loadGateStatus, type GateStatus } from "@/lib/ads/writes";
import { mondayOf } from "@/lib/ads/weekly";
import { IN_CHUNK, chunk, fetchAllPages } from "@/lib/content/board";
import { addDaysToDateString, istanbulDateString } from "@/lib/lead-flow/business-hours";
import { loadChangeLog, loadProfileNames } from "@/lib/queries/change-log";
import { createServerSupabase } from "@/lib/supabase/server";

/** K10: maliyete giren veli (gclid, source=reklam ya da ad_platform dolu) PostgREST `or` biçiminde. */
const PAID_AD_FILTER = "ad_platform.in.(google,meta),source.eq.reklam,gclid.not.is.null";
/** "Koda bağla" listesi: bu hafta dahil son 8 hafta. */
const CODE_WEEKS = 8;

type SpendDbRow = {
  platform: "google" | "meta";
  level: "campaign" | "adset" | "ad";
  object_id: string;
  campaign_id: string;
  campaign_name: string;
  ad_name: string | null;
  cost_micros: number | string;
  platform_results: number | null;
  content_code: string | null;
};

type ObjectDbRow = {
  platform: "google" | "meta";
  level: "campaign" | "adset" | "ad";
  object_id: string;
  parent_id: string | null;
  campaign_id: string | null;
  name: string;
  status: string | null;
  daily_budget_micros: number | string | null;
  budget_resource: string | null;
  content_code: string | null;
  effective_status: string | null;
  review_feedback: string | null;
};

type LeadDbRow = {
  source: string;
  gclid: string | null;
  ad_platform: "google" | "meta" | null;
  utm_campaign: string | null;
  content_code: string | null;
  is_qualified: boolean | null;
  status: LeadStatus;
  converted_student_id: string | null;
  appointments: { outcome: string | null }[] | null;
};

export type ContentCodeOption = { code: string; topic: string };

export type CampaignPageData = {
  spend: CampaignSpendRow[];
  objects: CampaignObject[];
  leads: CampaignLead[];
  monthSpendKurus: { google: number; meta: number };
  settings: AdSettings;
  codes: ContentCodeOption[];
  gate: GateStatus;
  writeEnabled: boolean;
  today: string;
  /** Tek seferlik Meta kurulumu (Test/Büyütme kimlikleri); yapılmamışsa null. */
  setup: AdSetup | null;
  /** Kayıt anahtarı (nesne kimliği, reklam kimliği, içerik kodu, öneri kimliği) → hazır kayıt satırı (en yeni). */
  changes: Map<string, string>;
  /** Aralıktaki en yeni kayıt satırı (tablo altı); kayıt yoksa null. */
  latestLine: string | null;
  /** Test setindeki kodlu Meta reklamlarının içerik kodu → content_items.id ("Büyütmeye taşı" için). */
  contentIds: Record<string, string>;
};

/** YYYY-MM-DD gününün İstanbul'daki başlangıcı (UTC ISO). */
function istanbulDayStartIso(ymd: string): string {
  return new Date(`${ymd}T00:00:00+03:00`).toISOString();
}

async function loadSpend(supabase: SupabaseClient, from: string, to: string): Promise<CampaignSpendRow[]> {
  const rows = await fetchAllPages<SpendDbRow>((f, t) =>
    supabase
      .from("ad_spend_daily")
      .select("platform, level, object_id, campaign_id, campaign_name, ad_name, cost_micros, platform_results, content_code")
      .gte("date", from)
      .lte("date", to)
      .order("platform")
      .order("date")
      .order("level")
      .order("object_id")
      .range(f, t),
  );
  return rows.map((r) => ({
    platform: r.platform,
    level: r.level,
    objectId: r.object_id,
    campaignId: r.campaign_id,
    campaignName: r.campaign_name,
    adName: r.ad_name,
    costMicros: Number(r.cost_micros) || 0,
    platformResults: r.platform_results,
    contentCode: r.content_code,
  }));
}

async function loadObjects(supabase: SupabaseClient): Promise<CampaignObject[]> {
  const rows = await fetchAllPages<ObjectDbRow>((f, t) =>
    supabase
      .from("ad_objects")
      .select(
        "platform, level, object_id, parent_id, campaign_id, name, status, daily_budget_micros, budget_resource, content_code, effective_status, review_feedback",
      )
      .order("platform")
      .order("level")
      .order("object_id")
      .range(f, t),
  );
  return rows.map((r) => ({
    platform: r.platform,
    level: r.level,
    objectId: r.object_id,
    parentId: r.parent_id,
    campaignId: r.campaign_id,
    name: r.name,
    status: r.status,
    dailyBudgetMicros: r.daily_budget_micros === null ? null : Number(r.daily_budget_micros),
    budgetResource: r.budget_resource,
    contentCode: r.content_code,
    effectiveStatus: r.effective_status,
    reviewFeedback: r.review_feedback,
  }));
}

async function loadLeads(supabase: SupabaseClient, from: string, to: string): Promise<CampaignLead[]> {
  const rows = await fetchAllPages<LeadDbRow>((f, t) =>
    supabase
      .from("leads")
      .select("source, gclid, ad_platform, utm_campaign, content_code, is_qualified, status, converted_student_id, appointments(outcome)")
      .gte("created_at", istanbulDayStartIso(from))
      .lt("created_at", istanbulDayStartIso(addDaysToDateString(to, 1)))
      .or(PAID_AD_FILTER)
      .order("created_at")
      .order("id")
      .range(f, t),
  );
  return rows.map((r) => ({
    source: r.source,
    gclid: r.gclid,
    adPlatform: r.ad_platform,
    utmCampaign: r.utm_campaign,
    contentCode: r.content_code,
    isQualified: r.is_qualified === true,
    hasAppointment: (r.appointments ?? []).some((a) => a.outcome !== "iptal"),
    status: r.status,
    convertedStudentId: r.converted_student_id,
  }));
}

async function loadMonthSpend(supabase: SupabaseClient, today: string): Promise<{ google: number; meta: number }> {
  const rows = await fetchAllPages<{ platform: "google" | "meta"; cost_micros: number | string }>((f, t) =>
    supabase
      .from("ad_spend_daily")
      .select("platform, cost_micros")
      .gte("date", `${today.slice(0, 7)}-01`)
      .lte("date", today)
      .order("platform")
      .order("date")
      .order("level")
      .order("object_id")
      .range(f, t),
  );
  const micros = { google: 0, meta: 0 };
  for (const r of rows) micros[r.platform === "meta" ? "meta" : "google"] += Math.round(Number(r.cost_micros) || 0);
  return { google: Math.round(micros.google / 10_000), meta: Math.round(micros.meta / 10_000) };
}

async function loadCodes(supabase: SupabaseClient, today: string): Promise<ContentCodeOption[]> {
  const since = addDaysToDateString(mondayOf(today), -7 * (CODE_WEEKS - 1));
  const rows = await fetchAllPages<{ code: string; topic: string }>((f, t) =>
    supabase
      .from("content_items")
      .select("code, topic")
      .gte("week_start", since)
      .order("code", { ascending: false })
      .range(f, t),
  );
  return rows.map((r) => ({ code: r.code, topic: r.topic }));
}

/** Kişi adı yoksa Rapor kayıt defteriyle aynı yedek. */
function actorLabel(names: Map<string, string>, e: ChangeLogEntry): string {
  return names.get(e.actorId) ?? (e.source === "cron" ? "Sistem" : "Bilinmiyor");
}

/** Aralığın kayıtları → anahtar başına en yeni satır ve en yeni satır. Okunamazsa boş (ekran bozulmaz). */
async function loadChanges(
  supabase: SupabaseClient,
  from: string,
  to: string,
  now: Date,
): Promise<{ changes: Map<string, string>; latestLine: string | null }> {
  const entries = await loadChangeLog(supabase, istanbulDayStartIso(from), istanbulDayStartIso(addDaysToDateString(to, 1)));
  const names = await loadProfileNames(supabase, entries.map((e) => e.actorId));
  const changes = new Map<string, string>();
  for (const [key, e] of latestByKey(entries)) changes.set(key, changeLine(e, actorLabel(names, e), now));
  // loadChangeLog en yeni önce döner.
  const latestLine = entries[0] ? changeLine(entries[0], actorLabel(names, entries[0]), now) : null;
  return { changes, latestLine };
}

/** Test setindeki kodlu Meta reklamlarının içerik kimlikleri (kod → id). */
async function loadScaleContentIds(
  supabase: SupabaseClient,
  objects: CampaignObject[],
  setup: AdSetup | null,
): Promise<Record<string, string>> {
  if (!setup) return {};
  const codes = [
    ...new Set(
      objects
        .filter((o) => o.platform === "meta" && o.level === "ad" && o.parentId === setup.testAdsetId && o.contentCode)
        .map((o) => o.contentCode as string),
    ),
  ];
  const out: Record<string, string> = {};
  for (const part of chunk(codes, IN_CHUNK)) {
    const { data, error } = await supabase.from("content_items").select("id, code").in("code", part);
    if (error) throw new Error("İçerik kimlikleri okunamadı");
    for (const r of (data ?? []) as { id: string; code: string }[]) out[r.code] = r.id;
  }
  return out;
}

export async function loadCampaignPage(from: string, to: string): Promise<CampaignPageData> {
  const supabase = (await createServerSupabase()) as unknown as SupabaseClient;
  const now = new Date();
  const today = istanbulDateString(now);
  const settings = await getAdSettings(supabase);
  const [spend, objects, leads, monthSpendKurus, codes, gate, setup, changeData] = await Promise.all([
    loadSpend(supabase, from, to),
    loadObjects(supabase),
    loadLeads(supabase, from, to),
    loadMonthSpend(supabase, today),
    loadCodes(supabase, today).catch((e: unknown) => {
      console.error("[kampanyalar] içerik kodları okunamadı:", e instanceof Error ? e.message : "bilinmeyen");
      return [] as ContentCodeOption[];
    }),
    // Kapı yalnız uyarı içindir; asıl denetim değişiklik kapısında sunucuda yapılır.
    loadGateStatus(supabase, now, settings).catch((e: unknown) => {
      console.error("[kampanyalar] kapılar hesaplanamadı:", e instanceof Error ? e.message : "bilinmeyen");
      return { red: false, labels: [] } as GateStatus;
    }),
    getAdSetup(supabase).catch((e: unknown) => {
      console.error("[kampanyalar] reklam kurulumu okunamadı:", e instanceof Error ? e.message : "bilinmeyen");
      return null;
    }),
    // Kayıt satırları yalnız bilgi içindir; okunamazsa tablo satırsız açılır.
    loadChanges(supabase, from, to, now).catch((e: unknown) => {
      console.error("[kampanyalar] kayıt defteri okunamadı:", e instanceof Error ? e.message : "bilinmeyen");
      return { changes: new Map<string, string>(), latestLine: null };
    }),
  ]);
  const contentIds = await loadScaleContentIds(supabase, objects, setup).catch((e: unknown) => {
    console.error("[kampanyalar] içerik kimlikleri okunamadı:", e instanceof Error ? e.message : "bilinmeyen");
    return {} as Record<string, string>;
  });
  return {
    spend,
    objects,
    leads,
    monthSpendKurus,
    settings,
    codes,
    gate,
    writeEnabled: adsWriteEnabled(),
    today,
    setup,
    changes: changeData.changes,
    latestLine: changeData.latestLine,
    contentIds,
  };
}
