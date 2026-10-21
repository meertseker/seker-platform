import { describe, expect, it } from "vitest";
import { parseCell, methodOf, amountsIn } from "../../scripts/seed/lib/excel-odeme-parcalari";

const base = { fill: "00B050", monthKey: "2026-09", today: "2026-10-21" };
const brief = (r: ReturnType<typeof parseCell>) => r.parts.map((p) => [p.date, p.amount, p.method]);

describe("excel-odeme-parcalari", () => {
  it("YKB OK = havale, KALAN ? sayılmaz, NAKİT ikinci parça", () => {
    const r = parseCell({
      ...base,
      cellTl: 26000,
      note: "02/09/26 15.000TL YKB OK.\nKALAN 11.000TL ?\n07/09/26 TARİHİNDE KALAN 11.000TL NAKİT OK.",
    });
    expect(brief(r)).toEqual([
      ["2026-09-02", 15000, "havale"],
      ["2026-09-07", 11000, "nakit"],
    ]);
    expect(r.belirsiz).toEqual([]);
  });

  it("4.00TL yazım hatası bağlamdan 4.000 olur; SANAL POS = pos", () => {
    const r = parseCell({
      ...base,
      fill: "GRAY",
      monthKey: "2026-10",
      cellTl: 19000,
      note: "12/10/26 TARİHİNDE 4.00TL NAKİT OK.\nKALAN 15.000 TL İSE 14/10/26 TARİHİNDE 15.000TL YKB SANAL POS ÜZERİNDEN ÇEKİMİ YAPILDI!",
    });
    expect(brief(r)).toEqual([
      ["2026-10-12", 4000, "nakit"],
      ["2026-10-14", 15000, "pos"],
    ]);
    expect(r.belirsiz).toEqual([]);
    expect(r.uyari.join(" ")).toContain("4.00TL");
  });

  it("tarih ayrı satırdaysa sonraki ödeme cümlesine geçer", () => {
    const r = parseCell({
      ...base,
      cellTl: 17000,
      note: "17/09/26 TARİHİNDE 15.000TL YKB OK.\nKALAN 2.000TL\n08/10/26 TARHİNDE\nKalan 2.000 TL ise nakit olarak alındı.",
    });
    expect(brief(r)).toEqual([
      ["2026-09-17", 15000, "havale"],
      ["2026-10-08", 2000, "nakit"],
    ]);
  });

  it("aynı satırda KALAN ...? ikinci cümlede kalır; NAKİTOK okunur", () => {
    const r = parseCell({
      ...base,
      monthKey: null,
      cellTl: 220000,
      note: "14/07/26 TARİHİNDE 150.000TL YKB SANAL POSUNDAN ÇEKİLDİ. KALAN 70.000TL NAKİT?\n07/09/26 TARİHİNDE KALAN 70.000TL NAKİTOK.",
    });
    expect(brief(r)).toEqual([
      ["2026-07-14", 150000, "pos"],
      ["2026-09-07", 70000, "nakit"],
    ]);
  });

  it("aktarım / tarihsiz ödeme belirsizdir, tahmin edilmez", () => {
    const r = parseCell({
      ...base,
      cellTl: 20000,
      note: "02/09/26 TARİHİNDE 13.600TL YKB OK.\n10.000TL AİDAT OK KALAN 3.600TL KIRTASİYEYE AKTARILDI.\n09/09/26 TARİHİNDE 10.000TL ANNE NAKİT OK.",
    });
    expect(r.belirsiz.length).toBeGreaterThan(0);
  });

  it("birleşik ödemede hücre payı alınır", () => {
    const r = parseCell({
      ...base,
      cellTl: 23000,
      note: "13/10/26 TARİHİNDE 46.000TL 2 AYLIK (EYLÜM+EKİM AİDAT) YKB OK.",
    });
    expect(brief(r)).toEqual([["2026-10-13", 23000, "havale"]]);
    expect(r.birlesik).toBe(true);
  });

  it("yöntem ve tutar yardımcıları", () => {
    expect(methodOf("15.000TL YKB OK").method).toBe("havale");
    expect(methodOf("2 FARKLI KARTTAN").method).toBe("pos");
    expect(methodOf("EGE ŞEKER HESABINA ÖDENDİ").method).toBe("havale");
    expect(amountsIn("08.09.2026 TARİHİNDE 15.000TL YKB OK")).toEqual([15000]);
    expect(amountsIn("Kalan 500 TL İSE 08/10/26 TARİHİNDE")).toEqual([500]);
    expect(amountsIn("%3.49 KOMİSYON 74.720TL")).toEqual([74720]);
  });
});
