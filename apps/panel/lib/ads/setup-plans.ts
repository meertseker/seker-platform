// Reklam kurulum planları (K18, §4) ve "Panel şunu kuracaktı" özeti (B5).
// Saf: yalnız gönderilecek adımları ve Türkçe özet satırlarını üretir; Meta'ya gitmez, "şimdi"yi okumaz.
// Özet satırları kimlik taşıyabilir (Meta nesne kimliği), erişim anahtarı / hash / şablon belirteci taşımaz.
import { formatTl } from "@/lib/content/board";
import type { AdSetup } from "./ad-setup";
import type { AdTemplate } from "./ad-template";
import { createExclusionAudience } from "./meta/audiences";
import {
  copyAdToAdset,
  createAd,
  createAdSet,
  createCampaign,
  createLinkCreative,
  createReelCreative,
  ref,
  setObjectStatus,
  type SetupStep,
} from "./meta/setup";

export type PlannedChange = { steps: SetupStep[]; summary: string[] };

export const TEST_CAMPAIGN_NAME = "Test · Instagram";
export const SCALE_CAMPAIGN_NAME = "Büyütme · Instagram";

/**
 * Kampanyalar henüz kurulmadıysa "Sadece göster" planı bu yer tutucularla yazılır (I1): ilk hafta Mert'in
 * karşılaştıracağı kayıt satırı oluşur. Kimlik biçiminde değildir; Meta'ya gidemez (runSetupSteps yolu reddeder)
 * ve "kur" kurulum olmadan zaten reddedilir.
 */
export const PLACEHOLDER_SETUP: AdSetup = {
  testCampaignId: "(Test kampanyası · henüz kurulmadı)",
  testAdsetId: "(Test reklam seti · henüz kurulmadı)",
  scaleCampaignId: "(Büyütme kampanyası · henüz kurulmadı)",
  scaleAdsetId: "(Büyütme reklam seti · henüz kurulmadı)",
  exclusionAudienceId: null,
  createdAt: "",
  createdBy: "",
};

/** B10 genel sayfası: haftanın Instagram sayfası yayında değilse Reels reklamı buraya gider. */
export const REELS_FALLBACK_SLUG = "az-mevcutlu-anaokulu";

const AD_NAME_MAX = 100;

/** Reklam adı `"<kod> · <konu>"`, en çok 100 karakter; her zaman kodla başlar. */
export function adName(code: string, topic: string): string {
  const t = topic.trim();
  const name = t ? `${code} · ${t}` : code;
  return name.slice(0, AD_NAME_MAX);
}

/** Reklam bağlantısı; utm_source/medium/content bağlantının kendisinde (B13). */
export function adLink(siteBase: string, slug: string, code: string): string {
  const base = siteBase.replace(/\/+$/, "");
  return (
    `${base}/lp/${encodeURIComponent(slug)}` +
    `?utm_source=instagram&utm_medium=paid_social&utm_content=${encodeURIComponent(code)}`
  );
}

/** Kreatifin `url_tags`'i: yalnız kampanya kimliği (Kampanyalar ekranı kimlikle eşler). */
export function adUrlTags(): string {
  return "utm_campaign={{campaign.id}}";
}

function perDay(tl: number): string {
  return `${formatTl(tl)}/gün`;
}

function adsetSummary(t: AdTemplate): string {
  return (
    `Reklam seti: okul çevresi ${t.yaricapKm} km · ${t.yasMin}–${t.yasMax} yaş · Lead (web formu) · ` +
    "7 gün tıklama, 1 gün görüntüleme"
  );
}

/**
 * Tek seferlik kurulum: Test ve Büyütme kampanyaları, her birinde tek reklam seti; hepsi PAUSED.
 * `createAudience` (şablonda "mevcut velileri hariç tut" açık, kitle henüz yok): önce boş dışlama kitlesi kurulur,
 * iki set ona `ref` ile bağlanır; telefonlar ayrı adımda (kitle güncellemesi) yüklenir.
 */
export function planCampaignSetup(i: {
  adAccountId: string;
  pixelId: string;
  template: AdTemplate;
  excludedAudienceId: string | null;
  createAudience?: boolean;
}): PlannedChange {
  const t = i.template;
  const area = `Okul çevresi ${t.yaricapKm} km`;
  const newAudience = i.createAudience === true && i.excludedAudienceId === null;
  const excluded = newAudience ? ref("audience") : i.excludedAudienceId;
  const steps: SetupStep[] = [
    ...(newAudience ? [createExclusionAudience(i.adAccountId, "audience")] : []),
    createCampaign(i.adAccountId, { key: "testCampaign", name: TEST_CAMPAIGN_NAME, dailyBudgetTl: t.testGunlukTl }),
    createAdSet(i.adAccountId, {
      key: "testAdset",
      name: `Test · ${area}`,
      campaign: ref("testCampaign"),
      pixelId: i.pixelId,
      template: t,
      excludedAudience: excluded,
    }),
    createCampaign(i.adAccountId, {
      key: "scaleCampaign",
      name: SCALE_CAMPAIGN_NAME,
      dailyBudgetTl: t.buyutmeGunlukTl,
    }),
    createAdSet(i.adAccountId, {
      key: "scaleAdset",
      name: `Büyütme · ${area}`,
      campaign: ref("scaleCampaign"),
      pixelId: i.pixelId,
      template: t,
      excludedAudience: excluded,
    }),
  ];
  const summary = [
    `Kampanya: ${TEST_CAMPAIGN_NAME} · ${perDay(t.testGunlukTl)} · DURAKLATILMIŞ`,
    adsetSummary(t),
    `Kampanya: ${SCALE_CAMPAIGN_NAME} · ${perDay(t.buyutmeGunlukTl)} · DURAKLATILMIŞ`,
    adsetSummary(t),
  ];
  if (newAudience) summary.push("Özel Hedef Kitle: Mevcut veliler (panel) · telefonlar SHA-256 ile ayrıca yüklenir");
  if (excluded !== null) summary.push("Mevcut veliler hariç");
  return { steps, summary };
}

