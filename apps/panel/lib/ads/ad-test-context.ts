// Z4 "Reklam testine al" penceresinin bağlamı: önizleme, şablondan gelen satırlar, 9 kontrol ve kurulum planı.
// Yalnız okur; Meta'ya giden tek istek hesap sağlığı GET'idir ve yalnız Meta yapılandırılmışsa yapılır.
// "Şimdi" çağıranın verdiği `now`'dır; burada saat okunmaz.
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatTl } from "@/lib/content/board";
import { istanbulDateString } from "@/lib/lead-flow/business-hours";
import { siteBaseUrl } from "@/lib/pages/site";
import { getAdSettings } from "./ad-settings";
import type { AdSetup } from "./ad-setup";
import { monthlyCapCheck } from "./ad-template";
import { readMetaConfig, type MetaConfig } from "./meta/config";
import { readAccountHealth, reviewLabel, type AccountHealth } from "./meta/setup";
import { preflightBlockText, REELS_MIN_HOURS, runPreflight, type PreflightResult } from "./preflight";
import {
  loadContentForAd,
  loadLandingForAd,
  loadWeekInstagramPageSlug,
  type ContentForAd,
  type LandingForAd,
} from "./preflight-sources";
import {
  adLink,
  adName,
  adUrlTags,
  PLACEHOLDER_SETUP,
  planAdTest,
  REELS_FALLBACK_SLUG,
  TEST_CAMPAIGN_NAME,
  type AdSource,
  type PlannedChange,
} from "./setup-plans";
import type { SetupStore } from "./setup-store";
import type { FetchFn } from "./types";
import { adsWriteEnabled, loadGateStatus } from "./writes";

export type AdTestRow = { label: string; value: string; sub: string | null };

export type AdTestView = {
  contentId: string;
  code: string;
  kind: "reels" | "sayfa";
  topic: string;
  preview:
    | { kind: "reels"; caption: string | null; permalink: string | null }
    | { kind: "sayfa"; imageUrl: string | null; headline: string | null; primaryText: string | null };
  rows: AdTestRow[];
  checklist: PreflightResult;
  blockText: string | null;
  needs72hOverride: boolean;
  hoursLeft: number | null;
  gateRed: string[];
  writeEnabled: boolean;
  existing: { adId: string; review: string | null } | null;
  /** Kurulum duraklatılmış Test kampanyasını/setini yeniden açacaksa düğmeden önceki uyarı satırı; yoksa null. */
  reactivateWarning: string | null;
};

export type AdTestContextDeps = {
  db: SupabaseClient;
  store: SetupStore;
  env: Record<string, string | undefined>;
  fetchFn: FetchFn;
  now: Date;
  actorName: string;
};

export type AdTestContext = {
  view: AdTestView;
  /**
   * Kurulacak adımlar; sayfa kimliği, Meta yapılandırması ya da kaynak eksikse null. Kampanyalar henüz kurulmadıysa
   * (setup null) yer tutucu kimliklerle kurulur: yalnız "Sadece göster" içindir, "kur" setup olmadan reddedilir.
   */
  planned: PlannedChange | null;
  content: ContentForAd;
  setup: AdSetup | null;
};

const HOUR_MS = 3_600_000;
const MSG_NOT_FOUND = "İçerik bulunamadı.";
const MSG_NOT_INSTAGRAM = "Yalnız Instagram içerikleri reklam testine alınır.";
const MSG_READ_FAILED = "Bilgiler okunamadı, tekrar deneyin.";
const PLACEHOLDER_NOTE = "Test ve Büyütme kampanyaları henüz kurulmadı: kimlikler Ayarlar'daki kurulumdan sonra belli olur.";

/** M3: plan duraklatılmış Test kampanyasını/setini açacaksa uyarı (kurulum yoksa ilk kurulumdur, uyarı yok). */
export function reactivateWarning(activateCampaign: boolean, activateAdset: boolean): string | null {
  const what =
    activateCampaign && activateAdset
      ? "Test kampanyası ve reklam seti"
      : activateCampaign
        ? "Test kampanyası"
        : activateAdset
          ? "Test reklam seti"
          : null;
  return what ? `${what} duraklatılmış; kurulunca yeniden açılır ve içindeki diğer reklamlar da yayına girer.` : null;
}

