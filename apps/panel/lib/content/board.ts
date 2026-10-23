// Yönetici İçerik panosu: kart verisi, reklam sayıları ve kurallara göre öneri (saf yardımcılar + okuma sorguları).
// Panel metin yazmaz; buradaki öneriler yalnız aşama ve kural durumunu söyler. Kampanya panelden kurulmaz.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentKind, PagePlatform } from "./codes";
import type { AdRules } from "./settings";
import { STAGES, type StageKey } from "./stages";
import { PAGE_FIELDS } from "./store";
import { istanbulDateString } from "@/lib/lead-flow/business-hours";
import { parseReelMediaMeta, type ReelMediaMeta } from "./media-meta";
import { toIgPublishStatus, type IgPublishStatus } from "./publish-queue";
import type { CheckLine } from "./reel-review";

export type BoardItem = {
  id: string;
  code: string;
  kind: ContentKind;
  platform: PagePlatform;
  topic: string;
  audience: string | null;
  brief: string | null;
  ownerId: string;
  ownerName: string;
  ownerPhone: string | null;
  dueAt: string | null;
  status: string;
  stage: StageKey;
  stageChangedAt: string;
  submittedAt: string | null;
  caption: string | null;
  pageFields: Record<string, string>;
  mediaPath: string | null;
  faceAnswer: boolean | null;
  reviewNote: string | null;
  learnedNote: string | null;
  igPermalink: string | null;
  /** Instagram'daki gerçek paylaşım zamanı; bilinmiyorsa 72 saat sayılmaz. */
  igPublishedAt: string | null;
  // Reklam Konsolu Paket B (Instagram'a yayın)
  approvedAt: string | null;
  approverFaceCheck: boolean | null;
  /** K17 biçim bilgisi; eski yüklemede null. */
  reelMeta: ReelMediaMeta | null;
  igPublishStatus: IgPublishStatus;
  igPublishError: string | null;
  igPublishScheduledAt: string | null;
  /** Z1 otomatik kontroller; sayfa doldurur, loadBoardItems null bırakır. */
  reelChecks: CheckLine[] | null;
};

export type ContentPerf = {
  spendKurus: number;
  clicks: number;
  platformResults: number;
  leads: number;
  qualified: number;
  appointments: number;
};

export type Tone = "ok" | "warn" | "bad" | "neutral";
export type RuleBar = { label: string; value: string; pct: number; tone: Tone };
export type ActionKind = "approve" | "test" | "stop" | "scale" | "archive" | "remind" | "none";
export type Advice = { text: string; action: { kind: ActionKind; label: string } };
/** Organik 72 saat karşılaştırması (lib/content/organic.ts hesaplar). */
export type OrganicLead = "önde" | "geride" | "eşit";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const ORGANIC_HOURS = 72;
const ORGANIC_WAITING = "Paylaşım saati bekleniyor";
const MICROS_PER_KURUS = 10_000;

export function emptyPerf(): ContentPerf {
  return { spendKurus: 0, clicks: 0, platformResults: 0, leads: 0, qualified: 0, appointments: 0 };
}

const tlFormatter = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

/** Tam TL: "3.150 TL". */
export function formatTl(tl: number): string {
  return `${tlFormatter.format(Math.round(tl))} TL`;
}

function spendTl(perf: ContentPerf): number {
  return perf.spendKurus / 100;
}

function stopLimitTl(rules: AdRules): number {
  return rules.targetTl * rules.stopMultiple;
}

/** Nitelikli veli başı maliyet (TL); nitelikli yoksa null. */
export function costPerQualifiedTl(perf: ContentPerf): number | null {
  return perf.qualified > 0 ? spendTl(perf) / perf.qualified : null;
}

/** Durdurma kuralı: hedefin katı kadar harcama ve hiç nitelikli veli yok. */
export function stopRuleHit(perf: ContentPerf, rules: AdRules): boolean {
  if (!(rules.targetTl > 0 && rules.stopMultiple > 0)) return false;
  return perf.qualified === 0 && spendTl(perf) >= stopLimitTl(rules);
}

