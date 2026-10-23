// Panelin önerdiği kararlar: kurallar (saf), haftalık kayıt ve karar deposu.
// Öneriler (hafta, kural, nesne) ile tekildir; sayfa her açıldığında çoğalmaz. "Şimdilik bekle" denen öneri
// aynı hafta yeniden açılmaz; gelecek haftanın anahtarı farklı olduğu için orada yeniden sorulur.
// Yazımlar yalnız gizli anahtarlı istemciyle, requireRole("yonetici") sonrası.
import type { SupabaseClient } from "@supabase/supabase-js";
import { costPerQualifiedTl, formatTl, stopRuleHit, winRuleHit, type ContentPerf } from "@/lib/content/board";
import type { AdSettings } from "./ad-settings";
import { defaultNewBudget } from "./change-text";
import type { AdChangeAction } from "./writes";
import { anyGateRed, type Gate } from "./weekly";

export type RuleKey = "durdur" | "buyut" | "teste_al" | "butce_artir" | "yorgunluk" | "sonucsuz";
export const RULE_KEYS: RuleKey[] = ["durdur", "buyut", "teste_al", "butce_artir", "yorgunluk", "sonucsuz"];

export type RecAdObject = {
  objectId: string;
  level: string;
  /** Platformdaki ad (bütçe önerisinin başlığı). */
  name: string;
  /** Platformun ham durumu (ENABLED / PAUSED / ACTIVE ...). */
  status: string | null;
  /** TL × 1.000.000; bütçe üst düzeydeyse üstün bütçesi. */
  dailyBudgetMicros: number | null;
  /** Bütçenin durduğu kaynak; aynı kaynağı paylaşan satırlar tek bütçedir. */
  budgetResource: string | null;
  /** Meta: bütçenin durduğu reklam seti ya da kampanya (ad_objects'te object_id = budgetResource). */
  budgetOwner?: { level: "campaign" | "adset"; objectId: string; name: string } | null;
};

export type RecInput = {
  contentId: string;
  contentCode: string;
  platform: "google" | "meta";
  stage: string;
  perf: ContentPerf;
  /** Test/büyütme aşamasında geçen tam hafta. */
  weeksInTest: number;
  adObjects: RecAdObject[];
  /** İlk 7 günün tıklama oranı (tıklama / gösterim); veri yoksa ya da son haftayla çakışıyorsa null. */
  firstWeekCtr: number | null;
  /** Toplantı haftasının tıklama oranı. */
  lastWeekCtr: number | null;
  /** Toplantı haftasının sıklığı (gösterim / kişi; yaklaşık). */
  frequency: number | null;
  /** Nitelikli veli başı maliyetin toplantı haftasında bir önceki haftaya göre yönü. */
  costPerQualifiedTrend: "up" | "down" | "flat" | null;
  /** Organik 72 saat karşılaştırması (compare72h); `versus`: öndekinin karşılaştırıldığı ikinci Reels. */
  organic72h: { lead: "onde" | "geride" | "esit" | null; ratio: number | null; versus?: string | null } | null;
};

export type StageAction = { kind: "stage"; contentId: string; to: "test" | "kazanan" | "arsiv" };
export type RecAction = AdChangeAction | StageAction;

export type RecDraft = {
  ruleKey: RuleKey;
  objectKey: string;
  platform: "google" | "meta";
  title: string;
  why: string;
  action: RecAction | null;
  blockedReason: string | null;
};

export type RecStatus = "acik" | "onaylandi" | "bekletildi" | "gecersiz";

export type RecommendationRow = {
  id: string;
  weekStart: string;
  ruleKey: RuleKey;
  objectKey: string;
  platform: "google" | "meta" | null;
  title: string;
  why: string;
  action: RecAction | null;
  blockedReason: string | null;
  status: RecStatus;
  result: string | null;
  decidedAt: string | null;
  /** Karar verenin profil kimliği (onaylayan ya da bekleten). */
  decidedBy: string | null;
};

export const HOLD_RESULT = "Bekletiliyor · gelecek hafta tekrar sorulur";
export const APPLIED_RESULT = "✓ Uygulandı · kayda geçti";
export const CLOSED_RESULT = "Kaydedildi · uygulanmadı: canlı yazım kapalı";
export const NO_OBJECT_RESULT = "Kaydedildi · panelde uygulanacak reklam bulunamadı";
export const GATE_BLOCKED = "Kapı kırmızı";

