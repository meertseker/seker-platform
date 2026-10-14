import { describe, it, expect } from "vitest";
import { tlToKurus, kurusToTl, formatTRY } from "@/lib/money";

describe("money", () => {
  it("TL'yi kuruşa çevirir", () => {
    expect(tlToKurus(18000)).toBe(1800000);
    expect(tlToKurus(18000.5)).toBe(1800050);
  });
  it("kuruşu TL'ye çevirir", () => {
    expect(kurusToTl(1800050)).toBe(18000.5);
  });
  it("TRY formatlar", () => {
    expect(formatTRY(1800000)).toBe("18.000,00 ₺");
  });
});
