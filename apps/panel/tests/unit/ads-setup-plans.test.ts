import { describe, it, expect } from "vitest";
import { DEFAULT_AD_TEMPLATE, type AdTemplate } from "@/lib/ads/ad-template";
import type { AdSetup } from "@/lib/ads/ad-setup";
import { ref, type SetupStep } from "@/lib/ads/meta/setup";
import {
  adLink,
  adName,
  adUrlTags,
  planAdTest,
  planCampaignSetup,
  planMoveToScale,
  REELS_FALLBACK_SLUG,
  type PlannedChange,
} from "@/lib/ads/setup-plans";

const template: AdTemplate = {
  ...DEFAULT_AD_TEMPLATE,
  okulAdres: "Atatürk Cad. 12, Kadıköy",
  lat: 40.99,
  lng: 29.03,
};

const setup: AdSetup = {
  testCampaignId: "1001",
  testAdsetId: "1002",
  scaleCampaignId: "2001",
  scaleAdsetId: "2002",
  exclusionAudienceId: null,
  createdAt: "2026-10-23T10:00:00Z",
  createdBy: "Mert",
};

const LINK = adLink("https://yeni.sekeranaokulu.com", "ilk-hafta-uyum", "R-2644-A");

function keys(p: PlannedChange): string[] {
  return p.steps.map((s) => s.key);
}

function pathText(s: SetupStep): string {
  return typeof s.path === "string" ? s.path : `$ref:${s.path.ref}${s.path.suffix}`;
}

