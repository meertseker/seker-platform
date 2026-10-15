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

const H = "Gün,Kampanya kimliği,Kampanya,Maliyet,Tıklamalar,Gösterimler";

describe("parseSpendCsv doğrulama ve birleştirme", () => {
  it("aynı (tarih, kampanya) satırlarını toplar ve kampanya adını korur", () => {
    const { rows, errors } = parseSpendCsv(`${H}\n2026-10-12,555,Beylikdüzü,10,2,40\n2026-10-12,555,Beylikdüzü Arama,5.50,1,10`);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { date: "2026-10-12", campaignId: "555", campaignName: "Beylikdüzü", costMicros: 15500000, clicks: 3, impressions: 50 },
    ]);
  });

  it("negatif maliyeti satır numarasıyla reddeder ve diğer satırları yazar", () => {
    const { rows, errors } = parseSpendCsv(`${H}\n2026-10-12,555,A,-5,1,2\n2026-10-12,556,B,5,1,2`);
    expect(rows.map((r) => r.campaignId)).toEqual(["556"]);
    expect(errors).toEqual(["2. satır: negatif değer (-5)"]);
  });

  it("negatif tıklamayı reddeder", () => {
    const { rows, errors } = parseSpendCsv(`${H}\n2026-10-12,555,A,5,-1,2`);
    expect(rows).toEqual([]);
    expect(errors).toEqual(["2. satır: negatif değer (-1)"]);
  });

  it("takvimde olmayan 2026-02-30 tarihini reddeder", () => {
    const { rows, errors } = parseSpendCsv(`${H}\n2026-10-12,555,A,5,1,2\n2026-02-30,556,B,5,1,2`);
    expect(rows.map((r) => r.campaignId)).toEqual(["555"]);
    expect(errors).toEqual(["3. satır: tarih okunamadı (2026-02-30)"]);
  });

  it("tanınmayan tarihi sessizce atlamaz, satır hatası olarak bildirir", () => {
    const { rows, errors } = parseSpendCsv(`${H}\nabc,555,A,5,1,2`);
    expect(rows).toEqual([]);
    expect(errors).toEqual(["2. satır: tarih okunamadı (abc)"]);
  });

  it("d/m/yyyy ve dd/mm/yyyy biçimlerini okur", () => {
    const { rows, errors } = parseSpendCsv(`${H}\n2/5/2026,555,A,5,1,2\n02/05/2026,556,B,5,1,2`);
    expect(errors).toEqual([]);
    expect(rows.map((r) => r.date)).toEqual(["2026-05-02", "2026-05-02"]);
  });

  it("Toplam ve Total satırlarını hata saymadan atlar", () => {
    const { rows, errors } = parseSpendCsv(`${H}\n2026-10-12,555,A,5,1,2\nToplam: Hesap,,,5,1,2\nTotal,,,5,1,2\ntotal: all,,,5,1,2`);
    expect(rows).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  it("kampanya kimliği boş satırı hata saymadan atlar", () => {
    const { rows, errors } = parseSpendCsv(`${H}\n2026-10-12,,A,5,1,2`);
    expect(rows).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("maliyet '--' ise 0 kabul eder", () => {
    const { rows } = parseSpendCsv(`${H}\n2026-10-12,555,A,--,0,0`);
    expect(rows[0].costMicros).toBe(0);
  });

  it("Excel bilimsel gösterimdeki kampanya kimliğini reddeder", () => {
    const { rows, errors } = parseSpendCsv(`${H}\n2026-10-12,1.23E+10,A,5,1,2`);
    expect(rows).toEqual([]);
    expect(errors).toEqual(["2. satır: kampanya kimliği geçersiz (1.23E+10)"]);
  });

  it("satır numaralarını boş satırlar sayılarak ham dosyaya göre verir", () => {
    const { errors } = parseSpendCsv(`${H}\n\n2026-10-12,555,A,abc`);
    expect(errors).toEqual(["3. satır: maliyet okunamadı (abc)"]);
  });
});
