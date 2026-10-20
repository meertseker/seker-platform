import { describe, it, expect } from "vitest";
import { buildMarketingReport, type ReportLead } from "@/lib/ads/report";

function lead(overrides: Partial<ReportLead>): ReportLead {
  return { id: crypto.randomUUID(), source: "instagram", gclid: null, utm_campaign: null, status: "yeni", converted_student_id: null, ad_platform: null, ...overrides };
}

describe("buildMarketingReport · iki platform", () => {
  it("meta velisi ve meta harcaması Instagram kampanya satırında birleşir", () => {
    const report = buildMarketingReport(
      [lead({ ad_platform: "meta", utm_campaign: "120001", status: "kazanildi" }), lead({ ad_platform: "meta", utm_campaign: "120001" })],
      new Set(),
      [
        { platform: "meta", campaign_id: "120001", campaign_name: "Yaz Kaydı", cost_micros: 200_000_000 },
        { platform: "meta", campaign_id: "120001", campaign_name: "Yaz Kaydı", cost_micros: 100_000_000 },
      ],
    );
    expect(report.rows[0]).toMatchObject({
      key: "kampanya:meta:120001", kind: "kampanya", platform: "meta", label: "Yaz Kaydı",
      spendKurus: 30_000, leads: 2, kayit: 1, costPerLeadKurus: 15_000,
    });
    expect(report.rows).toHaveLength(1);
  });

  it("aynı kimlikli Google ve Meta kampanyası ayrı satır", () => {
    const report = buildMarketingReport(
      [lead({ source: "reklam", gclid: "g", utm_campaign: "777" }), lead({ ad_platform: "meta", utm_campaign: "777" })],
      new Set(),
      [
        { campaign_id: "777", campaign_name: "Google 777", cost_micros: 10_000_000 },
        { platform: "meta", campaign_id: "777", campaign_name: "Meta 777", cost_micros: 20_000_000 },
      ],
    );
    const keys = report.rows.map((r) => r.key).sort();
    expect(keys).toEqual(["kampanya:777", "kampanya:meta:777"]);
    expect(report.rows.find((r) => r.key === "kampanya:777")).toMatchObject({ leads: 1, spendKurus: 1000 });
    expect(report.rows.find((r) => r.key === "kampanya:777")?.platform).toBeUndefined();
    expect(report.rows.find((r) => r.key === "kampanya:meta:777")).toMatchObject({ leads: 1, spendKurus: 2000, platform: "meta" });
  });

  it("organik instagram velisi kaynak satırında kalır", () => {
    const report = buildMarketingReport([lead({ source: "instagram", ad_platform: null })], new Set(), []);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({ key: "kaynak:instagram", kind: "kaynak" });
  });

  it("kampanyası bilinmeyen meta velisi ayrı etiketle toplanır", () => {
    const report = buildMarketingReport([lead({ ad_platform: "meta" })], new Set(), []);
    expect(report.rows[0]).toMatchObject({ key: "kampanya:meta:bilinmiyor", label: "Instagram · kampanya bilinmiyor", platform: "meta" });
  });

  it("ad_platform google olan veli gclid olmasa da Google reklamı sayılır", () => {
    const report = buildMarketingReport([lead({ source: "reklam", ad_platform: "google", utm_campaign: "42" })], new Set(), []);
    expect(report.rows[0].key).toBe("kampanya:42");
  });
});
