import { describe, it, expect } from "vitest";
import { adsStatusLines } from "@/lib/ads/status-lines";
import type { AdsConfig } from "@/lib/ads/config";

const base = {
  clientId: "a", clientSecret: "b", refreshToken: "c", customerId: "1", loginCustomerId: null,
  conversionActionIds: { randevu: "1", kayit: "2" },
};

describe("adsStatusLines", () => {
  it("yapılandırma yoksa harcama CSV, dönüşüm kapalı", () => {
    const l = adsStatusLines(null);
    expect(l.spend).toBe("Google Ads bağlantısı yok — harcamayı CSV ile yükleyin");
    expect(l.conversion).toBe("kapalı (Google bağlantısı kurulmadı); bekleyen kayıtlar bağlantı kurulunca gönderilir");
  });
  it("yapılandırma varsa harcama otomatik, dönüşüm açık", () => {
    const l = adsStatusLines(base as AdsConfig);
    expect(l.spend).toBe("her sabah 06:00'da otomatik");
    expect(l.conversion).toBe("açık");
  });
});
