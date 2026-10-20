// Kampanyalar ekranı (saf modül): Google ve Instagram kampanyaları tek tabloda, Meta reklamları kampanyanın altında.
// Büyük sayılar paneldeki gerçek velilerdir; platformun kendi saydığı sonuç yalnız gri küçük sayıdır (K7).
// Maliyete yalnız ücretli reklam velisi girer (K10): gclid, source='reklam' ya da ad_platform dolu.
// Modül saat okumaz; bugün dışarıdan verilir.
import type { LeadStatus } from "@/lib/constants";
import { addDaysToDateString } from "@/lib/lead-flow/business-hours";
import type { AdSettings } from "./ad-settings";

type Platform = "google" | "meta";

/** ad_spend_daily satırı (Google kampanya, Meta reklam düzeyi). */
export type CampaignSpendRow = {
  platform: Platform;
  level: "campaign" | "adset" | "ad";
  objectId: string;
  campaignId: string;
  campaignName: string;
  adName: string | null;
  costMicros: number;
  platformResults: number | null;
  contentCode: string | null;
};

/** ad_objects satırı; `status` platformun ham durumu (ENABLED/PAUSED, ACTIVE/PAUSED). */
export type CampaignObject = {
  platform: Platform;
  level: "campaign" | "adset" | "ad";
  objectId: string;
  parentId: string | null;
  campaignId: string | null;
  name: string;
  status: string | null;
  dailyBudgetMicros: number | null;
  /** Bütçenin durduğu yer: Google campaignBudgets kaynak adı, Meta kampanya ya da reklam seti kimliği. */
  budgetResource: string | null;
  contentCode: string | null;
};

export type CampaignLead = {
  source: string;
  gclid: string | null;
  adPlatform: Platform | null;
  utmCampaign: string | null;
  contentCode: string | null;
  isQualified: boolean;
  /** İptal edilmemiş randevusu var. */
  hasAppointment: boolean;
  status: LeadStatus;
  convertedStudentId: string | null;
};

export type CplTone = "green" | "yellow" | "red";

export type CampaignRow = {
  key: string;
  platform: Platform;
  level: "campaign" | "ad";
  depth: 0 | 1;
  /** Kampanyası bilinmeyen veli satırında boş; bu satırda eylem yoktur. */
  objectId: string;
  name: string;
  status: "yayinda" | "durduruldu" | "reklam" | null;
  spendKurus: number;
  leads: number;
  platformResults: number;
  qualified: number;
  appts: number;
  enrolled: number;
  cplKurus: number | null;
  cplTone: CplTone;
  contentCode: string | null;
  unmatched: boolean;
  dailyBudgetTl: number | null;
  /** Nesnenin kendi ham durumu durdurulmuş. */
  selfPaused: boolean;
  /** Üst kampanya ya da reklam seti durdurulmuş (görünen durum "durduruldu", ham durum korunur). */
  parentPaused: boolean;
  /** Bütçe başka düzeyde ya da paylaşılıyorsa onay penceresindeki uyarı satırı. */
  budgetNote: string | null;
};

const MICROS_PER_KURUS = 10_000;
const ACTIVE = new Set(["ENABLED", "ACTIVE"]);
/** Silinmiş / arşivlenmiş nesneler tabloda gösterilmez. */
const GONE = new Set(["REMOVED", "DELETED", "ARCHIVED"]);
const APPT_STATUSES: LeadStatus[] = ["randevu", "gorusme_yapildi", "teklif", "kazanildi"];
const PLATFORM_LABEL: Record<Platform, string> = { google: "Google", meta: "Instagram" };

/** Nitelikli veli başı maliyetin rengi: yeşil ≤ hedef, sarı ≤ 2× hedef, kırmızı > 2× hedef; nitelikli yoksa kırmızı. */
export function cplToneFor(cplKurus: number | null, targetTl: number): CplTone {
  if (cplKurus === null) return "red";
  const target = targetTl * 100;
  if (cplKurus <= target) return "green";
  if (cplKurus <= target * 2) return "yellow";
  return "red";
}

function leadPlatform(l: CampaignLead): Platform | null {
  // Google kazanır: gclid ya da source=reklam varsa Meta işareti olsa da Google velisidir (report.ts ile aynı).
  if (l.gclid || l.source === "reklam" || l.adPlatform === "google") return "google";
  if (l.adPlatform === "meta") return "meta";
  return null;
}

type Counts = { micros: number; leads: number; platformResults: number; qualified: number; appts: number; enrolled: number };

