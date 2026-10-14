import { describe, expect, it } from "vitest";
import {
  factFromCell,
  fillToStatus,
  paidFromNote,
  paidOnFromNote,
  remainingFromNote,
} from "@/scripts/seed/lib/excel-payment-facts";

describe("fillToStatus", () => {
  it("yeşil ve moru ödendi, kırmızıyı bekliyor, griyi kısmi okur", () => {
    expect(fillToStatus("92D050")).toBe("odendi");
    expect(fillToStatus("00B050")).toBe("odendi");
    expect(fillToStatus("7030A0")).toBe("odendi");
    expect(fillToStatus("FF0000")).toBe("bekliyor");
    expect(fillToStatus("GRAY")).toBe("kismi");
    expect(fillToStatus(null)).toBe("plansiz");
  });
});

describe("paidFromNote", () => {
  it("KALAN tutarından ödeneni çıkarır", () => {
    expect(paidFromNote("29.500₺ nakit alındı.\nKalan 15.500₺ Ekim ayında", 45000)).toBe(29500);
    expect(paidFromNote("53.000TL YKB OK.\nKALAN 24.000TL'Yİ ANNE NAKİT ÖDEYECEK", 50000)).toBe(26000);
  });
  it("OK satırındaki tutarı alır, KALAN ? satırını saymaz", () => {
    expect(paidFromNote("07/09/26 15.000TL YKB OK.\nKALAN 8.000TL?", 23000)).toBe(15000);
    expect(paidFromNote("10/09/26 7.000TL NAKİT OK.", 22000)).toBe(7000);
  });
  it("soru işaretsiz KALAN yoksa ve OK yoksa null döner", () => {
    expect(paidFromNote("Taksit isteme durumları olabilir.", 45000)).toBeNull();
  });
  it("aidat ile karışık kırtasiye notunda yalnız kırtasiye taksitini sayar", () => {
    const note = [
      "ANNE İLE 3 TAKSİT ANLAŞILDI.",
      "1. TAKSİT 6.800TL",
      "09/09/26 TARİHİNDE 6.800TL NAKİT OK.",
      "KALAN 2 TAKSİT 5.350TL",
      "BABA İLE",
      "02/09/26 TARİHİNDE 13.600TL YKB OK.",
      "10.000TL AİDAT OK KALAN 3.600TL KIRTASİYEYE AKTARILDI.",
      "KALAN 13.900TL??",
    ].join("\n");
    expect(paidFromNote(note, 35000)).toBe(6800);
  });
});

describe("remainingFromNote", () => {
  it("soru işaretli KALAN'ı yok sayar", () => {
    expect(remainingFromNote("KALAN 8.000TL?")).toBeNull();
    expect(remainingFromNote("KALAN 15.500₺ Ekim")).toBe(15500);
  });
});

describe("paidOnFromNote", () => {
  it("son tarihi ISO'ya çevirir", () => {
    expect(paidOnFromNote("20/01/26 karttan çekildi")).toBe("2026-01-20");
    expect(paidOnFromNote("07/09/26 15.000 OK\n10/09/26 12.000 OK")).toBe("2026-09-10");
  });
});

describe("factFromCell", () => {
  it("yeşil hücreyi tam ödendi sayar", () => {
    expect(factFromCell(250000, "92D050", "20/01/26 295.000TL çekildi")).toEqual({
      status: "odendi",
      paidTl: 250000,
      remainingTl: 0,
      method: "diger",
      paidOn: "2026-01-20",
    });
  });
  it("kırmızı hücreyi bekliyor sayar", () => {
    expect(factFromCell(27000, "FF0000", "HER AYIN 16'Sİ ÖDEME")).toMatchObject({
      status: "bekliyor",
      paidTl: 0,
      remainingTl: 27000,
    });
  });
  it("renksiz plan hücresini bekliyor sayar", () => {
    expect(factFromCell(26000, null, null)?.status).toBe("bekliyor");
  });
  it("gri hücrede kısmi tahsilatı böler", () => {
    const fact = factFromCell(23000, "GRAY", "07/09/26 15.000TL YKB OK.\nKALAN 8.000TL?");
    expect(fact).toMatchObject({ status: "kismi", paidTl: 15000, remainingTl: 8000, method: "pos" });
  });
  it("sıfır veya boş tutarı yok sayar", () => {
    expect(factFromCell(0, "FF0000", null)).toBeNull();
  });
});