/** Özet satırlarında anahtar, hash ya da gizli değer olmamalı. */
function expectCleanSummary(p: PlannedChange) {
  for (const line of p.summary) {
    expect(line).not.toMatch(/token|appsecret|proof|access/i);
    expect(line).not.toMatch(/[0-9a-f]{32,}/i);
    expect(line).not.toMatch(/\{\{|\$ref/);
  }
}

describe("adName", () => {
  it("kod · konu", () => {
    expect(adName("R-2644-A", "İlk hafta uyum")).toBe("R-2644-A · İlk hafta uyum");
  });

  it("uzun konuda 100 karakterde kesilir ve kodla başlar", () => {
    const name = adName("R-2644-A", "x".repeat(300));
    expect(name).toHaveLength(100);
    expect(name.startsWith("R-2644-A · ")).toBe(true);
  });
});

describe("adLink / adUrlTags", () => {
  it("sondaki / atılır, utm etiketleri bağlantıda", () => {
    expect(adLink("https://yeni.sekeranaokulu.com/", "ilk-hafta-uyum", "R-2644-A")).toBe(
      "https://yeni.sekeranaokulu.com/lp/ilk-hafta-uyum?utm_source=instagram&utm_medium=paid_social&utm_content=R-2644-A",
    );
  });

  it("url_tags yalnız kampanya kimliği", () => {
    expect(adUrlTags()).toBe("utm_campaign={{campaign.id}}");
  });

  it("Reels yedek sayfası", () => {
    expect(REELS_FALLBACK_SLUG).toBe("az-mevcutlu-anaokulu");
  });
});

describe("planCampaignSetup", () => {
  const plan = planCampaignSetup({ adAccountId: "act_123", pixelId: "555", template, excludedAudienceId: null });

  it("4 adım, sıra test kampanya/set, büyütme kampanya/set", () => {
    expect(keys(plan)).toEqual(["testCampaign", "testAdset", "scaleCampaign", "scaleAdset"]);
    expect(plan.steps.map((s) => s.params.name)).toEqual([
      "Test · Instagram",
      "Test · Okul çevresi 8 km",
      "Büyütme · Instagram",
      "Büyütme · Okul çevresi 8 km",
    ]);
  });

  it("setler kendi kampanyasına ref ile bağlanır; bütçeler kuruş", () => {
    expect(plan.steps[1].params.campaign_id).toEqual(ref("testCampaign"));
    expect(plan.steps[3].params.campaign_id).toEqual(ref("scaleCampaign"));
    expect(plan.steps[0].params.daily_budget).toBe(20000);
    expect(plan.steps[2].params.daily_budget).toBe(40000);
    for (const s of plan.steps) expect(s.params.status).toBe("PAUSED");
  });

  it("özet satırları", () => {
    expect(plan.summary).toEqual([
      "Kampanya: Test · Instagram · 200 TL/gün · DURAKLATILMIŞ",
      "Reklam seti: okul çevresi 8 km · 25–45 yaş · Lead (web formu) · 7 gün tıklama, 1 gün görüntüleme",
      "Kampanya: Büyütme · Instagram · 400 TL/gün · DURAKLATILMIŞ",
      "Reklam seti: okul çevresi 8 km · 25–45 yaş · Lead (web formu) · 7 gün tıklama, 1 gün görüntüleme",
    ]);
    expectCleanSummary(plan);
  });

  it("dışlama kitlesi varsa iki sete de girer ve özette görünür", () => {
    const p = planCampaignSetup({ adAccountId: "act_123", pixelId: "555", template, excludedAudienceId: "777" });
    for (const s of [p.steps[1], p.steps[3]]) {
      expect((s.params.targeting as Record<string, unknown>).excluded_custom_audiences).toEqual([{ id: "777" }]);
    }
    expect(p.summary).toContain("Mevcut veliler hariç");
    expect(plan.summary).not.toContain("Mevcut veliler hariç");
  });
});

describe("planAdTest", () => {
  const base = {
    adAccountId: "act_123",
    setup,
    code: "R-2644-A",
    name: "R-2644-A · İlk hafta uyum",
    link: LINK,
    urlTags: adUrlTags(),
    pageId: "9001",
    igUserId: "9002",
  };

  it("Reels, kampanya/set açık: creative, ad, activateAd", () => {
    const p = planAdTest({
      ...base,
      source: { kind: "reels", igMediaId: "1789" },
      activateCampaign: false,
      activateAdset: false,
    });
    expect(keys(p)).toEqual(["creative", "ad", "activateAd"]);
    const creative = p.steps[0];
    expect(creative.params.source_instagram_media_id).toBe("1789");
    expect(creative.params.instagram_user_id).toBe("9002");
    expect(creative.params.url_tags).toBe("utm_campaign={{campaign.id}}");
    expect(creative.params.call_to_action).toEqual({ type: "LEARN_MORE", value: { link: LINK } });
    const ad = p.steps[1];
    expect(ad.params.adset_id).toBe("1002");
    expect(ad.params.status).toBe("PAUSED");
    expect(ad.params.creative).toEqual({ creative_id: ref("creative") });
    expect(ad.params.name).toBe("R-2644-A · İlk hafta uyum");
    const last = p.steps[2];
    expect(last.path).toEqual({ ref: "ad", suffix: "" });
    expect(last.params).toEqual({ status: "ACTIVE" });
    expect(p.summary).toEqual([
      `Kreatif: Instagram gönderisi 1789 · düğme Daha fazla bilgi → ${LINK}`,
      "Reklam: R-2644-A · İlk hafta uyum → Test · Instagram (reklam seti 1002), önce DURAKLATILMIŞ",
      "Reklam açılır (ACTIVE)",
    ]);
    expectCleanSummary(p);
  });

  it("PAUSED kampanya/sette önce onlar açılır; kampanya ya da set kurulmaz", () => {
    const p = planAdTest({
      ...base,
      source: { kind: "reels", igMediaId: "1789" },
      activateCampaign: true,
      activateAdset: true,
    });
    expect(keys(p)).toEqual(["creative", "ad", "activateCampaign", "activateAdset", "activateAd"]);
    expect(p.steps[2].path).toBe("1001");
    expect(p.steps[2].params).toEqual({ status: "ACTIVE" });
    expect(p.steps[3].path).toBe("1002");
    expect(p.steps[3].params).toEqual({ status: "ACTIVE" });
    for (const s of p.steps) expect(pathText(s)).not.toMatch(/\/(campaigns|adsets)$/);
    expect(p.summary).toContain("Test kampanyası açılır");
    expect(p.summary).toContain("Test reklam seti açılır");
    expect(p.summary[p.summary.length - 1]).toBe("Reklam açılır (ACTIVE)");
  });

  it("sayfa reklamı bağlantı kreatifi kurar", () => {
    const p = planAdTest({
      ...base,
      source: {
        kind: "sayfa",
        imageUrl: "https://yeni.sekeranaokulu.com/media/a.webp",
        headline: "İlk hafta uyum",
        primaryText: "Uyum haftası nasıl geçer?",
      },
      activateCampaign: false,
      activateAdset: false,
    });
    expect(keys(p)).toEqual(["creative", "ad", "activateAd"]);
    const spec = p.steps[0].params.object_story_spec as Record<string, unknown>;
    expect(spec.page_id).toBe("9001");
    expect(spec.link_data).toMatchObject({
      link: LINK,
      name: "İlk hafta uyum",
      message: "Uyum haftası nasıl geçer?",
      picture: "https://yeni.sekeranaokulu.com/media/a.webp",
    });
    expect(p.summary[0]).toBe(`Kreatif: sayfa görseli + "İlk hafta uyum" + "Uyum haftası nasıl geçer?" → ${LINK}`);
    for (const s of p.steps) expect(pathText(s)).not.toMatch(/\/(campaigns|adsets)$/);
  });

  it("Reels için Instagram hesabı kimliği şart", () => {
    expect(() =>
      planAdTest({
        ...base,
        igUserId: null,
        source: { kind: "reels", igMediaId: "1789" },
        activateCampaign: false,
        activateAdset: false,
      }),
    ).toThrow(/Instagram hesabı/);
  });
});

describe("planMoveToScale", () => {
  it("kopya büyütme setine, açılır, Test reklamı durur", () => {
    const p = planMoveToScale({
      setup,
      testAdId: "3001",
      adName: "R-2644-A · İlk hafta uyum",
      activateCampaign: false,
      activateAdset: false,
    });
    expect(keys(p)).toEqual(["copy", "activateCopy", "pauseTest"]);
    expect(p.steps[0].path).toBe("3001/copies");
    expect(p.steps[0].params.adset_id).toBe("2002");
    expect(p.steps[0].result).toBe("copied_ad_id");
    expect(p.steps[1].path).toEqual({ ref: "copy", suffix: "" });
    expect(p.steps[1].params).toEqual({ status: "ACTIVE" });
    const last = p.steps[p.steps.length - 1];
    expect(last.path).toBe("3001");
    expect(last.params).toEqual({ status: "PAUSED" });
    expect(p.summary).toEqual([
      "Kopya: R-2644-A · İlk hafta uyum → Büyütme · Instagram",
      "Kopya açılır",
      "Test'teki reklam durur",
    ]);
    expectCleanSummary(p);
  });

  it("büyütme kampanya/seti PAUSED ise önce açılır", () => {
    const p = planMoveToScale({
      setup,
      testAdId: "3001",
      adName: "R-2644-A · İlk hafta uyum",
      activateCampaign: true,
      activateAdset: true,
    });
    expect(keys(p)).toEqual(["copy", "activateCampaign", "activateAdset", "activateCopy", "pauseTest"]);
    expect(p.steps[1].path).toBe("2001");
    expect(p.steps[2].path).toBe("2002");
    expect(p.summary).toContain("Büyütme kampanyası açılır");
    expect(p.summary).toContain("Büyütme reklam seti açılır");
  });
});
