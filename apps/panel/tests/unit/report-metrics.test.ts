import { describe, expect, it } from "vitest";
import { formatDays, formatMinutes, formatPct, formatSignedPct, formatTl, formatTlCompact } from "@/lib/report/format";
import { agingOf, change, changeTone, costPer, mean, median, microsToKurus, normalizeTerm, ratio } from "@/lib/report/metrics";

describe("oran ve değişim", () => {
  it("sıfıra bölmede null", () => {
    expect(ratio(3, 0)).toBeNull();
    expect(ratio(0, 0)).toBeNull();
    expect(ratio(1, 4)).toBe(0.25);
    expect(ratio(5, -1)).toBeNull();
  });

  it("önceki dönem 0 ise yüzde yok, fark var", () => {
    expect(change(4, 0)).toEqual({ current: 4, previous: 0, diff: 4, pct: null });
    expect(change(0, 4)).toEqual({ current: 0, previous: 4, diff: -4, pct: -1 });
    expect(change(15, 10).pct).toBeCloseTo(0.5);
  });

  it("renk metriğin yönüne göre", () => {
    expect(changeTone(change(12, 10), "up")).toBe("good");
    expect(changeTone(change(12, 10), "down")).toBe("bad");
    expect(changeTone(change(8, 10), "down")).toBe("good");
    expect(changeTone(change(10, 10), "up")).toBe("flat");
    expect(changeTone(change(20, 10), "none")).toBe("flat");
  });
});

describe("maliyet bölmeleri", () => {
  it("harcama ya da adet yoksa null", () => {
    expect(costPer(0, 5)).toBeNull();
    expect(costPer(100_00, 0)).toBeNull();
    expect(costPer(-5, 2)).toBeNull();
  });

  it("kuruşa yuvarlar", () => {
    expect(costPer(1000_00, 3)).toBe(33333);
  });

  it("mikro → kuruş", () => {
    expect(microsToKurus(12_345_678)).toBe(1235);
    expect(microsToKurus(0)).toBe(0);
  });
});

describe("ortanca ve ortalama", () => {
  it("tek, çift ve boş", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
    expect(mean([])).toBeNull();
    expect(mean([0.1, 0.3])).toBeCloseTo(0.2);
  });
});

describe("yaşlandırma", () => {
  it("kova sınırları dahil, 0 gün kovaya girmez", () => {
    const out = agingOf([
      { days: 0, amountKurus: 1 },
      { days: 1, amountKurus: 100 },
      { days: 30, amountKurus: 200 },
      { days: 31, amountKurus: 300 },
      { days: 90, amountKurus: 400 },
      { days: 91, amountKurus: 500 },
      { days: 400, amountKurus: 600 },
    ]);
    expect(out.map((b) => [b.key, b.count, b.amountKurus])).toEqual([
      ["1-30", 2, 300],
      ["31-60", 1, 300],
      ["61-90", 1, 400],
      ["90+", 2, 1100],
    ]);
  });
});

describe("arama kelimesi", () => {
  it("küçük harf (Türkçe), boşluk ve işaret sadeleşir", () => {
    expect(normalizeTerm("  İstanbul   ANAOKULU ")).toBe("istanbul anaokulu");
    expect(normalizeTerm('+beylikdüzü "kreş"')).toBe("beylikdüzü kreş");
    expect(normalizeTerm("   ")).toBeNull();
    expect(normalizeTerm(null)).toBeNull();
  });
});

describe("biçim", () => {
  it("Türkçe sayı ve TL", () => {
    expect(formatTl(1_245_000)).toBe("12.450 ₺");
    expect(formatTl(4550)).toBe("45,50 ₺");
    expect(formatTl(null)).toBe("—");
    expect(formatTlCompact(150_000_000)).toBe("1,5 milyon ₺");
    expect(formatTlCompact(4_500_000)).toBe("45 bin ₺");
  });

  it("yüzde, süre, değişim", () => {
    expect(formatPct(0.4234)).toBe("%42");
    expect(formatPct(0.054)).toBe("%5,4");
    expect(formatPct(null)).toBe("—");
    expect(formatMinutes(12)).toBe("12 dk");
    expect(formatMinutes(125)).toBe("2 sa 5 dk");
    expect(formatMinutes(60 * 24 * 3)).toBe("3 gün");
    expect(formatDays(0.25)).toBe("6 saat");
    expect(formatDays(2.5)).toBe("2,5 gün");
    expect(formatSignedPct(0.12)).toBe("+%12");
    expect(formatSignedPct(-0.05)).toBe("−%5");
  });
});