export type AdSource =
  | { kind: "reels"; igMediaId: string }
  | { kind: "sayfa"; imageUrl: string; headline: string; primaryText: string };

/**
 * "Teste al" (§4): yalnız kreatif + reklam ekler; kampanya ve set tek seferlik kurulumdan gelir.
 * Reklam PAUSED kurulur; Test kampanyası/seti PAUSED ise açılır; son adımda reklam ACTIVE.
 */
export function planAdTest(i: {
  adAccountId: string;
  setup: AdSetup;
  code: string;
  name: string;
  link: string;
  urlTags: string;
  source: AdSource;
  pageId: string;
  igUserId: string | null;
  activateCampaign: boolean;
  activateAdset: boolean;
}): PlannedChange {
  const steps: SetupStep[] = [];
  const summary: string[] = [];

  if (i.source.kind === "reels") {
    if (!i.igUserId) throw new Error("Instagram hesabı kimliği yok; Reels reklamı kurulamaz");
    steps.push(
      createReelCreative(i.adAccountId, {
        key: "creative",
        name: i.name,
        pageId: i.pageId,
        igUserId: i.igUserId,
        igMediaId: i.source.igMediaId,
        link: i.link,
        urlTags: i.urlTags,
      }),
    );
    summary.push(`Kreatif: Instagram gönderisi ${i.source.igMediaId} · düğme Daha fazla bilgi → ${i.link}`);
  } else {
    steps.push(
      createLinkCreative(i.adAccountId, {
        key: "creative",
        name: i.name,
        pageId: i.pageId,
        igUserId: i.igUserId,
        imageUrl: i.source.imageUrl,
        message: i.source.primaryText,
        headline: i.source.headline,
        link: i.link,
        urlTags: i.urlTags,
      }),
    );
    summary.push(`Kreatif: sayfa görseli + "${i.source.headline}" + "${i.source.primaryText}" → ${i.link}`);
  }

  steps.push(createAd(i.adAccountId, { key: "ad", name: i.name, adsetId: i.setup.testAdsetId, creative: ref("creative") }));
  summary.push(`Reklam: ${i.name} → ${TEST_CAMPAIGN_NAME} (reklam seti ${i.setup.testAdsetId}), önce DURAKLATILMIŞ`);

  if (i.activateCampaign) {
    steps.push(
      setObjectStatus({
        key: "activateCampaign",
        objectId: i.setup.testCampaignId,
        status: "ACTIVE",
        label: "Test kampanyasını aç",
      }),
    );
    summary.push("Test kampanyası açılır");
  }
  if (i.activateAdset) {
    steps.push(
      setObjectStatus({
        key: "activateAdset",
        objectId: i.setup.testAdsetId,
        status: "ACTIVE",
        label: "Test reklam setini aç",
      }),
    );
    summary.push("Test reklam seti açılır");
  }

  steps.push(setObjectStatus({ key: "activateAd", objectId: ref("ad"), status: "ACTIVE", label: "Reklamı aç" }));
  summary.push("Reklam açılır (ACTIVE)");
  return { steps, summary };
}

/**
 * "Büyütmeye taşı": Test reklamı Büyütme setine DURAKLATILMIŞ kopyalanır, Test'teki durur, sonra (gerekirse
 * Büyütme kampanyası/seti ve) kopya açılır. Sıra bilerek böyle: durdurma patlarsa hiçbir şey açılmamıştır;
 * açma patlarsa iki reklam aynı anda harcamaz.
 */
export function planMoveToScale(i: {
  setup: AdSetup;
  testAdId: string;
  adName: string;
  activateCampaign: boolean;
  activateAdset: boolean;
}): PlannedChange {
  const steps: SetupStep[] = [
    copyAdToAdset({ key: "copy", adId: i.testAdId, adsetId: i.setup.scaleAdsetId }),
    setObjectStatus({ key: "pauseTest", objectId: i.testAdId, status: "PAUSED", label: "Test'teki reklamı durdur" }),
  ];
  const summary: string[] = [`Kopya: ${i.adName} → ${SCALE_CAMPAIGN_NAME}`, "Test'teki reklam durur"];

  if (i.activateCampaign) {
    steps.push(
      setObjectStatus({
        key: "activateCampaign",
        objectId: i.setup.scaleCampaignId,
        status: "ACTIVE",
        label: "Büyütme kampanyasını aç",
      }),
    );
    summary.push("Büyütme kampanyası açılır");
  }
  if (i.activateAdset) {
    steps.push(
      setObjectStatus({
        key: "activateAdset",
        objectId: i.setup.scaleAdsetId,
        status: "ACTIVE",
        label: "Büyütme reklam setini aç",
      }),
    );
    summary.push("Büyütme reklam seti açılır");
  }

  steps.push(setObjectStatus({ key: "activateCopy", objectId: ref("copy"), status: "ACTIVE", label: "Kopyayı aç" }));
  summary.push("Kopya açılır");
  return { steps, summary };
}