const emptyCounts = (): Counts => ({ micros: 0, leads: 0, platformResults: 0, qualified: 0, appts: 0, enrolled: 0 });

function addLead(c: Counts, l: CampaignLead) {
  c.leads += 1;
  if (l.isQualified) c.qualified += 1;
  if (l.hasAppointment || APPT_STATUSES.includes(l.status)) c.appts += 1;
  if (l.status === "kazanildi" || l.convertedStudentId) c.enrolled += 1;
}

type CampaignNode = { platform: Platform; id: string; name: string; obj: CampaignObject | null; counts: Counts; ads: Map<string, AdNode> };
type AdNode = { id: string; name: string; obj: CampaignObject | null; code: string | null; counts: Counts };

function toRow(
  base: { key: string; platform: Platform; level: "campaign" | "ad"; depth: 0 | 1; objectId: string; name: string },
  status: CampaignRow["status"],
  c: Counts,
  extra: {
    contentCode: string | null;
    unmatched: boolean;
    dailyBudgetMicros: number | null;
    selfPaused: boolean;
    parentPaused: boolean;
    budgetNote?: string | null;
  },
  s: AdSettings,
): CampaignRow {
  const spendKurus = Math.round(c.micros / MICROS_PER_KURUS);
  const cplKurus = c.qualified > 0 ? Math.round(spendKurus / c.qualified) : null;
  return {
    ...base,
    status,
    spendKurus,
    leads: c.leads,
    platformResults: c.platformResults,
    qualified: c.qualified,
    appts: c.appts,
    enrolled: c.enrolled,
    cplKurus,
    cplTone: cplToneFor(cplKurus, s.targetTl),
    contentCode: extra.contentCode,
    unmatched: extra.unmatched,
    dailyBudgetTl: extra.dailyBudgetMicros === null ? null : Math.round((extra.dailyBudgetMicros / 1_000_000) * 100) / 100,
    selfPaused: extra.selfPaused,
    parentPaused: extra.parentPaused,
    budgetNote: extra.budgetNote ?? null,
  };
}

/**
 * Bütçe değişikliğinin başka nesneleri de etkilediğini söyleyen satır. Meta reklamının bütçesi reklam setinde ya da
 * kampanyadadır; Google kampanyası bütçesini başka kampanyalarla paylaşabilir.
 */
function budgetNoteFor(o: CampaignObject | null, objects: CampaignObject[], index: Map<string, CampaignObject>): string | null {
  if (!o?.budgetResource) return null;
  if (o.level === "ad" || o.level === "adset") {
    const owner =
      index.get(`${o.platform}|adset|${o.budgetResource}`) ?? index.get(`${o.platform}|campaign|${o.budgetResource}`);
    const word = owner?.level === "campaign" ? "kampanya" : "reklam seti";
    return `Bu bütçe ${word} “${owner?.name || o.budgetResource}” düzeyinde; aynı bütçeyi kullanan reklamları da etkiler.`;
  }
  const shared = objects.some(
    (x) => x.platform === o.platform && x.level === "campaign" && x.objectId !== o.objectId && x.budgetResource === o.budgetResource,
  );
  return shared ? "Bu bütçe başka kampanyalarla paylaşılıyor; aynı bütçeyi kullanan kampanyaları da etkiler." : null;
}

/**
 * Kampanya satırları ve altlarında Meta reklam satırları (depth 1). Veli eşlemesi: Google ve Meta kampanyası
 * `utm_campaign` = kampanya kimliği; Meta reklamı aynı kampanyada içerik koduyla. Kampanyası yazılmamış Meta velisi,
 * kodu tek bir kampanyanın reklamlarında geçiyorsa o kampanyaya düşer. Kodsuz Meta reklamı `unmatched` (K11).
 */
