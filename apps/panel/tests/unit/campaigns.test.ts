import { describe, it, expect } from "vitest";
import { DEFAULT_AD_SETTINGS, type AdSettings } from "@/lib/ads/ad-settings";
import {
  budgetPace,
  buildCampaignRows,
  buildKpis,
  cplToneFor,
  type CampaignLead,
  type CampaignObject,
  type CampaignSpendRow,
} from "@/lib/ads/campaigns";

const S: AdSettings = { ...DEFAULT_AD_SETTINGS, monthlyBudget: { googleTl: 20_000, metaTl: 10_000 } };
const TL = 1_000_000;

function spend(o: Partial<CampaignSpendRow> & Pick<CampaignSpendRow, "platform" | "objectId" | "campaignId">): CampaignSpendRow {
  return { level: o.platform === "meta" ? "ad" : "campaign", campaignName: "", adName: null, costMicros: 0, platformResults: null, contentCode: null, ...o };
}

function obj(o: Partial<CampaignObject> & Pick<CampaignObject, "platform" | "level" | "objectId">): CampaignObject {
  return { parentId: null, campaignId: null, name: o.objectId, status: "ENABLED", dailyBudgetMicros: null, contentCode: null, ...o };
}

function lead(o: Partial<CampaignLead>): CampaignLead {
  return {
    source: "instagram", gclid: null, adPlatform: null, utmCampaign: null, contentCode: null,
    isQualified: false, hasAppointment: false, status: "yeni", convertedStudentId: null, ...o,
  };
}

function many(n: number, o: Partial<CampaignLead>): CampaignLead[] {
  return Array.from({ length: n }, () => lead(o));
}

// Prototipteki örnek: bir Google kampanyası, iki Instagram kampanyası (biri kodsuz reklamlı).
const objects: CampaignObject[] = [
  obj({ platform: "google", level: "campaign", objectId: "11", name: "TR_K9_Kres2Yas", status: "ENABLED", dailyBudgetMicros: 250 * TL }),
  obj({ platform: "meta", level: "campaign", objectId: "21", name: "IG_Buyutme", status: "ACTIVE" }),
  obj({ platform: "meta", level: "adset", objectId: "211", parentId: "21", campaignId: "21", status: "ACTIVE", dailyBudgetMicros: 300 * TL }),
  obj({ platform: "meta", level: "ad", objectId: "2111", parentId: "211", campaignId: "21", name: "R-2641-A · Neden 13 kişilik sınıf", status: "ACTIVE", dailyBudgetMicros: 300 * TL, contentCode: "R-2641-A" }),
  obj({ platform: "meta", level: "campaign", objectId: "22", name: "IG_Test", status: "PAUSED" }),
  obj({ platform: "meta", level: "adset", objectId: "221", parentId: "22", campaignId: "22", status: "ACTIVE" }),
  obj({ platform: "meta", level: "ad", objectId: "2211", parentId: "221", campaignId: "22", name: "R-2643-B · Oyunla İngilizce", status: "ACTIVE", contentCode: "R-2643-B" }),
  obj({ platform: "meta", level: "ad", objectId: "2212", parentId: "221", campaignId: "22", name: "Eski görsel", status: "ACTIVE" }),
];

const spendRows: CampaignSpendRow[] = [
  spend({ platform: "google", objectId: "11", campaignId: "11", campaignName: "TR_K9_Kres2Yas", costMicros: 3_000 * TL, platformResults: 4 }),
  spend({ platform: "google", objectId: "11", campaignId: "11", campaignName: "TR_K9_Kres2Yas", costMicros: 2_000 * TL, platformResults: 2 }),
  spend({ platform: "meta", objectId: "2111", campaignId: "21", campaignName: "IG_Buyutme", costMicros: 4_560 * TL, platformResults: 15, contentCode: "R-2641-A" }),
  spend({ platform: "meta", objectId: "2211", campaignId: "22", campaignName: "IG_Test", costMicros: 3_150 * TL, platformResults: 6, contentCode: "R-2643-B" }),
  spend({ platform: "meta", objectId: "2212", campaignId: "22", campaignName: "IG_Test", costMicros: 1_120 * TL, platformResults: 3 }),
];

