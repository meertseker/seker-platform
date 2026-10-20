import { describe, it, expect } from "vitest";
import { buildMarketingReport, normalizeRange, type ReportLead } from "@/lib/ads/report";

function lead(overrides: Partial<ReportLead>): ReportLead {
  return { id: crypto.randomUUID(), source: "reklam", gclid: null, utm_campaign: null, status: "yeni", converted_student_id: null, ...overrides };
}

describe("buildMarketingReport", () => {
  it("reklam adaylarını kampanya ID'siyle eşler, maliyetleri kuruş hesaplar", () => {
    const a1 = lead({ gclid: "g1", utm_campaign: "555", status: "kazanildi" });
    const a2 = lead({ gclid: "g2", utm_campaign: "555", status: "randevu" });
    const report = buildMarketingReport(
      [a1, a2],
      new Set(),
      [
        { campaign_id: "555", campaign_name: "Beylikdüzü", cost_micros: 600_000_000 },
        { campaign_id: "555", campaign_name: "Beylikdüzü", cost_micros: 400_000_000 },
      ],
    );
    expect(report.rows[0]).toEqual({
      key: "kampanya:555", kind: "kampanya", label: "Beylikdüzü",
      spendKurus: 100_000, leads: 2, randevu: 2, kayit: 1, qualified: 0,
      costPerLeadKurus: 50_000, costPerKayitKurus: 100_000, costPerQualifiedKurus: null,
    });
  });

  it("kampanya ID'si yoksa bilinmiyor satırına; harcaması olmayan ID'li adayı kendi kampanya satırına koyar", () => {
    const report = buildMarketingReport([lead({ gclid: "g", utm_campaign: null }), lead({ gclid: "g", utm_campaign: "999" })], new Set(), []);
    expect(report.rows).toHaveLength(2);
    expect(report.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "kampanya:bilinmiyor", label: "Google Ads · kampanya bilinmiyor", leads: 1, spendKurus: 0, costPerLeadKurus: null }),
      expect.objectContaining({ key: "kampanya:999", kind: "kampanya", label: "999", leads: 1, spendKurus: 0 }),
    ]));
  });

  it("mikro maliyeti tam sayı olarak toplar, kuruşa bir kez çevirir", () => {
    const report = buildMarketingReport([], new Set(), [
      { campaign_id: "1", campaign_name: "A", cost_micros: 3_333_333 },
      { campaign_id: "1", campaign_name: "A", cost_micros: 3_333_333 },
      { campaign_id: "1", campaign_name: "A", cost_micros: 3_333_333 },
    ]);
    expect(report.rows[0].spendKurus).toBe(1000);
  });

  it("web_sitesi kaynaklı, gclid'li ve utm_campaign'siz aday kampanya:bilinmiyor satırına düşer", () => {
    const report = buildMarketingReport([lead({ source: "web_sitesi", gclid: "g", utm_campaign: null })], new Set(), []);
    expect(report.rows).toEqual([
      expect.objectContaining({ key: "kampanya:bilinmiyor", leads: 1 }),
    ]);
  });

  it("harcaması olup adayı olmayan kampanyayı da gösterir", () => {
    const report = buildMarketingReport([], new Set(), [{ campaign_id: "1", campaign_name: "Kreş 2 yaş", cost_micros: 50_000_000 }]);
    expect(report.rows).toEqual([
      expect.objectContaining({ key: "kampanya:1", leads: 0, spendKurus: 5_000, costPerLeadKurus: null, costPerKayitKurus: null }),
    ]);
  });

  it("reklamsız kaynakları kaynak etiketiyle gruplar; randevu kaydı olan adayı randevu sayar", () => {
    const withAppt = lead({ source: "instagram", status: "ulasildi" });
    const report = buildMarketingReport(
      [withAppt, lead({ source: "instagram" }), lead({ source: "referans", converted_student_id: "s1", status: "kazanildi" })],
      new Set([withAppt.id]),
      [],
    );
    expect(report.rows.map((r) => [r.key, r.label, r.leads, r.randevu, r.kayit])).toEqual([
      ["kaynak:instagram", "Instagram", 2, 1, 0],
      ["kaynak:referans", "Referans", 1, 1, 1],
    ]);
  });

  it("kampanyalar harcamaya, kaynaklar aday sayısına göre sıralanır; toplam satırı doğru", () => {
    const report = buildMarketingReport(
      [lead({ gclid: "g", utm_campaign: "1" }), lead({ source: "telefon" }), lead({ source: "referans" }), lead({ source: "referans" })],
      new Set(),
      [
        { campaign_id: "1", campaign_name: "Küçük", cost_micros: 10_000_000 },
        { campaign_id: "2", campaign_name: "Büyük", cost_micros: 90_000_000 },
      ],
    );
    expect(report.rows.map((r) => r.key)).toEqual(["kampanya:2", "kampanya:1", "kaynak:referans", "kaynak:telefon"]);
    expect(report.total).toEqual(expect.objectContaining({ label: "Toplam", spendKurus: 10_000, leads: 4, costPerLeadKurus: 10_000, costPerKayitKurus: null }));
  });

  it("toplam satırında aday/kayıt başı maliyet yalnızca reklam (kampanya) satırlarına bölünür", () => {
    const report = buildMarketingReport(
      [
        lead({ gclid: "g", utm_campaign: "1", status: "kazanildi" }),
        lead({ gclid: "g", utm_campaign: "1" }),
        lead({ source: "referans", status: "kazanildi" }),
        lead({ source: "telefon" }),
      ],
      new Set(),
      [{ campaign_id: "1", campaign_name: "K", cost_micros: 100_000_000 }],
    );
    expect(report.total).toEqual(expect.objectContaining({ leads: 4, kayit: 2, spendKurus: 10_000, costPerLeadKurus: 5_000, costPerKayitKurus: 10_000 }));
  });
});

describe("normalizeRange", () => {
  it("parametre yoksa son 30 günü döner", () => {
    expect(normalizeRange(undefined, undefined, "2026-10-14")).toEqual({ from: "2026-09-15", to: "2026-10-14" });
  });
  it("ters verilen aralığı düzeltir", () => {
    expect(normalizeRange("2026-10-10", "2026-10-01", "2026-10-14")).toEqual({ from: "2026-10-01", to: "2026-10-10" });
  });
  it("bozuk tarihte varsayılana döner", () => {
    expect(normalizeRange("dün", "2026-10-10", "2026-10-14")).toEqual({ from: "2026-09-15", to: "2026-10-14" });
  });
  it("imkansız takvim tarihinde varsayılana döner", () => {
    expect(normalizeRange("2026-02-31", "2026-10-10", "2026-10-14")).toEqual({ from: "2026-09-15", to: "2026-10-14" });
  });
  it("366 günden uzun aralığı başlangıçtan kırpar", () => {
    expect(normalizeRange("2024-01-01", "2026-10-14", "2026-10-14")).toEqual({ from: "2025-10-14", to: "2026-10-14" });
  });
});
