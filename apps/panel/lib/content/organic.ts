import type { SupabaseClient } from "@supabase/supabase-js";
import type { FetchFn } from "@/lib/ads/types";
import type { MetaConfig } from "@/lib/ads/meta/config";
import { fetchReelInsights, resolveMediaId } from "@/lib/ads/meta/instagram";
import { istanbulDateString } from "@/lib/cron-rules";
import type { BoardItem, OrganicLead } from "./board";

const HOUR_MS = 60 * 60 * 1000;
const ORGANIC_HOURS = 72;

// === Senkron ===

type SyncItem = { id: string; ig_permalink: string | null; ig_media_id: string | null };

/**
 * Organik aşamadaki, gönderi bağlantısı olan Reels'lerin bugünkü sayılarını `content_organic_stats`'a yazar
 * (içerik başına gün başına tek satır). `ig_media_id` yoksa bağlantıdan çözülüp içeriğe yazılır.
 * `db` yazma için gizli anahtarlı istemcidir. Yapılandırma yoksa istek gitmez, 0 döner.
 * Bir gönderi patlarsa öbürleri yine yazılır; sonda hata fırlatılır ki cron bildirsin.
 */
export async function syncOrganicStats(deps: { cfg: MetaConfig; db: SupabaseClient; fetchFn?: FetchFn; now?: Date }): Promise<number> {
  const { cfg, db } = deps;
  if (!cfg.instagramUserId) return 0;
  const day = istanbulDateString(deps.now ?? new Date());

  const { data, error } = await db
    .from("content_items")
    .select("id, ig_permalink, ig_media_id")
    .eq("stage", "organik")
    .not("ig_permalink", "is", null);
  if (error) throw new Error(`content_items: ${error.code ?? "okunamadı"}`);

  let written = 0;
  const failures: string[] = [];
  for (const item of (data ?? []) as SyncItem[]) {
    try {
      let mediaId = item.ig_media_id;
      if (!mediaId) {
        mediaId = await resolveMediaId(cfg, item.ig_permalink ?? "", deps.fetchFn);
        if (!mediaId) continue; // henüz listede yok ya da bağlantı yanlış; yarın yeniden denenir
        const { error: upErr } = await db.from("content_items").update({ ig_media_id: mediaId }).eq("id", item.id);
        if (upErr) throw new Error("medya kimliği yazılamadı");
      }
      const r = await fetchReelInsights(cfg, mediaId, deps.fetchFn);
      const { error: writeErr } = await db.from("content_organic_stats").upsert(
        {
          content_id: item.id,
          day,
          views: r.views,
          reach: r.reach,
          saved: r.saved,
          shares: r.shares,
          total_interactions: r.totalInteractions,
          avg_watch_ms: r.avgWatchMs,
          fetched_at: (deps.now ?? new Date()).toISOString(),
        },
        { onConflict: "content_id,day" },
      );
      if (writeErr) throw new Error("sayılar yazılamadı");
      written++;
    } catch (e) {
      failures.push((e as Error).message);
    }
  }
  if (failures.length > 0) throw new Error(`${failures.length} gönderi okunamadı: ${failures[0]}`.slice(0, 240));
  return written;
}

// === 72 saat karşılaştırması ===

export interface CompareInput {
  code: string;
  publishedAt: string;
  views: number;
  saves: number;
  shares: number;
}
export interface CompareResult {
  code: string;
  done: boolean;
  lead: "onde" | "geride" | "esit" | null;
  /** Önde olanın izlenmesinin, ondan sonra gelene oranı (öndekinde dolu, öbürlerinde null). */
  ratio: number | null;
}

/**
 * Aynı haftanın Reels'leri: 72 saati dolanlar `views`, eşitlikte `saves+shares` ile sıralanır.
 * En yüksek `onde`, geri kalanlar `geride`; en yüksekle tam eşit olanlar `esit`.
 * Karşılaştıracak başka dolmuş Reels yoksa `lead` null (tek başına kıyas olmaz).
 */
export function compare72h(items: CompareInput[], now: Date): CompareResult[] {
  const done = items.filter((i) => now.getTime() - new Date(i.publishedAt).getTime() >= ORGANIC_HOURS * HOUR_MS);
  const key = (i: CompareInput) => [i.views, i.saves + i.shares] as const;
  const sorted = [...done].sort((a, b) => key(b)[0] - key(a)[0] || key(b)[1] - key(a)[1]);
  const top = sorted[0];
  const tied = (i: CompareInput) => top && key(i)[0] === key(top)[0] && key(i)[1] === key(top)[1];
  const topCount = sorted.filter(tied).length;
  const runnerUp = sorted.find((i) => !tied(i));

  return items.map((i): CompareResult => {
    if (!done.includes(i)) return { code: i.code, done: false, lead: null, ratio: null };
    if (sorted.length < 2) return { code: i.code, done: true, lead: null, ratio: null };
    if (!tied(i)) return { code: i.code, done: true, lead: "geride", ratio: null };
    if (topCount > 1) return { code: i.code, done: true, lead: "esit", ratio: null };
    const ratio = runnerUp && runnerUp.views > 0 ? Math.round((i.views / runnerUp.views) * 100) / 100 : null;
    return { code: i.code, done: true, lead: "onde", ratio };
  });
}