/** Kazanma kuralı: en az winMin nitelikli ve veli başı maliyet hedefin altında. */
export function winRuleHit(perf: ContentPerf, rules: AdRules): boolean {
  const cpq = costPerQualifiedTl(perf);
  return perf.qualified >= rules.winMin && cpq !== null && cpq < rules.targetTl;
}

function pct(value: number, of: number): number {
  if (of <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / of) * 100)));
}

export function ruleBars(perf: ContentPerf, rules: AdRules): RuleBar[] {
  const stop = stopRuleHit(perf, rules);
  const win = winRuleHit(perf, rules);
  const spend = spendTl(perf);
  const bars: RuleBar[] = [
    {
      label: `Nitelikli veli (kazanmak için ${rules.winMin})`,
      value: `${perf.qualified} / ${rules.winMin}`,
      pct: pct(perf.qualified, rules.winMin),
      tone: perf.qualified >= rules.winMin ? "ok" : stop ? "bad" : "neutral",
    },
    {
      label: `Harcama (durdurma sınırı ${formatTl(stopLimitTl(rules))})`,
      value: formatTl(spend),
      pct: pct(spend, stopLimitTl(rules)),
      tone: stop ? "bad" : win ? "ok" : perf.qualified === 0 && spend >= rules.targetTl ? "warn" : "neutral",
    },
  ];
  const cpq = costPerQualifiedTl(perf);
  if (cpq !== null) {
    bars.push({
      label: `Veli başı maliyet (hedef ${formatTl(rules.targetTl)})`,
      value: formatTl(cpq),
      pct: pct(cpq, rules.targetTl),
      tone: cpq < rules.targetTl ? "ok" : cpq < stopLimitTl(rules) ? "warn" : "bad",
    });
  }
  return bars;
}

// === Zaman ===

const weekdayFormatter = new Intl.DateTimeFormat("tr-TR", { weekday: "long", timeZone: "Europe/Istanbul" });

function weekday(iso: string): string {
  const s = weekdayFormatter.format(new Date(iso));
  return s.charAt(0).toLocaleUpperCase("tr") + s.slice(1);
}

/** İstanbul takvim günü farkı (b - a). */
function dayDiff(a: Date, b: Date): number {
  return Math.round(
    (Date.parse(`${istanbulDateString(b)}T00:00:00Z`) - Date.parse(`${istanbulDateString(a)}T00:00:00Z`)) / DAY_MS,
  );
}

function hoursSince(iso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / HOUR_MS));
}

function isOverdue(item: BoardItem, now: Date): boolean {
  return !!item.dueAt && new Date(item.dueAt).getTime() < now.getTime();
}

function noResultFor(item: BoardItem, perf: ContentPerf, rules: AdRules, now: Date): boolean {
  return perf.qualified === 0 && now.getTime() - new Date(item.stageChangedAt).getTime() >= rules.noResultWeeks * 7 * DAY_MS;
}

/** Aşamada geçen süre: "2 gün kaldı", "dün teslim edildi", "11 gündür testte". */
export function stageSince(item: BoardItem, now: Date): string {
  const since = dayDiff(new Date(item.stageChangedAt), now);
  switch (item.stage) {
    case "gorev": {
      if (!item.dueAt) return "";
      if (isOverdue(item, now)) return "teslim zamanı geçti";
      const left = dayDiff(now, new Date(item.dueAt));
      return left === 0 ? "bugün teslim" : left === 1 ? "yarın teslim" : `${left} gün kaldı`;
    }
    case "kontrol": {
      const d = dayDiff(new Date(item.submittedAt ?? item.stageChangedAt), now);
      return d === 0 ? "bugün teslim edildi" : d === 1 ? "dün teslim edildi" : `${d} gün önce teslim edildi`;
    }
    case "organik": {
      if (!item.igPublishedAt) return ORGANIC_WAITING;
      const h = hoursSince(item.igPublishedAt, now);
      return h >= ORGANIC_HOURS ? "72 saat doldu" : `${ORGANIC_HOURS - h} saat kaldı`;
    }
    case "test":
      return since === 0 ? "bugün teste alındı" : `${since} gündür testte`;
    case "kazanan":
      return since === 0 ? "bugün büyütmeye alındı" : `${since} gündür büyütmede`;
    case "arsiv":
      return since === 0 ? "bugün arşive alındı" : `${since} gün önce arşive alındı`;
  }
}