// ---- Metin yardımcıları ----

/** Harf adının son ünlüsü (A "a", B "be", O "o" ...): belirtme eki ünlü uyumuyla. */
const LETTER_SUFFIX: Record<string, string> = { A: "yı", I: "yı", O: "yu", U: "yu", Ö: "yü", Ü: "yü" };

/** İçerik kodu + belirtme eki: "R-2643-B'yi", "R-2641-A'yı". */
export function accusative(code: string): string {
  const last = code.slice(-1).toLocaleUpperCase("tr");
  return `${code}'${LETTER_SUFFIX[last] ?? "yi"}`;
}

/** İçerik kodu + ilgi eki: "R-2645-B'nin", "R-2645-A'nın". */
export function genitive(code: string): string {
  const v = (LETTER_SUFFIX[code.slice(-1).toLocaleUpperCase("tr")] ?? "yi").slice(1);
  return `${code}'n${v}n`;
}

function decimal(n: number): string {
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}

function spendTl(perf: ContentPerf): number {
  return perf.spendKurus / 100;
}

const STOPPED = new Set(["PAUSED", "ARCHIVED", "DELETED", "REMOVED"]);

function isActive(o: RecAdObject): boolean {
  return !STOPPED.has((o.status ?? "").toUpperCase());
}

/**
 * Durdurulacak tek reklam: koda bağlı çalışan nesne tek ise o. Birden fazlaysa panel hangisini durduracağını
 * tahmin etmez (action null, neden metninde söylenir).
 */
function pauseTarget(input: RecInput): { action: AdChangeAction | null; note: string } {
  const active = input.adObjects.filter(isActive);
  if (active.length === 1) {
    const o = active[0];
    return {
      action: { platform: input.platform, level: o.level as AdChangeAction["level"], objectId: o.objectId, objectName: o.name, kind: "pause" },
      note: "",
    };
  }
  if (active.length > 1) return { action: null, note: " Bu koda bağlı birden fazla reklam var; Kampanyalar ekranından durdurun." };
  return { action: null, note: " Reklamı panelde bulunamadı; sabah eşitlemesinden sonra Kampanyalar ekranına bakın." };
}

/** Koda bağlı reklamların hepsi durmuşsa (ve en az biri biliniyorsa) durdurma önerisi gereksiz. */
function allStopped(input: RecInput): boolean {
  return input.adObjects.length > 0 && !input.adObjects.some(isActive);
}

type BudgetTarget = { budgetResource: string; level: "campaign" | "adset"; objectId: string; name: string; tl: number };

/**
 * Bütçe artışı için tek bütçe kaynağı: çalışan, bütçesi bilinen satırlar tek kaynağı paylaşıyorsa.
 * Eylem bütçenin sahibine uygulanır: Google'da kampanyanın kendisi, Meta'da reklam seti ya da kampanya
 * (sahibi bilinmiyorsa öneri yazılmaz; sabah eşitlemesi doldurur).
 */
function budgetTarget(input: RecInput): BudgetTarget | null {
  const withBudget = input.adObjects.filter(
    (o) => isActive(o) && o.dailyBudgetMicros !== null && o.dailyBudgetMicros > 0 && !!o.budgetResource,
  );
  const resources = new Set(withBudget.map((o) => o.budgetResource));
  if (resources.size !== 1) return null;
  const row = withBudget[0];
  const tl = (row.dailyBudgetMicros as number) / 1_000_000;
  const budgetResource = row.budgetResource as string;
  if (input.platform === "google") {
    if (row.level !== "campaign") return null;
    return { budgetResource, level: "campaign", objectId: row.objectId, name: row.name, tl };
  }
  const owner = row.budgetOwner;
  if (!owner || owner.objectId !== budgetResource) return null;
  return { budgetResource, level: owner.level, objectId: owner.objectId, name: owner.name, tl };
}

const LEVEL_TEXT: Record<"campaign" | "adset", string> = { campaign: "kampanya", adset: "reklam seti" };

function fatigued(input: RecInput, s: AdSettings): boolean {
  const { frequency, firstWeekCtr, lastWeekCtr } = input;
  if (frequency === null || firstWeekCtr === null || lastWeekCtr === null || firstWeekCtr <= 0) return false;
  const dropPct = ((firstWeekCtr - lastWeekCtr) / firstWeekCtr) * 100;
  return frequency > s.fatigueFrequency && dropPct >= s.fatigueCtrDropPct && input.costPerQualifiedTrend === "up";
}

