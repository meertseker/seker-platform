import { afterEach, describe, expect, it, vi } from "vitest";
import { readMetaConfig } from "@/lib/ads/meta/config";
import { adsWriteEnabled } from "@/lib/ads/writes";
import { videoMaxMb } from "@/lib/content/store";

// docker-compose `${VAR:-}` tanımsız değişkeni boş metin olarak geçirir; boş metin "ayarlanmamış" ile aynı davranmalı.
describe("compose'un geçirdiği boş env değerleri", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("boş Meta değerleri entegrasyonu kapalı tutar", () => {
    const empty = {
      META_ACCESS_TOKEN: "",
      META_APP_SECRET: "",
      META_AD_ACCOUNT_ID: "",
      META_PIXEL_ID: "",
      META_CAPI_TEST_CODE: "",
      META_CAPI_ENABLED: "",
      META_INSTAGRAM_USER_ID: "",
    };
    expect(readMetaConfig(empty)).toBeNull();
  });

  it("boş ADS_WRITE_ENABLED canlı yazımı kapalı tutar", () => {
    expect(adsWriteEnabled({ ADS_WRITE_ENABLED: "" })).toBe(false);
  });

  it("boş CONTENT_VIDEO_MAX_MB varsayılan 50 MB'a düşer", () => {
    vi.stubEnv("CONTENT_VIDEO_MAX_MB", "");
    expect(videoMaxMb()).toBe(50);
  });
});