// === Öneri ve kart ===

export function adviceFor(item: BoardItem, perf: ContentPerf, rules: AdRules, now: Date): Advice {
  switch (item.stage) {
    case "gorev": {
      const remind = { kind: "remind" as const, label: "Hatırlat" };
      const day = item.dueAt ? weekday(item.dueAt) : null;
      if (item.dueAt && isOverdue(item, now)) return { text: `Teslim zamanı geçti (${day}). Hatırlatın.`, action: remind };
      const due = day ? ` ${day} teslim.` : "";
      if (item.status === "duzeltme") return { text: `Düzeltme istendi, öğretmen yeniden hazırlıyor.${due}`, action: remind };
      return { text: `Bekleniyor.${due}`, action: remind };
    }
    case "kontrol":
      return { text: "Otomatik kontrol geçti. Okuyup onaylayın.", action: { kind: "approve", label: "Onayla" } };
    case "organik": {
      if (!item.igPublishedAt) {
        return {
          text: "Paylaşım saati bekleniyor. Gönderi bağlantısı eklenip Instagram'dan okununca 72 saat başlar.",
          action: { kind: "none", label: "Beklemeye devam" },
        };
      }
      const h = hoursSince(item.igPublishedAt, now);
      if (h < ORGANIC_HOURS) {
        return {
          text: `Organik deneme sürüyor. ${ORGANIC_HOURS - h} saat kaldı.`,
          action: { kind: "none", label: "Beklemeye devam" },
        };
      }
      return {
        text: "72 saat doldu. Organik sayılara bakıp öndeyse teste alın, gerideyse arşive alın.",
        action: { kind: "test", label: "Teste al" },
      };
    }
    case "test": {
      if (stopRuleHit(perf, rules)) {
        return {
          text: `Hedefin ${rules.stopMultiple} katı harcadı, nitelikli veli yok. Durdurun.`,
          action: { kind: "stop", label: "Durdur" },
        };
      }
      if (winRuleHit(perf, rules)) {
        return {
          text:
            `${perf.qualified} nitelikli veli, veli başı ${formatTl(costPerQualifiedTl(perf) ?? 0)} ` +
            `(hedef ${formatTl(rules.targetTl)}). Büyütme kampanyasına taşıyın.`,
          action: { kind: "scale", label: "Büyütme kampanyasına taşı" },
        };
      }
      if (noResultFor(item, perf, rules, now)) {
        return {
          text: `${rules.noResultWeeks} haftadır nitelikli veli yok. Arşive alın.`,
          action: { kind: "archive", label: "Arşive al" },
        };
      }
      return { text: "Erken. En az 1 hafta daha bekleyin.", action: { kind: "none", label: "Beklemeye devam" } };
    }
    case "kazanan": {
      const cpq = costPerQualifiedTl(perf);
      if (cpq === null) {
        return { text: "Büyütme kampanyasında. Henüz nitelikli veli yok.", action: { kind: "none", label: "Büyütmede kalsın" } };
      }
      if (cpq >= rules.targetTl) {
        return {
          text: `Veli başı ${formatTl(cpq)}, hedefin üstüne çıktı (hedef ${formatTl(rules.targetTl)}). Yorulduysa arşive alın.`,
          action: { kind: "archive", label: "Arşive al" },
        };
      }
      return {
        text: `Büyütme kampanyasında. Veli başı ${formatTl(cpq)} (hedef ${formatTl(rules.targetTl)}).`,
        action: { kind: "none", label: "Büyütmede kalsın" },
      };
    }
    case "arsiv":
      return {
        text: item.learnedNote ? `Arşivde. Öğrenilen: ${item.learnedNote}` : "Arşivde. Öğrenileni not olarak ekleyin.",
        action: { kind: "none", label: "" },
      };
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

export function cardTag(
  item: BoardItem,
  perf: ContentPerf,
  rules: AdRules,
  now: Date,
  organic?: OrganicLead,
): { text: string; tone: Tone } {
  switch (item.stage) {
    case "gorev":
      if (item.status === "duzeltme") return { text: "Düzeltme istendi", tone: "warn" };
      if (isOverdue(item, now)) return { text: "Teslim zamanı geçti", tone: "warn" };
      return { text: "Yazılıyor", tone: "neutral" };
    case "kontrol":
      return { text: "Onay bekleniyor", tone: "neutral" };
    case "organik": {
      if (!item.igPublishedAt) return { text: ORGANIC_WAITING, tone: "neutral" };
      const h = hoursSince(item.igPublishedAt, now);
      if (h < ORGANIC_HOURS) return { text: `Organik · ${ORGANIC_HOURS - h} saat kaldı`, tone: "neutral" };
      return { text: organic ? `72 saat doldu · ${organic}` : "72 saat doldu", tone: organic === "önde" ? "ok" : "neutral" };
    }
    case "test":
      if (stopRuleHit(perf, rules)) return { text: "Durdurma kuralı tuttu", tone: "bad" };
      if (winRuleHit(perf, rules)) return { text: "Kazandı · büyütülmeye hazır", tone: "ok" };
      if (noResultFor(item, perf, rules, now)) return { text: `${rules.noResultWeeks} haftadır sonuç yok`, tone: "warn" };
      return { text: `Veri toplanıyor · ${Math.max(0, rules.winMin - perf.qualified)} nitelikli daha`, tone: "neutral" };
    case "kazanan": {
      const cpq = costPerQualifiedTl(perf);
      return { text: cpq === null ? "Büyütmede" : `Büyütmede · veli başı ${formatTl(cpq)}`, tone: "ok" };
    }
    case "arsiv":
      return { text: item.learnedNote ? `Not: ${truncate(item.learnedNote, 40)}` : "Arşivde", tone: "neutral" };
  }
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

/** Kartın alt satırı: kim, ne zaman ya da sayılar. */
export function cardLine(item: BoardItem, perf: ContentPerf): string {
  const teacher = `${firstName(item.ownerName)} Öğretmen`;
  switch (item.stage) {
    case "gorev":
      return item.dueAt ? `${teacher} · ${weekday(item.dueAt)}` : teacher;
    case "kontrol":
      return `${teacher} teslim etti`;
    case "organik":
      return item.igPermalink ? "Instagram'da yayında" : "Gönderi bağlantısı bekleniyor";
    case "test":
      return `${formatTl(spendTl(perf))} · ${perf.qualified} nitelikli veli`;
    case "kazanan": {
      const cpq = costPerQualifiedTl(perf);
      return cpq === null ? `${formatTl(spendTl(perf))} harcandı` : `${formatTl(cpq)} / nitelikli veli`;
    }
    case "arsiv":
      return teacher;
  }
}

/** Kartın ilerleme çubuğu (0–100). */
export function cardProgress(item: BoardItem, perf: ContentPerf, rules: AdRules, now: Date): number {
  switch (item.stage) {
    case "gorev": {
      if (item.kind === "reels") {
        const done = [!!item.mediaPath, (item.caption ?? "").trim() !== "", item.faceAnswer === false].filter(Boolean).length;
        return pct(done, 3);
      }
      const filled = PAGE_FIELDS.filter((f) => (item.pageFields[f.key] ?? "").trim() !== "").length;
      return pct(filled, PAGE_FIELDS.length);
    }
    case "kontrol":
      return 50;
    case "organik":
      return item.igPublishedAt ? pct(hoursSince(item.igPublishedAt, now), ORGANIC_HOURS) : 0;
    case "test":
      if (stopRuleHit(perf, rules) || winRuleHit(perf, rules)) return 100;
      return Math.max(pct(perf.qualified, rules.winMin), pct(spendTl(perf), stopLimitTl(rules)));
    case "kazanan":
    case "arsiv":
      return 100;
  }
}

export function platformLabel(item: Pick<BoardItem, "kind" | "platform">): string {
  if (item.kind === "reels") return "Instagram Reels";
  return item.platform === "google" ? "Google sayfası" : "Instagram sayfası";
}

/** Onaylayanın gördüğü videonun durumu. */
export type ReviewVideo = "yukleniyor" | "hazir" | "oynatilamadi";

/** "Videoyu izledim" kutusu yalnız video gerçekten açıldıysa işaretlenebilir (MEB Ek Madde 4). */
export function canConfirmFace(videoUrl: string | null, state: ReviewVideo): boolean {
  return !!videoUrl && state === "hazir";
}

export type BoardColumn = { key: StageKey; title: string; hint: string; items: BoardItem[] };

/** Altı sütun; Görev'de teslim zamanı yakın olan, diğerlerinde aşamaya son giren üstte. */
export function groupByStage(items: BoardItem[]): BoardColumn[] {
  const time = (s: string | null, fallback: number) => (s ? new Date(s).getTime() : fallback);
  return STAGES.map((s) => ({
    ...s,
    items: items
      .filter((i) => i.stage === s.key)
      .sort((a, b) =>
        s.key === "gorev"
          ? time(a.dueAt, Infinity) - time(b.dueAt, Infinity)
          : time(b.stageChangedAt, 0) - time(a.stageChangedAt, 0),
      ),
  }));
}

// === Sorgular ===

const ITEM_COLUMNS =
  "id, code, kind, platform, topic, audience, brief, owner_id, due_at, status, stage, stage_changed_at, submitted_at, " +
  "caption, page_fields, media_path, face_answer, review_note, learned_note, ig_permalink, ig_published_at, " +
  "approved_at, approver_face_check, media_meta, ig_publish_status, ig_publish_error, ig_publish_scheduled_at";
const ARCHIVE_LIMIT = 30;

type ItemRow = {
  id: string; code: string; kind: string; platform: string; topic: string; audience: string | null;
  brief: string | null; owner_id: string; due_at: string | null; status: string; stage: string;
  stage_changed_at: string; submitted_at: string | null; caption: string | null;
  page_fields: Record<string, unknown> | null; media_path: string | null; face_answer: boolean | null;
  review_note: string | null; learned_note: string | null; ig_permalink: string | null;
  ig_published_at: string | null;
  approved_at: string | null; approver_face_check: boolean | null; media_meta: unknown;
  ig_publish_status: string | null; ig_publish_error: string | null; ig_publish_scheduled_at: string | null;
};

const STAGE_KEYS = new Set<string>(STAGES.map((s) => s.key));

/** Panodaki içerikler; arşivden yalnız son 30'u. Sahip adı ve telefonu profiles'tan. */
export async function loadBoardItems(supabase: SupabaseClient): Promise<BoardItem[]> {
  const { data, error } = await supabase
    .from("content_items")
    .select(ITEM_COLUMNS)
    .order("stage_changed_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`content_items: ${error.code ?? "bilinmeyen"}`);
  const rows = ((data ?? []) as unknown as ItemRow[]).filter((r) => STAGE_KEYS.has(r.stage));
  let archived = 0;
  const kept = rows.filter((r) => r.stage !== "arsiv" || ++archived <= ARCHIVE_LIMIT);

  const ownerIds = [...new Set(kept.map((r) => r.owner_id))];
  const owners = new Map<string, { full_name: string; phone: string | null }>();
  if (ownerIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, phone").in("id", ownerIds);
    for (const p of (profiles ?? []) as { id: string; full_name: string; phone: string | null }[]) owners.set(p.id, p);
  }

  return kept.map((r) => {
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(r.page_fields ?? {})) if (typeof v === "string") fields[k] = v;
    const owner = owners.get(r.owner_id);
    return {
      id: r.id, code: r.code, kind: r.kind === "sayfa" ? "sayfa" : "reels",
      platform: r.platform === "google" ? "google" : "instagram",
      topic: r.topic, audience: r.audience, brief: r.brief,
      ownerId: r.owner_id, ownerName: owner?.full_name ?? "Öğretmen", ownerPhone: owner?.phone ?? null,
      dueAt: r.due_at, status: r.status, stage: r.stage as StageKey, stageChangedAt: r.stage_changed_at,
      submittedAt: r.submitted_at, caption: r.caption, pageFields: fields, mediaPath: r.media_path,
      faceAnswer: r.face_answer, reviewNote: r.review_note, learnedNote: r.learned_note, igPermalink: r.ig_permalink, igPublishedAt: r.ig_published_at,
      approvedAt: r.approved_at ?? null, approverFaceCheck: r.approver_face_check ?? null,
      reelMeta: parseReelMediaMeta(r.media_meta), igPublishStatus: toIgPublishStatus(r.ig_publish_status),
      igPublishError: r.ig_publish_error ?? null, igPublishScheduledAt: r.ig_publish_scheduled_at ?? null, reelChecks: null,
    };
  });
}

/** "Yeni görev" formu için etkin öğretmenler. */
export async function loadTeachers(supabase: SupabaseClient): Promise<{ id: string; name: string }[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "ogretmen")
    .eq("is_active", true)
    .order("full_name");
  return ((data ?? []) as { id: string; full_name: string }[]).map((p) => ({ id: p.id, name: p.full_name }));
}

/** Sayıları okunan aşamalar: reklam ya da organik sonucu olabilenler (arşivden yalnız panoda görünenler). */
const PERF_STAGES = new Set<StageKey>(["organik", "test", "kazanan", "arsiv"]);

export function perfCodes(items: BoardItem[]): string[] {
  return items.filter((i) => PERF_STAGES.has(i.stage)).map((i) => i.code);
}

/** .in() listesi adres sınırını aşmasın diye en çok 100 değerlik parçalar. */
export const IN_CHUNK = 100;
const PAGE_SIZE = 1000;

export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

type PageResult = { data: unknown[] | null; error: { message: string } | null };

/** PostgREST max_rows sınırında toplam sessizce kesilmesin: kısa sayfa gelene kadar .range() ile okur. */
export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<PageResult>,
  pageSize = PAGE_SIZE,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < pageSize) return all;
  }
}

