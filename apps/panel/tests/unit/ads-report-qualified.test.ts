import { describe, it, expect } from "vitest";
import { buildMarketingReport, type ReportLead } from "@/lib/ads/report";

function lead(overrides: Partial<ReportLead>): ReportLead {
  return { id: crypto.randomUUID(), source: "reklam", gclid: null, utm_campaign: null, status: "yeni", converted_student_id: null, ...overrides };
}

describe("buildMarketingReport · nitelikli veli", () => {
  it("kampanya satırında nitelikli veli ve nitelikli veli başı maliyet", () => {
    const report = buildMarketingReport(
      [
        lead({ gclid: "g1", utm_campaign: "555", is_qualified: true }),
        lead({ gclid: "g2", utm_campaign: "555", is_qualified: true }),
        lead({ gclid: "g3", utm_campaign: "555", is_qualified: false }),
        lead({ gclid: "g4", utm_campaign: "555" }),
      ],
      new Set(),
      [{ campaign_id: "555", campaign_name: "Beylikdüzü", cost_micros: 1_000_000_000 }],
    );
    expect(report.rows[0]).toMatchObject({ key: "kampanya:555", leads: 4, qualified: 2, costPerQualifiedKurus: 50_000 });
  });

  it("nitelikli yoksa ya da harcama yoksa maliyet boş", () => {
    const report = buildMarketingReport(
      [lead({ gclid: "g", utm_campaign: "1" }), lead({ source: "referans", is_qualified: true })],
      new Set(),
      [{ campaign_id: "1", campaign_name: "K", cost_micros: 100_000_000 }],
    );
    expect(report.rows.find((r) => r.key === "kampanya:1")).toMatchObject({ qualified: 0, costPerQualifiedKurus: null });
    expect(report.rows.find((r) => r.key === "kaynak:referans")).toMatchObject({ qualified: 1, costPerQualifiedKurus: null });
  });

  it("toplamda nitelikli veli başı yalnız reklam satırlarının nitelikli velisine bölünür", () => {
    const report = buildMarketingReport(
      [
        lead({ gclid: "g", utm_campaign: "1", is_qualified: true }),
        lead({ ad_platform: "meta", source: "instagram", utm_campaign: "9", is_qualified: true }),
        lead({ source: "referans", is_qualified: true }),
      ],
      new Set(),
      [
        { campaign_id: "1", campaign_name: "G", cost_micros: 100_000_000 },
        { platform: "meta", campaign_id: "9", campaign_name: "M", cost_micros: 300_000_000 },
      ],
    );
    expect(report.total).toMatchObject({ qualified: 3, spendKurus: 40_000, costPerQualifiedKurus: 20_000 });
  });
});