export function buildCampaignRows(
  spend: CampaignSpendRow[],
  objects: CampaignObject[],
  leads: CampaignLead[],
  s: AdSettings,
): CampaignRow[] {
  const campaigns = new Map<string, CampaignNode>();
  const objIndex = new Map<string, CampaignObject>();
  for (const o of objects) objIndex.set(`${o.platform}|${o.level}|${o.objectId}`, o);

  const campaign = (platform: Platform, id: string, name: string): CampaignNode => {
    const key = `${platform}|${id}`;
    let node = campaigns.get(key);
    if (!node) {
      node = { platform, id, name: name || id, obj: null, counts: emptyCounts(), ads: new Map() };
      campaigns.set(key, node);
    }
    return node;
  };
  const ad = (c: CampaignNode, id: string, name: string, code: string | null): AdNode => {
    let node = c.ads.get(id);
    if (!node) {
      node = { id, name: name || id, obj: null, code, counts: emptyCounts() };
      c.ads.set(id, node);
    }
    if (!node.code && code) node.code = code;
    return node;
  };

  // 1) Nesneler (silinmiş/arşivlenmiş hariç). Google'da yalnız kampanya düzeyi.
  for (const o of objects) {
    if (o.status && GONE.has(o.status)) continue;
    if (o.level === "campaign") {
      const c = campaign(o.platform, o.objectId, o.name);
      c.obj = o;
      c.name = o.name || c.name;
    }
  }
  for (const o of objects) {
    if (o.platform !== "meta" || o.level !== "ad" || !o.campaignId || (o.status && GONE.has(o.status))) continue;
    const parent = objIndex.get(`meta|campaign|${o.campaignId}`);
    if (parent?.status && GONE.has(parent.status)) continue;
    const a = ad(campaign("meta", o.campaignId, parent?.name ?? ""), o.objectId, o.name, o.contentCode);
    a.obj = o;
    a.name = o.name || a.name;
    a.code = o.contentCode ?? a.code;
  }

  // 2) Harcama.
  for (const r of spend) {
    const c = campaign(r.platform, r.campaignId, r.campaignName);
    const micros = Math.round(Number(r.costMicros) || 0);
    const results = Number(r.platformResults) || 0;
    c.counts.micros += micros;
    c.counts.platformResults += results;
    if (r.platform === "meta" && r.level === "ad") {
      const a = ad(c, r.objectId, r.adName ?? "", spendCode(r));
      a.counts.micros += micros;
      a.counts.platformResults += results;
    }
  }

  // Kod → kampanya (yalnız Meta reklamlarından); tek kampanyaya aitse kampanyasız veli oraya düşer.
  const codeCampaigns = new Map<string, Set<string>>();
  for (const c of campaigns.values()) {
    if (c.platform !== "meta") continue;
    for (const a of c.ads.values()) {
      if (!a.code) continue;
      if (!codeCampaigns.has(a.code)) codeCampaigns.set(a.code, new Set());
      codeCampaigns.get(a.code)!.add(c.id);
    }
  }

  // 3) Veliler.
  const unknown = new Map<Platform, Counts>();
  for (const l of leads) {
    const platform = leadPlatform(l);
    if (!platform) continue;
    let campaignId = l.utmCampaign?.trim() ?? "";
    const code = l.contentCode?.trim() || null;
    if (!campaignId && platform === "meta" && code) {
      const ids = codeCampaigns.get(code);
      if (ids && ids.size === 1) campaignId = [...ids][0];
    }
    if (!campaignId) {
      if (!unknown.has(platform)) unknown.set(platform, emptyCounts());
      addLead(unknown.get(platform)!, l);
      continue;
    }
    const c = campaign(platform, campaignId, "");
    addLead(c.counts, l);
    if (platform === "meta" && code) {
      for (const a of c.ads.values()) if (a.code === code) addLead(a.counts, l);
    }
  }

  // 4) Satırlar: Google önce, sonra Instagram; platform içinde harcama, sonra veli sayısına göre.
  const out: CampaignRow[] = [];
  const order = (a: Counts, b: Counts) => b.micros - a.micros || b.leads - a.leads;
  for (const platform of ["google", "meta"] as const) {
    const list = [...campaigns.values()].filter((c) => c.platform === platform);
    list.sort((a, b) => order(a.counts, b.counts) || a.name.localeCompare(b.name, "tr"));
    for (const c of list) {
      const campaignPaused = Boolean(c.obj?.status && !ACTIVE.has(c.obj.status));
      out.push(
        toRow(
          { key: `${platform}:campaign:${c.id}`, platform, level: "campaign", depth: 0, objectId: c.id, name: c.name },
          c.obj ? (campaignPaused ? "durduruldu" : "yayinda") : null,
          c.counts,
          {
            contentCode: null,
            unmatched: false,
            dailyBudgetMicros: c.obj?.dailyBudgetMicros ?? null,
            selfPaused: campaignPaused,
            parentPaused: false,
            budgetNote: budgetNoteFor(c.obj, objects, objIndex),
          },
          s,
        ),
      );
      const ads = [...c.ads.values()].sort((a, b) => order(a.counts, b.counts) || a.name.localeCompare(b.name, "tr"));
      for (const a of ads) {
        const selfPaused = Boolean(a.obj?.status && !ACTIVE.has(a.obj.status));
        const adset = a.obj?.parentId ? objIndex.get(`meta|adset|${a.obj.parentId}`) : undefined;
        const adsetPaused = Boolean(adset?.status && !ACTIVE.has(adset.status));
        const parentPaused = campaignPaused || adsetPaused;
        const status = selfPaused || parentPaused ? "durduruldu" : a.obj ? "reklam" : null;
        out.push(
          toRow(
            { key: `meta:ad:${a.id}`, platform: "meta", level: "ad", depth: 1, objectId: a.id, name: a.name },
            status,
            a.counts,
            {
              contentCode: a.code,
              unmatched: !a.code,
              dailyBudgetMicros: a.obj?.dailyBudgetMicros ?? null,
              selfPaused,
              parentPaused,
              budgetNote: budgetNoteFor(a.obj, objects, objIndex),
            },
            s,
          ),
        );
      }
    }
    const u = unknown.get(platform);
    if (u) {
      out.push(
        toRow(
          { key: `${platform}:bilinmiyor`, platform, level: "campaign", depth: 0, objectId: "", name: `${PLATFORM_LABEL[platform]} · kampanya bilinmiyor` },
          null,
          u,
          { contentCode: null, unmatched: false, dailyBudgetMicros: null, selfPaused: false, parentPaused: false },
          s,
        ),
      );
    }
  }
  return out;
}

