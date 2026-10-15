import { describe, it, expect } from "vitest";
import { parseLocaleNumber, parseSpendCsv } from "@/lib/ads/csv";

describe("parseLocaleNumber", () => {
  it.each([
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["234,5", 234.5],
    ["1.234", 1234],
    ["12.5", 12.5],
    ["₺1.050,00", 1050],
    ["TRY 75,00", 75],
    ["0", 0],
    ["--", null],
    ["", null],
  ])("%s → %s", (raw, expected) => {
    expect(parseLocaleNumber(raw)).toBe(expected);
  });
});

describe("parseSpendCsv", () => {
  it("Türkçe arayüzden indirilen, başlık satırları ve Toplam satırı olan CSV'yi okur", () => {
    const csv = [
      "﻿Kampanya raporu",
      '"1 Ekim 2026 - 13 Ekim 2026"',
      "Gün,Kampanya kimliği,Kampanya,Maliyet,Tıklamalar,Gösterimler",
      '2026-10-12,555,Beylikdüzü,"1.234,56",12,"1.020"',
      "12.10.2026,556,\"Kreş, 2 yaş\",\"75,00\",3,90",
      'Toplam: Hesap,,,"1.309,56",15,"1.110"',
    ].join("\n");

    const { rows, errors } = parseSpendCsv(csv);

    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { date: "2026-10-12", campaignId: "555", campaignName: "Beylikdüzü", costMicros: 1234560000, clicks: 12, impressions: 1020 },
      { date: "2026-10-12", campaignId: "556", campaignName: "Kreş, 2 yaş", costMicros: 75000000, clicks: 3, impressions: 90 },
    ]);
  });

  it("İngilizce, sekmeyle ayrılmış (Excel CSV) dosyayı okur", () => {
    const tsv = [
      "Campaign report",
      "All time",
      "Day\tCampaign ID\tCampaign\tCost\tClicks\tImpr.",
      "2026-10-11\t555\tBeylikdüzü\t10.50\t2\t40",
    ].join("\r\n");
    expect(parseSpendCsv(tsv).rows).toEqual([
      { date: "2026-10-11", campaignId: "555", campaignName: "Beylikdüzü", costMicros: 10500000, clicks: 2, impressions: 40 },
    ]);
  });

  it("Kampanya kimliği kolonu yoksa anlaşılır bir hata döner", () => {
    const { rows, errors } = parseSpendCsv("Gün,Kampanya,Maliyet\n2026-10-12,A,10");
    expect(rows).toEqual([]);
    expect(errors).toEqual([
      "CSV'de şu kolonlar bulunamadı: Gün, Kampanya kimliği, Kampanya, Maliyet. Raporu 'Gün' segmentiyle ve 'Kampanya kimliği' kolonuyla indirin.",
    ]);
  });

  it("maliyeti okunamayan satırı atlar ve satır numarasıyla bildirir", () => {
    const { rows, errors } = parseSpendCsv("Gün,Kampanya kimliği,Kampanya,Maliyet\n2026-10-12,555,A,abc\n2026-10-12,556,B,5");
    expect(rows).toHaveLength(1);
    expect(errors).toEqual(["2. satır: maliyet okunamadı (abc)"]);
  });
});
