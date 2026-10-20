// AI konu önerisinin veri girdisi (sunucu; service_role istemcisiyle okunur).
// Yalnız sayılar, kelimeler ve konular seçilir: veli adı, telefonu, notu ve harcama tutarı hiçbir sorguda yok.
import type { SupabaseClient } from "@supabase/supabase-js";
import { AD_SETTING_KEYS, parseAdSettings } from "@/lib/ads/ad-settings";
import { addDaysToDateString } from "@/lib/lead-flow/business-hours";
import type { WeeklySlot } from "@/lib/content/slots";
import { SCHOOL_INFO_MAX, type PromptData } from "./gorev-girdi";

/** app_settings anahtarı: okulun tanıtım yazıları, artıları, broşür metinleri. Değer: { metin: string }. */
export const SCHOOL_INFO_KEY = "okul_bilgileri";

/** Geriye bakılan süre: 12 hafta. */
const LOOKBACK_DAYS = 84;
const RANDEVU_PLUS = new Set(["randevu", "gorusme_yapildi", "teklif", "kazanildi"]);
const MAX_ROWS = 5000;
const MAX_CAMPAIGNS = 15;

export function parseSchoolInfo(value: unknown): string {
  const metin = value && typeof value === "object" && !Array.isArray(value) ? (value as { metin?: unknown }).metin : null;
  return typeof metin === "string" ? metin.slice(0, SCHOOL_INFO_MAX) : "";
}

type Db = Pick<SupabaseClient, "from">;

export async function loadPromptData(db: Db, weekStart: string, slots: WeeklySlot[]): Promise<PromptData> {
  const since = addDaysToDateString(weekStart, -LOOKBACK_DAYS);
  const sinceIso = `${since}T00:00:00+03:00`;

  const [settingsRes, topicsRes, codeLeadsRes, termLeadsRes, spendRes] = await Promise.all([
    db.from("app_settings").select("key, value").in("key", [SCHOOL_INFO_KEY, ...AD_SETTING_KEYS]),
    db.from("content_items").select("code, topic, week_start").gte("week_start", since).order("week_start", { ascending: false }).limit(200),
    db.from("leads").select("content_code, status").not("content_code", "is", null).gte("created_at", sinceIso).limit(MAX_ROWS),
    db.from("leads").select("utm_term, status").not("utm_term", "is", null).gte("created_at", sinceIso).limit(MAX_ROWS),
    db.from("ad_spend_daily").select("campaign_name, platform, clicks, impressions").gte("date", since).limit(MAX_ROWS),
  ]);
  for (const r of [settingsRes, topicsRes, codeLeadsRes, termLeadsRes, spendRes]) {
    if (r.error) throw new Error(`veri okunamadı: ${r.error.message}`);
  }

  const settingRows = (settingsRes.data ?? []) as { key: string; value: unknown }[];
  const schoolInfo = parseSchoolInfo(settingRows.find((r) => r.key === SCHOOL_INFO_KEY)?.value);
  const banned = parseAdSettings(settingRows).banned;

  const topicRows = (topicsRes.data ?? []) as { code: string; topic: string; week_start: string }[];
  const topicByCode = new Map(topicRows.map((t) => [t.code, t.topic]));
  // Hedef haftada açılmış görevler de girer: aynı hafta ikinci kez önerilmesin.
  const recentTopics = topicRows.map((t) => ({ weekStart: t.week_start, code: t.code, topic: t.topic }));

  const byCode = new Map<string, { total: number; randevu: number; kayit: number; kayip: number }>();
  for (const l of (codeLeadsRes.data ?? []) as { content_code: string; status: string }[]) {
    const c = byCode.get(l.content_code) ?? { total: 0, randevu: 0, kayit: 0, kayip: 0 };
    c.total++;
    if (RANDEVU_PLUS.has(l.status)) c.randevu++;
    if (l.status === "kazanildi") c.kayit++;
    if (l.status === "kaybedildi") c.kayip++;
    byCode.set(l.content_code, c);
  }
  const contentLeads = [...byCode.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([code, c]) => ({ code, topic: topicByCode.get(code) ?? null, ...c }));

  const byTerm = new Map<string, { total: number; randevu: number; kayit: number }>();
  for (const l of (termLeadsRes.data ?? []) as { utm_term: string; status: string }[]) {
    const term = l.utm_term.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();
    if (!term) continue;
    const k = byTerm.get(term) ?? { total: 0, randevu: 0, kayit: 0 };
    k.total++;
    if (RANDEVU_PLUS.has(l.status)) k.randevu++;
    if (l.status === "kazanildi") k.kayit++;
    byTerm.set(term, k);
  }
  const keywords = [...byTerm.entries()]
    .sort((a, b) => b[1].randevu - a[1].randevu || b[1].total - a[1].total)
    .map(([term, k]) => ({ term, ...k }));

  const byCampaign = new Map<string, { name: string; platform: string; clicks: number; impressions: number }>();
  for (const s of (spendRes.data ?? []) as { campaign_name: string; platform: string; clicks: number; impressions: number }[]) {
    const key = `${s.platform}|${s.campaign_name}`;
    const c = byCampaign.get(key) ?? { name: s.campaign_name, platform: s.platform, clicks: 0, impressions: 0 };
    c.clicks += Number(s.clicks) || 0;
    c.impressions += Number(s.impressions) || 0;
    byCampaign.set(key, c);
  }
  const campaigns = [...byCampaign.values()].sort((a, b) => b.clicks - a.clicks).slice(0, MAX_CAMPAIGNS);

  return { weekStart, schoolInfo, banned, slots, recentTopics, contentLeads, keywords, campaigns };
}
