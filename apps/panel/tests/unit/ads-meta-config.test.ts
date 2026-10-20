import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { readMetaConfig, appSecretProof, META_GRAPH_API_VERSION } from "@/lib/ads/meta/config";

const ENV = {
  META_ACCESS_TOKEN: "tok",
  META_APP_SECRET: "sec",
  META_AD_ACCOUNT_ID: "123",
  META_PIXEL_ID: "999",
  META_CAPI_ENABLED: "true",
};

describe("readMetaConfig", () => {
  it("token yoksa null", () => {
    expect(readMetaConfig({ ...ENV, META_ACCESS_TOKEN: "" })).toBeNull();
  });

  it("app secret ya da hesap yoksa null", () => {
    expect(readMetaConfig({ ...ENV, META_APP_SECRET: undefined })).toBeNull();
    expect(readMetaConfig({ ...ENV, META_AD_ACCOUNT_ID: "" })).toBeNull();
  });

  it("act_ öneki eklenir, varsa aynen kalır", () => {
    expect(readMetaConfig(ENV)?.adAccountId).toBe("act_123");
    expect(readMetaConfig({ ...ENV, META_AD_ACCOUNT_ID: "act_123" })?.adAccountId).toBe("act_123");
  });

  it("META_CAPI_ENABLED yokken capiEnabled false", () => {
    expect(readMetaConfig({ ...ENV, META_CAPI_ENABLED: undefined })?.capiEnabled).toBe(false);
    expect(readMetaConfig(ENV)?.capiEnabled).toBe(true);
  });

  it("pixel yokken true yazılsa da capiEnabled false", () => {
    const cfg = readMetaConfig({ ...ENV, META_PIXEL_ID: "" });
    expect(cfg?.pixelId).toBeNull();
    expect(cfg?.capiEnabled).toBe(false);
  });

  it("test olay kodu isteğe bağlıdır", () => {
    expect(readMetaConfig(ENV)?.testEventCode).toBeNull();
    expect(readMetaConfig({ ...ENV, META_CAPI_TEST_CODE: "TEST1" })?.testEventCode).toBe("TEST1");
  });

  it("sürüm sabiti v26.0", () => {
    expect(META_GRAPH_API_VERSION).toBe("v26.0");
  });
});

describe("appSecretProof", () => {
  it("bilinen değeri üretir", () => {
    expect(appSecretProof("tok", "sec")).toBe(createHmac("sha256", "sec").update("tok").digest("hex"));
  });
});
