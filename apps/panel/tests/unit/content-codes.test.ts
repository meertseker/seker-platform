import { describe, it, expect } from "vitest";
import { isoWeek, weekStart, nextContentCode } from "@/lib/content/codes";
import { CONTENT_CODE_RE } from "@/lib/ads/content-code";

describe("nextContentCode", () => {
  const at = new Date("2026-11-04T10:00:00+03:00");
  it("R-2645-A üretir", () => {
    expect(nextContentCode("reels", at, [])).toBe("R-2645-A");
  });
  it("ikinci Reels B alır", () => {
    expect(nextContentCode("reels", at, ["R-2645-A"])).toBe("R-2645-B");
  });
  it("başka haftanın kodu harfi tüketmez", () => {
    expect(nextContentCode("reels", at, ["R-2644-A"])).toBe("R-2645-A");
  });
  it("üç harf doluysa null", () => {
    expect(nextContentCode("reels", at, ["R-2645-A", "R-2645-B", "R-2645-C"])).toBeNull();
  });
  it("Google sayfası G, Instagram sayfası I", () => {
    expect(nextContentCode("sayfa", at, [], "google")).toBe("S-2645-G");
    expect(nextContentCode("sayfa", at, [], "instagram")).toBe("S-2645-I");
    expect(nextContentCode("sayfa", at, ["S-2645-G"], "google")).toBeNull();
  });
  it("yıl dönümünde ISO yılı", () => {
    expect(nextContentCode("reels", new Date("2027-01-01T10:00:00+03:00"), [])).toBe("R-2653-A");
  });
  it("üretilen kod desene uyar", () => {
    expect(CONTENT_CODE_RE.test(nextContentCode("reels", at, [])!)).toBe(true);
  });
});

describe("isoWeek / weekStart", () => {
  it("İstanbul gününe göre hafta", () => {
    expect(isoWeek(new Date("2026-11-04T10:00:00+03:00"))).toEqual({ year: 2026, week: 45 });
    // 31 Ara 2026 21:30 UTC = İstanbul 1 Oca 2027 00:30 (Cuma) → hâlâ ISO 2026/53
    expect(isoWeek(new Date("2026-12-31T21:30:00Z"))).toEqual({ year: 2026, week: 53 });
  });
  it("weekStart Pazar gecesi bir önceki Pazartesiyi verir", () => {
    // Pazar 2026-11-08 23:30 İstanbul
    expect(weekStart(new Date("2026-11-08T23:30:00+03:00"))).toBe("2026-11-02");
    // Pazartesi 00:10 İstanbul = Pazar 21:10 UTC; yeni hafta
    expect(weekStart(new Date("2026-11-08T21:10:00Z"))).toBe("2026-11-09");
  });
});