// ---- Kurallar ----

/**
 * Kurallardan bu haftanın önerileri. Sıra: durdur, büyüt, teste al, bütçe artır, yorgunluk, sonuçsuz.
 * Bir içerik için en çok bir aşama/durdurma önerisi; bütçe artışı ayrıca yazılabilir.
 * Kapılardan biri kırmızıysa bütçe önerisi yine yazılır ama `blockedReason="Kapı kırmızı"`.
 */
export function buildRecommendations(inputs: RecInput[], gates: Gate[], s: AdSettings): RecDraft[] {
  const red = anyGateRed(gates);
  const out: RecDraft[] = [];
  const target = formatTl(s.targetTl);
  // Aynı bütçeyi paylaşan iki kazanan içerik tek bütçe önerisi üretir.
  const budgetKeys = new Set<string>();

  for (const input of inputs) {
    const { contentCode: code, perf, stage, platform } = input;
    const running = stage === "test" || stage === "kazanan";
    const base = { objectKey: code, platform, blockedReason: null };
    const stop = running && stopRuleHit(perf, s);
    const win = winRuleHit(perf, s);
    const cpq = costPerQualifiedTl(perf);

    if (stop && !allStopped(input)) {
      const t = pauseTarget(input);
      out.push({
        ...base,
        ruleKey: "durdur",
        title: `${accusative(code)} durdur`,
        why:
          `${formatTl(spendTl(perf))} harcadı, hiç nitelikli veli getirmedi. ` +
          `Kural: hedefin ${s.stopMultiple} katı harcayıp sonuç yoksa dur.${t.note}`,
        action: t.action,
      });
    }

    if (stage === "test" && win && !stop) {
      out.push({
        ...base,
        ruleKey: "buyut",
        title: `${accusative(code)} büyütme kampanyasına taşı`,
        why: `${perf.qualified} nitelikli veli, veli başı ${formatTl(cpq ?? 0)} (hedef ${target}).`,
        action: { kind: "stage", contentId: input.contentId, to: "kazanan" },
      });
    }

    if (stage === "organik" && input.organic72h?.lead === "onde") {
      const { ratio, versus } = input.organic72h;
      const than = versus ? genitive(versus) : "aynı haftanın öbür Reels'lerinin";
      out.push({
        ...base,
        ruleKey: "teste_al",
        title: `${code} teste girsin`,
        why:
          ratio !== null && ratio > 1
            ? `72 saatte organik izlenmede ${than} ${decimal(ratio)} katı.`
            : "72 saatte organik izlenmede aynı haftanın Reels'leri arasında önde.",
        action: { kind: "stage", contentId: input.contentId, to: "test" },
      });
    }

    if (stage === "kazanan" && win && s.scaleMaxPct > 0) {
      const b = budgetTarget(input);
      const objectKey = b ? `${platform}:${b.budgetResource}` : "";
      // Aşağı yuvarlanır: önerinin kendisi haftalık büyütme sınırını aşıp gerekçe istemesin (153 → 183, 184 değil).
      const newTl = b ? defaultNewBudget(b.tl, s.scaleMaxPct) : 0;
      if (b && newTl > b.tl && !budgetKeys.has(objectKey)) {
        budgetKeys.add(objectKey);
        const blocked = red.red;
        const shared =
          platform === "meta" ? ` Bu bütçe ${LEVEL_TEXT[b.level]} düzeyinde; aynı bütçeyi kullanan diğer reklamlar da büyür.` : "";
        out.push({
          ruleKey: "butce_artir",
          objectKey,
          platform,
          title: `${b.name} bütçesini %${s.scaleMaxPct} artır`,
          why:
            `Veli başı maliyet hedefin altında (${formatTl(cpq ?? 0)}, hedef ${target}). ` +
            `Günlük bütçe ${formatTl(b.tl)} → ${formatTl(newTl)}.${shared}` +
            (blocked ? ` Ancak bir kapı kırmızı (${red.labels.join(", ")}) olduğu için bekletiliyor.` : ""),
          action: { platform, level: b.level, objectId: b.objectId, objectName: b.name, kind: "budget", newDailyBudgetTl: newTl, expectedOldTl: b.tl },
          blockedReason: blocked ? GATE_BLOCKED : null,
        });
      }
    }

    if (running && !stop && !(stage === "test" && win) && !allStopped(input) && fatigued(input, s)) {
      const drop = Math.round((((input.firstWeekCtr as number) - (input.lastWeekCtr as number)) / (input.firstWeekCtr as number)) * 100);
      const t = pauseTarget(input);
      out.push({
        ...base,
        ruleKey: "yorgunluk",
        title: `${code} yoruldu, durdurun`,
        why:
          `Sıklık ${decimal(input.frequency as number)} (sınır ${decimal(s.fatigueFrequency)}), tıklama oranı ilk haftaya göre ` +
          `%${drop} düştü, nitelikli veli başı maliyet artıyor. Yerine yeni Reels koyun.${t.note}`,
        action: t.action,
      });
    }

    if (stage === "test" && !stop && !win && input.weeksInTest >= s.noResultWeeks) {
      out.push({
        ...base,
        ruleKey: "sonucsuz",
        title: `${code} arşive alınsın`,
        why:
          `${input.weeksInTest} haftadır testte, ${perf.qualified} nitelikli veli` +
          (cpq !== null ? `, veli başı ${formatTl(cpq)}` : "") +
          `. Kural: ${s.noResultWeeks} haftada kazanamayan arşive alınır.`,
        action: { kind: "stage", contentId: input.contentId, to: "arsiv" },
      });
    }
  }
  return out;
}

