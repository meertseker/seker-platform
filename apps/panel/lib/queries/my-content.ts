// Öğretmenin "İçeriğim" ekranı: teslim ettiği içeriklerin sonradan ne olduğu. Para ve bütçe alanı yok;
// veli sayıları content_owner_summary() fonksiyonundan gelir (yalnız kendi içerikleri, RLS + owner_id süzgeci).
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDayTime, istanbulDateString } from "@/lib/lead-flow/business-hours";

export type OwnerSummary = {
  contentId: string;
  leads: number;
  appointments: number;
  enrolled: number;
  lastSyncAt: string | null;
  approvedByName: string | null;
};

export type MyContentItem = {
  id: string;
  code: string;
  kind: "reels" | "sayfa";
  platform: "google" | "instagram";
  topic: string;
  status: string;
  stage: string;
  submittedAt: string | null;
  approvedAt: string | null;
  igPublishedAt: string | null;
  stageChangedAt: string | null;
  learnedNote: string | null;
  page: { slug: string | null; status: string; publishedAt: string | null } | null;
  summary: OwnerSummary | null;
};

export type TimelineEvent = { title: string; detail: string | null; tone: "done" | "now" | "todo" };

const LIMIT = 20;
const COLUMNS =
  "id, code, kind, platform, topic, status, stage, submitted_at, approved_at, ig_published_at, stage_changed_at, learned_note";

type Row = {
  id: string; code: string; kind: string; platform: string; topic: string; status: string; stage: string;
  submitted_at: string | null; approved_at: string | null; ig_published_at: string | null;
  stage_changed_at: string | null; learned_note: string | null;
};

type SummaryRow = {
  content_id: string; leads: number | null; appointments: number | null; enrolled: number | null;
  last_sync_at: string | null; approved_by_name: string | null;
};

type PageRow = { content_id: string; slug: string | null; status: string; published_at: string | null };

/** Kendi teslim edilmiş içerikleri (yeniden eskiye, en çok 20), özet ve sayfa durumu. Özet okunamazsa sayılar gizlenir. */
export async function loadMyContent(supabase: SupabaseClient, me: string): Promise<MyContentItem[]> {
  const { data, error } = await supabase
    .from("content_items")
    .select(COLUMNS)
    .eq("owner_id", me)
    .neq("status", "taslak")
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .limit(LIMIT);
  if (error) throw new Error(`İçeriklerin okunamadı: ${error.message}`);
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return [];

  const [summaryRes, pageRes] = await Promise.all([
    supabase.rpc("content_owner_summary"),
    supabase
      .from("landing_pages")
      .select("content_id, slug, status, published_at")
      .in("content_id", rows.map((r) => r.id)),
  ]);

  const summaries = new Map<string, OwnerSummary>();
  if (!summaryRes.error) {
    for (const s of (summaryRes.data ?? []) as SummaryRow[]) {
      summaries.set(s.content_id, {
        contentId: s.content_id,
        leads: s.leads ?? 0,
        appointments: s.appointments ?? 0,
        enrolled: s.enrolled ?? 0,
        lastSyncAt: s.last_sync_at ?? null,
        approvedByName: s.approved_by_name ?? null,
      });
    }
  }
  const pages = new Map<string, PageRow>();
  if (!pageRes.error) for (const p of (pageRes.data ?? []) as PageRow[]) pages.set(p.content_id, p);

  return rows.map((r) => {
    const p = pages.get(r.id);
    return {
      id: r.id,
      code: r.code,
      kind: r.kind === "sayfa" ? "sayfa" : "reels",
      platform: r.platform === "google" ? "google" : "instagram",
      topic: r.topic,
      status: r.status,
      stage: r.stage,
      submittedAt: r.submitted_at,
      approvedAt: r.approved_at,
      igPublishedAt: r.ig_published_at,
      stageChangedAt: r.stage_changed_at,
      learnedNote: r.learned_note,
      page: p ? { slug: p.slug, status: p.status, publishedAt: p.published_at } : null,
      summary: summaries.get(r.id) ?? null,
    };
  });
}

/** Bugünse "Bugün 09:31", değilse "Cuma 23 Ekim 09:31" (İstanbul saati). */
function when(at: string | null, now: Date): string | null {
  if (!at) return null;
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return null;
  const full = formatDayTime(d);
  if (istanbulDateString(d) === istanbulDateString(now)) return `Bugün ${full.split(" ").pop()}`;
  return full;
}

function countsSentence(s: OwnerSummary): string {
  if (s.leads === 0) return "Henüz bu içerikten veli gelmedi";
  return `${s.leads} veli aradı, ${s.appointments} randevu verdi${s.enrolled > 0 ? `, ${s.enrolled} kayıt oldu` : ""}`;
}

const AD_STAGES = new Set(["test", "kazanan", "arsiv"]);

/** İçeriğin olmuş adımları sırayla; sonda (varsa) veli sayıları. Para yok. */
export function buildTimeline(item: MyContentItem, now: Date): TimelineEvent[] {
  const out: TimelineEvent[] = [];
  const done = (title: string, detail: string | null) => out.push({ title, detail, tone: "done" });
  if (item.submittedAt) done("Teslim ettin", when(item.submittedAt, now));
  if (item.approvedAt) {
    const name = item.summary?.approvedByName;
    done(name ? `${name} onayladı` : "Onaylandı", when(item.approvedAt, now));
  }
  if (item.igPublishedAt) done("Instagram'da yayınlandı", when(item.igPublishedAt, now));
  if (item.page?.publishedAt) done("Sayfa yayına girdi", item.page.slug ? `/lp/${item.page.slug}` : null);
  if (item.page?.status === "arsiv") done("Sayfa arşive alındı", null);
  if (item.kind === "reels" && item.stage === "test") done("Reklam testine girdi", when(item.stageChangedAt, now));
  if (item.stage === "kazanan") done("Büyütmeye taşındı", when(item.stageChangedAt, now));
  if (item.stage === "arsiv") done("Arşive alındı", when(item.stageChangedAt, now));

  const s = item.summary;
  if (s && (AD_STAGES.has(item.stage) || s.leads > 0)) {
    const lead = "Reklamdan senin içeriğinle gelenler.";
    const synced = when(s.lastSyncAt, now);
    out.push({ title: countsSentence(s), detail: synced ? `${lead} Güncellendi: ${synced}` : lead, tone: "now" });
  }
  return out;
}

/** Arşiv kartının tek satırı: sayılar ya da "Arşive alındı". */
export function archiveSummary(item: MyContentItem): string {
  return item.summary ? countsSentence(item.summary) : "Arşive alındı";
}

export function statusPill(item: MyContentItem): { text: string; tone: "ok" | "warn" | "muted" } {
  if (item.status === "teslim") return { text: "Onay bekliyor", tone: "warn" };
  if (item.status === "duzeltme") return { text: "Düzeltme istendi", tone: "warn" };
  if (item.stage === "organik") return { text: "Instagram'da", tone: "ok" };
  if (item.kind === "sayfa" && item.page?.status === "arsiv") return { text: "Arşivde", tone: "muted" };
  if (item.stage === "test" && item.kind === "sayfa" && item.page?.status !== "yayinda") {
    return { text: "Yayın bekliyor", tone: "warn" };
  }
  if (item.stage === "test") return { text: "Reklam testinde", tone: "ok" };
  if (item.stage === "kazanan") return { text: "Büyütmede", tone: "ok" };
  if (item.stage === "arsiv") return { text: "Arşivde", tone: "muted" };
  return { text: "Onaylandı", tone: "ok" };
}