const leads: CampaignLead[] = [
  // Google: 11 veli, 4 nitelikli → 5.000 / 4 = 1.250 TL (sarı)
  ...many(4, { source: "reklam", gclid: "g", utmCampaign: "11", isQualified: true }),
  ...many(6, { source: "reklam", gclid: "g", utmCampaign: "11" }),
  lead({ source: "web_sitesi", adPlatform: "google", utmCampaign: "11", hasAppointment: true, status: "kazanildi" }),
  // IG_Buyutme: 9 veli, 6 nitelikli → 4.560 / 6 = 760 TL (yeşil)
  ...many(6, { adPlatform: "meta", utmCampaign: "21", contentCode: "R-2641-A", isQualified: true }),
  ...many(2, { adPlatform: "meta", utmCampaign: "21", contentCode: "R-2641-A", status: "randevu" }),
  lead({ adPlatform: "meta", utmCampaign: "21", contentCode: "R-2641-A", convertedStudentId: "s1" }),
  // IG_Test: 4 veli, 1 nitelikli (kodsuz reklamdan) → 4.270 TL (kırmızı); R-2643-B'de nitelikli yok
  ...many(2, { adPlatform: "meta", utmCampaign: "22", contentCode: "R-2643-B" }),
  ...many(1, { adPlatform: "meta", utmCampaign: "22", isQualified: true }),
  // Kampanyası yazılmamış ama kodu tek kampanyaya ait Meta velisi o kampanyaya düşer.
  lead({ adPlatform: "meta", contentCode: "R-2643-B" }),
  // Organik Instagram mesajı maliyete girmez (K10).
  lead({ source: "instagram", utmCampaign: "21", isQualified: true }),
];

describe("buildCampaignRows", () => {
  const rows = buildCampaignRows(spendRows, objects, leads, S);
  const byKey = new Map(rows.map((r) => [r.key, r]));

  it("Google önce, kampanya altında Meta reklam satırları (depth 1)", () => {
    expect(rows.map((r) => [r.key, r.depth])).toEqual([
      ["google:campaign:11", 0],
      ["meta:campaign:21", 0],
      ["meta:ad:2111", 1],
      ["meta:campaign:22", 0],
      ["meta:ad:2211", 1],
      ["meta:ad:2212", 1],
    ]);
  });

  it("Google kampanyası: harcama, veli eşlemesi (utm_campaign), platform sayısı, bütçe", () => {
    expect(byKey.get("google:campaign:11")).toEqual({
      key: "google:campaign:11", platform: "google", level: "campaign", depth: 0, objectId: "11", name: "TR_K9_Kres2Yas",
      status: "yayinda", spendKurus: 500_000, leads: 11, platformResults: 6, qualified: 4, appts: 1, enrolled: 1,
      cplKurus: 125_000, cplTone: "yellow", contentCode: null, unmatched: false, dailyBudgetTl: 250,
      selfPaused: false, parentPaused: false,
    });
  });

  it("Meta kampanyası ve reklamı: kampanya utm_campaign ile, reklam içerik koduyla eşlenir", () => {
    expect(byKey.get("meta:campaign:21")).toMatchObject({
      status: "yayinda", spendKurus: 456_000, leads: 9, platformResults: 15, qualified: 6, appts: 2, enrolled: 1,
      cplKurus: 76_000, cplTone: "green", dailyBudgetTl: null,
    });
    expect(byKey.get("meta:ad:2111")).toMatchObject({
      level: "ad", depth: 1, status: "reklam", name: "R-2641-A · Neden 13 kişilik sınıf", spendKurus: 456_000,
      leads: 9, qualified: 6, cplTone: "green", contentCode: "R-2641-A", unmatched: false, dailyBudgetTl: 300,
    });
  });

  it("kırmızı eşik, nitelikli yok ve kodsuz reklam (K11)", () => {
    expect(byKey.get("meta:campaign:22")).toMatchObject({ spendKurus: 427_000, leads: 4, qualified: 1, cplKurus: 427_000, cplTone: "red" });
    expect(byKey.get("meta:ad:2211")).toMatchObject({ leads: 3, qualified: 0, cplKurus: null, cplTone: "red", unmatched: false });
    expect(byKey.get("meta:ad:2212")).toMatchObject({ leads: 0, contentCode: null, unmatched: true, spendKurus: 112_000 });
  });

  it("durdurulmuş kampanyanın reklamı durduruldu görünür; ham durum korunur", () => {
    expect(byKey.get("meta:campaign:22")).toMatchObject({ status: "durduruldu", selfPaused: true, parentPaused: false });
    expect(byKey.get("meta:ad:2211")).toMatchObject({ status: "durduruldu", selfPaused: false, parentPaused: true });
  });

  it("durdurulmuş reklam seti de alt reklamı durdurur", () => {
    const r = buildCampaignRows(
      [],
      [
        obj({ platform: "meta", level: "campaign", objectId: "5", status: "ACTIVE" }),
        obj({ platform: "meta", level: "adset", objectId: "51", parentId: "5", campaignId: "5", status: "PAUSED" }),
        obj({ platform: "meta", level: "ad", objectId: "511", parentId: "51", campaignId: "5", status: "ACTIVE", contentCode: "R-2600-A" }),
      ],
      [],
      S,
    );
    expect(r.find((x) => x.key === "meta:ad:511")).toMatchObject({ status: "durduruldu", parentPaused: true, selfPaused: false });
    expect(r.find((x) => x.key === "meta:campaign:5")).toMatchObject({ status: "yayinda" });
  });

  it("kampanyası bilinmeyen reklam velisi ayrı satırda, eylemsiz", () => {
    const r = buildCampaignRows([], [], [lead({ source: "reklam", gclid: "g" }), lead({ adPlatform: "meta", isQualified: true })], S);
    expect(r.map((x) => [x.key, x.name, x.leads, x.status, x.objectId])).toEqual([
      ["google:bilinmiyor", "Google · kampanya bilinmiyor", 1, null, ""],
      ["meta:bilinmiyor", "Instagram · kampanya bilinmiyor", 1, null, ""],
    ]);
  });
});