function safeMetaConfig(env: Record<string, string | undefined>): MetaConfig | null {
  try {
    return readMetaConfig(env);
  } catch {
    return null;
  }
}

/** Bağlantıyı Z4 satırına böler: "alan/yol" ve "?sorgu" (protokol gösterilmez). */
export function splitLink(link: string): { value: string; sub: string | null } {
  const noProto = link.replace(/^https?:\/\//, "");
  const q = noProto.indexOf("?");
  return q < 0 ? { value: noProto, sub: null } : { value: noProto.slice(0, q), sub: noProto.slice(q) };
}

/** Reels 72 saat (B1): yayında ve süre dolmamışsa kalan saat (yukarı yuvarlı); aksi halde null. */
export function reelsHoursLeft(content: ContentForAd, now: Date): number | null {
  if (content.kind !== "reels" || content.igPublishStatus !== "yayinda" || !content.igPublishedAt) return null;
  const publishedMs = Date.parse(content.igPublishedAt);
  if (!Number.isFinite(publishedMs)) return null;
  const hours = Math.max(0, (now.getTime() - publishedMs) / HOUR_MS);
  return hours >= REELS_MIN_HOURS ? null : Math.ceil(REELS_MIN_HOURS - hours);
}

function adSourceFor(content: ContentForAd, landing: LandingForAd | null): AdSource | null {
  if (content.kind === "reels") return content.igMediaId ? { kind: "reels", igMediaId: content.igMediaId } : null;
  if (!landing?.imageUrl || !landing.headline || !landing.primaryText) return null;
  return { kind: "sayfa", imageUrl: landing.imageUrl, headline: landing.headline, primaryText: landing.primaryText };
}

/** Z4 bağlamı: içerik, şablon, kurulum, kontroller ve (kurulabiliyorsa) plan. Okuma hatasında `{ error }`. */
export async function buildAdTestContext(
  deps: AdTestContextDeps,
  contentId: string,
  opts: { skip72hReason: string | null },
): Promise<AdTestContext | { error: string }> {
  const { db, store, env, now } = deps;
  try {
    const content = await loadContentForAd(db, contentId);
    if (!content) return { error: MSG_NOT_FOUND };
    if (content.platform !== "instagram") return { error: MSG_NOT_INSTAGRAM };

    const siteBase = siteBaseUrl(env as NodeJS.ProcessEnv);
    const today = istanbulDateString(now);
    const cfg = safeMetaConfig(env);

    const [template, setup, settings, monthSpendTl, studentNames, landing, weekSlug] = await Promise.all([
      store.template(),
      store.setup(),
      getAdSettings(db),
      store.monthMetaSpendTl(today),
      store.activeStudentNames(),
      content.kind === "sayfa" ? loadLandingForAd(db, content.id, siteBase) : Promise.resolve(null),
      content.kind === "reels" ? loadWeekInstagramPageSlug(db, content.code) : Promise.resolve(null),
    ]);

    const [account, gate, testCampaignStatus, testAdsetStatus, activeAds, testAds]: [
      AccountHealth | null,
      { labels: string[] },
      string | null,
      string | null,
      number,
      Awaited<ReturnType<SetupStore["testAdForCode"]>>,
    ] = await Promise.all([
      // Meta yapılandırılmamışsa hiç istek atılmaz; #9 "okunamadı" kırmızısı.
      cfg ? readAccountHealth(cfg, deps.fetchFn) : Promise.resolve(null),
      loadGateStatus(db, now, settings),
      setup ? store.objectStatus("campaign", setup.testCampaignId) : Promise.resolve(null),
      setup ? store.objectStatus("adset", setup.testAdsetId) : Promise.resolve(null),
      setup ? store.activeAdsInAdset(setup.testAdsetId) : Promise.resolve(0),
      setup ? store.testAdForCode(content.code, setup.testAdsetId) : Promise.resolve([]),
    ]);

    // B14: Reels → aynı haftanın Instagram sayfası (yayındaysa) ya da genel sayfa.
    // Sayfa: kendi slug'ı; sayfa okunamadıysa (A öncesi stub) önizleme için içerik kodu kullanılır — #2 zaten kırmızı, plan yok.
    const slug = content.kind === "reels" ? (weekSlug ?? REELS_FALLBACK_SLUG) : (landing?.slug ?? content.code.toLowerCase());
    const name = adName(content.code, content.topic);
    const link = adLink(siteBase, slug, content.code);
    const urlTags = adUrlTags();
    const pageId = env.META_FACEBOOK_PAGE_ID?.trim() || null;
    const igUserId = cfg?.instagramUserId ?? null;

    const cap = monthlyCapCheck({
      monthSpendTl,
      testGunlukTl: template.testGunlukTl,
      buyutmeGunlukTl: template.buyutmeGunlukTl,
      metaTl: settings.monthlyBudget.metaTl,
      today,
    });

    const checklist = runPreflight({
      content,
      landing,
      adName: name,
      link,
      urlTags,
      pixelId: cfg?.pixelId ?? null,
      capiEnabled: cfg?.capiEnabled ?? false,
      template,
      cap,
      banned: settings.banned,
      studentNames,
      account,
      setup,
      testCampaignStatus,
      pageId,
      igUserId,
      now,
      skip72hReason: opts.skip72hReason,
    });

    const hoursLeft = reelsHoursLeft(content, now);
    const linkParts = splitLink(link);
    const excludeParents = template.mevcutVelileriHaricTut && !!setup?.exclusionAudienceId;
    const rows: AdTestRow[] = [
      {
        label: "Kampanya",
        value: TEST_CAMPAIGN_NAME,
        sub: `${formatTl(template.testGunlukTl)}/gün, kampanya bütçesi · ${activeAds} reklam çalışıyor`,
      },
      { label: "Reklam adı", value: name, sub: null },
      {
        label: "Kitle",
        value: `Şeker Anaokulu çevresi ${template.yaricapKm} km`,
        sub: `${template.yasMin}–${template.yasMax} yaş · geniş hedefleme${excludeParents ? " · mevcut veliler hariç" : ""}`,
      },
      {
        label: "Hedef",
        value: "Lead (web formu)",
        sub: "piksel + Conversions API · 7 gün tıklama, 1 gün görüntüleme",
      },
      { label: "Bağlantı", value: linkParts.value, sub: linkParts.sub },
      { label: "Kayıt", value: `Kuran: ${deps.actorName} · eski/yeni değer kayda geçer`, sub: null },
    ];

    const activateCampaign = testCampaignStatus !== "ACTIVE";
    const activateAdset = testAdsetStatus !== "ACTIVE";
    const first = testAds[0] ?? null;
    const view: AdTestView = {
      contentId: content.id,
      code: content.code,
      kind: content.kind,
      topic: content.topic,
      preview:
        content.kind === "reels"
          ? { kind: "reels", caption: content.caption, permalink: content.igPermalink }
          : {
              kind: "sayfa",
              imageUrl: landing?.imageUrl ?? null,
              headline: landing?.headline ?? null,
              primaryText: landing?.primaryText ?? null,
            },
      rows,
      checklist,
      blockText: preflightBlockText(checklist),
      needs72hOverride: hoursLeft !== null,
      hoursLeft,
      gateRed: gate.labels,
      writeEnabled: adsWriteEnabled(env),
      existing: first ? { adId: first.adId, review: reviewLabel(first.effectiveStatus, first.reviewFeedback) } : null,
      // Sette başka reklam yoksa (ilk kurulum) yeniden açılacak bir şey yok; uyarı gösterilmez.
      reactivateWarning: setup && activeAds > 0 ? reactivateWarning(activateCampaign, activateAdset) : null,
    };

    const source = adSourceFor(content, landing);
    let planned: PlannedChange | null = null;
    if (cfg && pageId && source && (source.kind !== "reels" || igUserId)) {
      // I1: kampanyalar kurulmadan da "Sadece göster" Mert'in karşılaştıracağı planı yazar (yer tutucu kimliklerle).
      planned = planAdTest({
        adAccountId: cfg.adAccountId,
        setup: setup ?? PLACEHOLDER_SETUP,
        code: content.code,
        name,
        link,
        urlTags,
        source,
        pageId,
        igUserId,
        activateCampaign,
        activateAdset,
      });
      if (!setup) planned = { steps: planned.steps, summary: [PLACEHOLDER_NOTE, ...planned.summary] };
    }

    return { view, planned, content, setup };
  } catch {
    console.error("[ads] reklam testi bağlamı okunamadı");
    return { error: MSG_READ_FAILED };
  }
}
