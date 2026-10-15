import { describe, it, expect } from "vitest";
import { readAdsConfig } from "@/lib/ads/config";

const FULL_ENV = {
  GOOGLE_ADS_DEVELOPER_TOKEN: "dev-token",
  GOOGLE_ADS_CLIENT_ID: "client-id",
  GOOGLE_ADS_CLIENT_SECRET: "client-secret",
  GOOGLE_ADS_REFRESH_TOKEN: "refresh",
  GOOGLE_ADS_CUSTOMER_ID: "123-456-7890",
  GOOGLE_ADS_LOGIN_CUSTOMER_ID: "",
  GOOGLE_ADS_CONVERSION_ACTION_RANDEVU: "111",
  GOOGLE_ADS_CONVERSION_ACTION_KAYIT: "222",
};

describe("readAdsConfig", () => {
  it("tüm değerler varsa yapılandırmayı tiresiz müşteri ID'siyle döner", () => {
    expect(readAdsConfig(FULL_ENV)).toEqual({
      developerToken: "dev-token",
      clientId: "client-id",
      clientSecret: "client-secret",
      refreshToken: "refresh",
      customerId: "1234567890",
      loginCustomerId: null,
      conversionActionIds: { randevu: "111", kayit: "222" },
    });
  });

  it("tek bir zorunlu değer eksikse null döner", () => {
    expect(readAdsConfig({ ...FULL_ENV, GOOGLE_ADS_REFRESH_TOKEN: "" })).toBeNull();
  });

  it("MCC ID'si verilirse tiresiz saklanır", () => {
    expect(readAdsConfig({ ...FULL_ENV, GOOGLE_ADS_LOGIN_CUSTOMER_ID: "999-888-7777" })?.loginCustomerId).toBe("9998887777");
  });

  it("developer token yoksa yapılandırma döner, developerToken null", () => {
    const cfg = readAdsConfig({ ...FULL_ENV, GOOGLE_ADS_DEVELOPER_TOKEN: "" });
    expect(cfg).not.toBeNull();
    expect(cfg?.developerToken).toBeNull();
    expect(cfg?.clientId).toBe("client-id");
    expect(cfg?.conversionActionIds).toEqual({ randevu: "111", kayit: "222" });
  });

  it("dönüşüm aksiyonu ID'si eksikse null döner", () => {
    expect(readAdsConfig({ ...FULL_ENV, GOOGLE_ADS_CONVERSION_ACTION_KAYIT: "" })).toBeNull();
  });
});