describe("cplToneFor", () => {
  it("yeşil ≤ hedef, sarı ≤ 2× hedef, kırmızı > 2× hedef; nitelikli yok kırmızı", () => {
    expect(cplToneFor(76_000, 1000)).toBe("green");
    expect(cplToneFor(100_000, 1000)).toBe("green");
    expect(cplToneFor(125_000, 1000)).toBe("yellow");
    expect(cplToneFor(200_000, 1000)).toBe("yellow");
    expect(cplToneFor(427_000, 1000)).toBe("red");
    expect(cplToneFor(null, 1000)).toBe("red");
  });
});

describe("buildKpis", () => {
  it("beş kart, alt satır Google · Instagram", () => {
    const rows = buildCampaignRows(spendRows, objects, leads, S);
    expect(buildKpis(rows)).toEqual([
      { label: "Harcama", value: "13.830 TL", sub: "Google 5.000 · Instagram 8.830" },
      { label: "Gelen veli", value: "24", sub: "Google 11 · Instagram 13" },
      { label: "Nitelikli veli", value: "11", sub: "Google 4 · Instagram 7" },
      { label: "Randevu", value: "3", sub: "Google 1 · Instagram 2" },
      { label: "Kayıt", value: "2", sub: "Google 1 · Instagram 1" },
    ]);
  });
});

describe("budgetPace", () => {
  it("ayın %61'i geçmişken harcama %67: Instagram hızlı, Google değil", () => {
    const p = budgetPace({ google: 1_120_000, meta: 883_000 }, S, "2026-10-19");
    expect(p).toEqual({
      totalTl: 30_000, spentTl: 20_030, pctSpent: 67, pctMonth: 61,
      perPlatform: [
        { label: "Google", spentTl: 11_200, budgetTl: 20_000, pct: 56, fast: false },
        { label: "Instagram", spentTl: 8_830, budgetTl: 10_000, pct: 88, fast: true },
      ],
    });
  });

  it("bütçe girilmemişse toplam 0, yüzde 0, hızlı yok", () => {
    const p = budgetPace({ google: 50_000, meta: 0 }, DEFAULT_AD_SETTINGS, "2026-10-19");
    expect(p).toMatchObject({ totalTl: 0, spentTl: 500, pctSpent: 0 });
    expect(p.perPlatform.every((x) => !x.fast)).toBe(true);
  });
});
