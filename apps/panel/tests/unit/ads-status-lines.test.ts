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
  it("belirteç yoksa harcama hâlâ CSV, dönüşüm açık", () => {
    const l = adsStatusLines({ ...base, developerToken: null } as AdsConfig);
    expect(l.spend).toBe("Google Ads bağlantısı yok — harcamayı CSV ile yükleyin");
    expect(l.conversion).toBe("açık");
  });
  it("belirteç varsa harcama otomatik", () => {
    const l = adsStatusLines({ ...base, developerToken: "t" } as AdsConfig);
    expect(l.spend).toBe("her sabah 06:00'da otomatik");
    expect(l.conversion).toBe("açık");
  });
});
