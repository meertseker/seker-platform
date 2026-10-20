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

describe("adsStatusLines · Meta", () => {
  const metaBase = {
    accessToken: "t", appSecret: "s", adAccountId: "act_1", pixelId: "9", testEventCode: null, capiEnabled: false,
  };
  it("meta yokken durum satırları", () => {
    const l = adsStatusLines(null);
    expect(l.metaSpend).toBe("Instagram bağlantısı yok — Meta hesabı kurulunca her sabah 06:00'da otomatik");
    expect(l.metaConversion).toBe("kapalı (Meta bağlantısı yok)");
  });
  it("capi kapalıyken hukuk onayı yazar", () => {
    const l = adsStatusLines(null, metaBase);
    expect(l.metaSpend).toBe("her sabah 06:00'da otomatik (son 7 gün)");
    expect(l.metaConversion).toBe("kapalı (hukuk onayı bekleniyor · META_CAPI_ENABLED)");
  });
  it("capi açıkken açık yazar", () => {
    expect(adsStatusLines(null, { ...metaBase, capiEnabled: true }).metaConversion).toBe("açık");
  });
});