// === Pano ===

export interface OrganicNumbers {
  views: number | null;
  reach: number | null;
  saved: number | null;
  shares: number | null;
  avgWatchMs: number | null;
}
/**
 * baglanmadi: Meta ya da Instagram hesabı yapılandırılmamış; baglanti-yok: gönderi bağlantısı eklenmemiş;
 * bekliyor: bağlantı var, sayılar henüz gelmedi; hazir: sayılar var.
 */
export type OrganicState = "baglanmadi" | "baglanti-yok" | "bekliyor" | "hazir";
export interface OrganicInfo {
  state: OrganicState;
  numbers: OrganicNumbers | null;
  lead: OrganicLead | null;
}

const LEAD_LABEL: Record<"onde" | "geride" | "esit", OrganicLead> = { onde: "önde", geride: "geride", esit: "eşit" };

type StatRow = { content_id: string; day: string; views: number | null; reach: number | null; saved: number | null; shares: number | null; avg_watch_ms: number | null };

/**
 * Organik aşamadaki kartların durumu ve sayıları. Karşılaştırma aynı haftanın organik Reels'leri arasındadır.
 * Yayın zamanı olarak kartın organiğe girdiği an (`stageChangedAt`) kullanılır: kartın "72 saat kaldı" sayacıyla aynı saat.
 * Sorgu hatası fırlatılır (sayfa yakalar, kartlar sayısız kalır).
 */
export async function loadOrganicInfo(
  supabase: SupabaseClient,
  items: BoardItem[],
  connected: boolean,
  now: Date,
): Promise<Record<string, OrganicInfo>> {
  const organik = items.filter((i) => i.stage === "organik" && i.kind === "reels");
  const out: Record<string, OrganicInfo> = {};
  if (organik.length === 0) return out;

  if (!connected) {
    for (const i of organik) out[i.id] = { state: "baglanmadi", numbers: null, lead: null };
    return out;
  }

  const ids = organik.map((i) => i.id);
  const { data: statRows, error } = await supabase
    .from("content_organic_stats")
    .select("content_id, day, views, reach, saved, shares, avg_watch_ms")
    .in("content_id", ids)
    .order("day", { ascending: false });
  if (error) throw new Error(`content_organic_stats: ${error.code ?? "okunamadı"}`);
  const latest = new Map<string, StatRow>();
  for (const r of (statRows ?? []) as StatRow[]) if (!latest.has(r.content_id)) latest.set(r.content_id, r);

  const { data: weekRows, error: weekErr } = await supabase.from("content_items").select("id, week_start").in("id", ids);
  if (weekErr) throw new Error(`content_items: ${weekErr.code ?? "okunamadı"}`);
  const weekOf = new Map(((weekRows ?? []) as { id: string; week_start: string }[]).map((r) => [r.id, r.week_start]));

  const byWeek = new Map<string, BoardItem[]>();
  for (const i of organik) {
    const w = weekOf.get(i.id) ?? "?";
    byWeek.set(w, [...(byWeek.get(w) ?? []), i]);
  }
  const lead = new Map<string, OrganicLead>();
  for (const group of byWeek.values()) {
    const inputs = group.flatMap((i) => {
      const s = latest.get(i.id);
      return s ? [{ code: i.code, publishedAt: i.stageChangedAt, views: s.views ?? 0, saves: s.saved ?? 0, shares: s.shares ?? 0 }] : [];
    });
    for (const r of compare72h(inputs, now)) {
      const item = group.find((i) => i.code === r.code);
      if (item && r.lead) lead.set(item.id, LEAD_LABEL[r.lead]);
    }
  }

  for (const i of organik) {
    const s = latest.get(i.id);
    if (s) {
      out[i.id] = {
        state: "hazir",
        numbers: { views: s.views, reach: s.reach, saved: s.saved, shares: s.shares, avgWatchMs: s.avg_watch_ms },
        lead: lead.get(i.id) ?? null,
      };
    } else {
      out[i.id] = { state: i.igPermalink ? "bekliyor" : "baglanti-yok", numbers: null, lead: null };
    }
  }
  return out;
}
