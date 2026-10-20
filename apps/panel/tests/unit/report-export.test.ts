import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { buildReport, type Report } from "@/lib/report/build";
import { headerOf, reportFile, safeText, tablesToCsv } from "@/lib/report/export";
import { resolvePeriod } from "@/lib/report/period";
import { col, type ReportTable } from "@/lib/report/table";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/lead-flow/business-hours";

const table: ReportTable = {
  id: "t",
  title: "Deneme",
  columns: [col("ad", "Ad", "text"), col("tutar", "Harcama", "tl"), col("oran", "Oran", "pct"), col("adet", "Adet")],
  rows: [
    { ad: "=HYPERLINK(\"x\")", tutar: 123456, oran: 0.4256, adet: 1200 },
    { ad: "Beylikdüzü; kreş", tutar: null, oran: null, adet: 0 },
  ],
  total: { ad: "Toplam", tutar: 123456, oran: null, adet: 1200 },
};

function emptyReport(role: "yonetici" | "danisman"): Report {
  return buildReport({
    now: new Date("2026-10-20T09:00:00Z"),
    period: resolvePeriod({}, "2026-10-20"),
    hours: DEFAULT_BUSINESS_HOURS,
    viewer: { id: "u", role },
    leads: [],
    appts: [],
    offers: [],
    events: [],
    profiles: [],
    openTasks: [],
    students: [],
    capacities: [],
    manager:
      role === "yonetici"
        ? {
            installments: [],
            overdue: [],
            refunds: [],
            spend: [],
            activeCampaigns: null,
            adsConnected: { google: false, meta: false },
            visits: [],
            content: [],
            wa: [],
            uploads: [],
            pendingOffers: 0,
          }
        : null,
  });
}

describe("CSV", () => {
  const csv = tablesToCsv([table], ["Başlık"]);

  it("UTF-8 BOM, noktalı virgül, ondalık virgül, birimli başlık", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("Başlık");
    expect(lines[3]).toBe("Ad;Harcama (₺);Oran (%);Adet");
    expect(lines[4]).toBe(`"'=HYPERLINK(""x"")";1234,56;42,6;1200`);
    expect(lines[5]).toBe('"Beylikdüzü; kreş";;;0');
    expect(lines[6]).toBe("Toplam;1234,56;;1200");
  });

  it("formül gibi başlayan metin etkisizleşir", () => {
    expect(safeText("=1+1")).toBe("'=1+1");
    expect(safeText("-5")).toBe("'-5");
    expect(safeText("anaokulu")).toBe("anaokulu");
    expect(headerOf(col("x", "Süre", "minutes"))).toBe("Süre (dk)");
  });
});

describe("Excel", () => {
  it("tüm rapor: bölüm başına sayfa, sayılar biçimli", () => {
    const report = emptyReport("yonetici");
    const file = reportFile(report, "tum", "xlsx", "2026-10-20");
    expect(file?.fileName).toBe("seker-rapor-tum-2026-10-01-2026-10-20.xlsx");
    const book = XLSX.read(file!.body, { cellNF: true });
    expect(book.SheetNames).toEqual([
      "Özet",
      "Aday hunisi",
      "Kaynaklar ve reklam",
      "Ön büro",
      "Kayıp nedenleri",
      "Teklifler",
      "Öğrenciler ve tahsilat",
      "İçerik",
      "Site trafiği",
      "Otomasyonlar",
    ]);
    const sheet = book.Sheets["Özet"];
    expect(sheet.A1.v).toBe("Şeker Anaokulu raporu · Özet");
    expect(sheet.A2.v).toContain("Dönem: Ekim 2026");
  });

  it("tutar TL ve ₺ biçimiyle, oran yüzde biçimiyle yazılır", () => {
    const report = emptyReport("yonetici");
    report.summary.tables = [table];
    const file = reportFile(report, "ozet", "xlsx", "2026-10-20");
    const sheet = XLSX.read(file!.body, { cellNF: true }).Sheets["Özet"];
    // 1 başlık + 3 bilgi + boş satır, sonra tablo başlığı (6) ve kolonlar (7): ilk veri satırı 8.
    expect(sheet.B8).toMatchObject({ t: "n", v: 1234.56 });
    expect(sheet.B8.z).toContain("₺");
    expect(sheet.C8).toMatchObject({ t: "n", v: 0.4256, z: "0.0%" });
    expect(sheet.A8).toMatchObject({ t: "s", v: '=HYPERLINK("x")' });
  });

  it("danışman yönetici bölümünü indiremez; tüm rapor yalnız görebildiği bölümler", () => {
    const report = emptyReport("danisman");
    expect(reportFile(report, "teklifler", "xlsx", "2026-10-20")).toBeNull();
    expect(reportFile(report, "site", "csv", "2026-10-20")).toBeNull();
    const book = XLSX.read(reportFile(report, "tum", "xlsx", "2026-10-20")!.body);
    expect(book.SheetNames).toEqual(["Özet", "Aday hunisi", "Kaynaklar ve reklam", "Ön büro", "Kayıp nedenleri", "Öğrenciler ve tahsilat"]);
    const summary = XLSX.utils.sheet_to_csv(book.Sheets["Özet"]);
    expect(summary).not.toContain("Tahsil");
    expect(summary).not.toContain("harcama");
  });

  it("bilinmeyen bölüm null", () => {
    expect(reportFile(emptyReport("yonetici"), "yok", "csv", "2026-10-20")).toBeNull();
  });
});