type SpendRow = { content_code: string; cost_micros: number; clicks: number; platform_results: number | null };
type LeadRow = { id: string; content_code: string; is_qualified: boolean | null; appointments: { outcome: string }[] | null };

/**
 * Koda göre reklam sayıları: harcama, tıklama ve platformun saydığı başvuru `ad_spend_daily.content_code`'dan
 * (Meta reklam satırları), veli, nitelikli ve randevuya dönen veli (iptal dışı randevusu olan) `leads.content_code`'dan.
 * Kodlar 100'lük parçalarla, satırlar sayfa sayfa okunur.
 */
export async function loadContentPerf(supabase: SupabaseClient, codes: string[]): Promise<Map<string, ContentPerf>> {
  const out = new Map<string, ContentPerf>(codes.map((c) => [c, emptyPerf()]));
  const micros = new Map<string, number>();

  for (const part of chunk([...new Set(codes)], IN_CHUNK)) {
    const [spend, leads] = await Promise.all([
      fetchAllPages<SpendRow>((from, to) =>
        supabase
          .from("ad_spend_daily")
          .select("content_code, cost_micros, clicks, platform_results")
          .in("content_code", part)
          .order("platform")
          .order("date")
          .order("level")
          .order("object_id")
          .range(from, to),
      ),
      fetchAllPages<LeadRow>((from, to) =>
        supabase
          .from("leads")
          .select("id, content_code, is_qualified, appointments(outcome)")
          .in("content_code", part)
          .order("id")
          .range(from, to),
      ),
    ]);

    for (const r of spend) {
      const p = out.get(r.content_code);
      if (!p) continue;
      micros.set(r.content_code, (micros.get(r.content_code) ?? 0) + Number(r.cost_micros ?? 0));
      p.clicks += Number(r.clicks ?? 0);
      p.platformResults += Number(r.platform_results ?? 0);
    }
    for (const r of leads) {
      const p = out.get(r.content_code);
      if (!p) continue;
      p.leads += 1;
      if (r.is_qualified) p.qualified += 1;
      if ((r.appointments ?? []).some((a) => a.outcome !== "iptal")) p.appointments += 1;
    }
  }
  for (const [code, m] of micros) out.get(code)!.spendKurus = Math.round(m / MICROS_PER_KURUS);
  return out;
}