// ---- Haftalık kayıt ----

type DbRec = {
  id: string;
  week_start: string;
  rule_key: RuleKey;
  object_key: string;
  platform: "google" | "meta" | null;
  title: string;
  why: string;
  action: RecAction | null;
  blocked_reason: string | null;
  status: RecStatus;
  result: string | null;
  decided_at: string | null;
  decided_by: string | null;
};

const keyOf = (ruleKey: string, objectKey: string) => `${ruleKey}|${objectKey}`;

function draftFields(d: RecDraft) {
  return { platform: d.platform, title: d.title, why: d.why, action: d.action, blocked_reason: d.blockedReason };
}

/**
 * Haftanın önerilerini kayda geçirir (`db` gizli anahtarlı istemci):
 * - yoksa ekler (aynı anda iki açılışta da tek satır: çakışan ekleme yok sayılır);
 * - açık öneri yeniden üretildiyse yalnız metni, eylemi ve engeli tazelenir (bütçe, kapı durumu güncel kalsın);
 * - artık üretilmeyen açık öneri `gecersiz`; yeniden üretilen `gecersiz` öneri yeniden açılır;
 * - onaylanmış ya da bekletilmiş öneriye dokunulmaz.
 */
export async function syncRecommendations(db: SupabaseClient, weekStart: string, drafts: RecDraft[]): Promise<void> {
  const { data, error } = await db
    .from("ad_recommendations")
    .select("id, rule_key, object_key, status")
    .eq("week_start", weekStart);
  if (error) throw new Error(`ad_recommendations okunamadı: ${error.code ?? "bilinmeyen"}`);
  const existing = new Map(
    ((data ?? []) as { id: string; rule_key: string; object_key: string; status: RecStatus }[]).map((r) => [
      keyOf(r.rule_key, r.object_key),
      r,
    ]),
  );

  const unique = new Map<string, RecDraft>();
  for (const d of drafts) if (!unique.has(keyOf(d.ruleKey, d.objectKey))) unique.set(keyOf(d.ruleKey, d.objectKey), d);

  const fresh = [...unique.entries()].filter(([k]) => !existing.has(k)).map(([, d]) => d);
  if (fresh.length > 0) {
    const { error: insErr } = await db.from("ad_recommendations").upsert(
      fresh.map((d) => ({ week_start: weekStart, rule_key: d.ruleKey, object_key: d.objectKey, ...draftFields(d) })),
      { onConflict: "week_start,rule_key,object_key", ignoreDuplicates: true },
    );
    if (insErr) throw new Error(`ad_recommendations yazılamadı: ${insErr.code ?? "bilinmeyen"}`);
  }

  for (const [k, row] of existing) {
    const d = unique.get(k);
    if (d && (row.status === "acik" || row.status === "gecersiz")) {
      const { error: upErr } = await db
        .from("ad_recommendations")
        .update({ ...draftFields(d), status: "acik" })
        .eq("id", row.id)
        .eq("status", row.status);
      if (upErr) throw new Error(`ad_recommendations güncellenemedi: ${upErr.code ?? "bilinmeyen"}`);
    } else if (!d && row.status === "acik") {
      const { error: upErr } = await db
        .from("ad_recommendations")
        .update({ status: "gecersiz" })
        .eq("id", row.id)
        .eq("status", "acik");
      if (upErr) throw new Error(`ad_recommendations güncellenemedi: ${upErr.code ?? "bilinmeyen"}`);
    }
  }
}