function spendCode(r: CampaignSpendRow): string | null {
  return r.contentCode?.trim() || null;
}

const numberFormatter = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
const num = (n: number) => numberFormatter.format(Math.round(n));

export type Kpi = { label: string; value: string; sub: string };

/** Beş kart; alt satır "Google <n> · Instagram <n>". Yalnız kampanya (depth 0) satırları toplanır. */
export function buildKpis(rows: CampaignRow[]): Kpi[] {
  const top = rows.filter((r) => r.depth === 0);
  const sum = (platform: Platform | null, f: (r: CampaignRow) => number) =>
    top.filter((r) => platform === null || r.platform === platform).reduce((n, r) => n + f(r), 0);
  const card = (label: string, f: (r: CampaignRow) => number, money = false): Kpi => {
    const total = sum(null, f);
    const shown = (n: number) => (money ? num(n / 100) : num(n));
    return {
      label,
      value: money ? `${shown(total)} TL` : shown(total),
      sub: `Google ${shown(sum("google", f))} · Instagram ${shown(sum("meta", f))}`,
    };
  };
  return [
    card("Harcama", (r) => r.spendKurus, true),
    card("Gelen veli", (r) => r.leads),
    card("Nitelikli veli", (r) => r.qualified),
    card("Randevu", (r) => r.appts),
    card("Kayıt", (r) => r.enrolled),
  ];
}

export type BudgetPace = {
  totalTl: number;
  spentTl: number;
  pctSpent: number;
  pctMonth: number;
  perPlatform: { label: string; spentTl: number; budgetTl: number; pct: number; fast: boolean }[];
};

function daysInMonth(ymd: string): number {
  const first = `${ymd.slice(0, 7)}-01`;
  const nextMonth = addDaysToDateString(first, 32).slice(0, 7);
  return Number(addDaysToDateString(`${nextMonth}-01`, -1).slice(8, 10));
}

const pctOf = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

/**
 * Aylık bütçe gidişatı. Ayın geçen kısmı bugün dahil sayılır (19 Ekim → 19/31 = %61).
 * Platform harcaması bütçesinin ayın geçen kısmından büyük payına ulaştıysa "hızlı". Bütçe 0 ise toplam 0 döner
 * (ekran "Aylık bütçe girilmedi" yazar).
 */
export function budgetPace(spendMonthKurus: { google: number; meta: number }, s: AdSettings, today: string): BudgetPace {
  const day = Number(today.slice(8, 10));
  const pctMonth = pctOf(day, daysInMonth(today));
  const platforms = [
    { label: "Google", spentTl: spendMonthKurus.google / 100, budgetTl: s.monthlyBudget.googleTl },
    { label: "Instagram", spentTl: spendMonthKurus.meta / 100, budgetTl: s.monthlyBudget.metaTl },
  ];
  const totalTl = platforms.reduce((n, p) => n + p.budgetTl, 0);
  const spentTl = platforms.reduce((n, p) => n + p.spentTl, 0);
  return {
    totalTl,
    spentTl,
    pctSpent: pctOf(spentTl, totalTl),
    pctMonth,
    perPlatform: platforms.map((p) => {
      const pct = pctOf(p.spentTl, p.budgetTl);
      return { ...p, pct, fast: p.budgetTl > 0 && pct > pctMonth };
    }),
  };
}