const REC_COLUMNS = "id, week_start, rule_key, object_key, platform, title, why, action, blocked_reason, status, result, decided_at, decided_by";

export function toRecommendationRow(r: DbRec): RecommendationRow {
  return {
    id: r.id,
    weekStart: r.week_start,
    ruleKey: r.rule_key,
    objectKey: r.object_key,
    platform: r.platform,
    title: r.title,
    why: r.why,
    action: r.action,
    blockedReason: r.blocked_reason,
    status: r.status,
    result: r.result,
    decidedAt: r.decided_at,
    decidedBy: r.decided_by ?? null,
  };
}

const RULE_ORDER = new Map(RULE_KEYS.map((k, i) => [k, i]));

/** Haftanın geçerli önerileri (açık + karar verilmiş), kural sırasıyla. */
export async function readWeekRecommendations(supabase: SupabaseClient, weekStart: string): Promise<RecommendationRow[]> {
  const { data, error } = await supabase
    .from("ad_recommendations")
    .select(REC_COLUMNS)
    .eq("week_start", weekStart)
    .neq("status", "gecersiz")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`ad_recommendations okunamadı: ${error.code ?? "bilinmeyen"}`);
  return ((data ?? []) as DbRec[])
    .map(toRecommendationRow)
    .sort((a, b) => (RULE_ORDER.get(a.ruleKey) ?? 9) - (RULE_ORDER.get(b.ruleKey) ?? 9));
}

// ---- Karar deposu (onay / bekletme) ----

export interface RecommendationStore {
  get(id: string): Promise<RecommendationRow | null>;
  /** Açık öneriyi karar sahibine ayırır (yarışta tek kazanan) ve ayrılan satırı döndürür; ayrılamadıysa null. */
  claim(id: string, actorId: string): Promise<RecommendationRow | null>;
  /** Uygulama başarısızsa ayrılan öneriyi yeniden açar. */
  release(id: string): Promise<void>;
  finish(id: string, result: string): Promise<void>;
  /** Açık öneriyi bekletir; açık değilse false. */
  hold(id: string, actorId: string, result: string, at: string): Promise<boolean>;
}

export function supabaseRecommendationStore(db: SupabaseClient, now: () => Date = () => new Date()): RecommendationStore {
  return {
    async get(id) {
      const { data, error } = await db.from("ad_recommendations").select(REC_COLUMNS).eq("id", id).maybeSingle();
      if (error) throw new Error("db");
      return data ? toRecommendationRow(data as DbRec) : null;
    },
    async claim(id, actorId) {
      const { data, error } = await db
        .from("ad_recommendations")
        .update({ status: "onaylandi", decided_by: actorId, decided_at: now().toISOString() })
        .eq("id", id)
        .eq("status", "acik")
        .select(REC_COLUMNS);
      if (error) throw new Error("db");
      const row = (data ?? [])[0] as DbRec | undefined;
      return row ? toRecommendationRow(row) : null;
    },
    async release(id) {
      const { error } = await db
        .from("ad_recommendations")
        .update({ status: "acik", decided_by: null, decided_at: null, result: null })
        .eq("id", id)
        .eq("status", "onaylandi");
      if (error) throw new Error("db");
    },
    async finish(id, result) {
      const { error } = await db.from("ad_recommendations").update({ result }).eq("id", id);
      if (error) throw new Error("db");
    },
    async hold(id, actorId, result, at) {
      const { data, error } = await db
        .from("ad_recommendations")
        .update({ status: "bekletildi", decided_by: actorId, decided_at: at, result })
        .eq("id", id)
        .eq("status", "acik")
        .select("id");
      if (error) throw new Error("db");
      return (data ?? []).length > 0;
    },
  };
}
