import { describe, it, expect } from "vitest";
import { adUserDataFor } from "@/lib/ads/consent";

const NOW = "2026-10-01T10:00:00.000Z";

describe("adUserDataFor", () => {
  it("lead yoksa null döner", () => {
    expect(adUserDataFor(null)).toBeNull();
    expect(adUserDataFor(undefined)).toBeNull();
  });

  it("web_payload içinde old_web_lead_id varsa denied", () => {
    expect(
      adUserDataFor({ consent_at: NOW, web_payload: { old_web_lead_id: "abc" } }),
    ).toBe("denied");
  });

  it("consent_scope arama ise denied", () => {
    expect(
      adUserDataFor({ consent_at: NOW, web_payload: { consent_scope: "arama" } }),
    ).toBe("denied");
  });

  it("arama kapsamı, onay tarihi olmasa da denied", () => {
    expect(
      adUserDataFor({ consent_at: null, web_payload: { consent_scope: "arama" } }),
    ).toBe("denied");
  });

  it("reklam onayı geri çekilmişse denied", () => {
    expect(
      adUserDataFor({ consent_at: NOW, ad_consent_revoked_at: NOW, web_payload: null }),
    ).toBe("denied");
  });

  it("onay tarihi varsa ve geri çekilme yoksa granted", () => {
    expect(adUserDataFor({ consent_at: NOW, web_payload: null })).toBe("granted");
    expect(
      adUserDataFor({ consent_at: NOW, ad_consent_revoked_at: null, web_payload: {} }),
    ).toBe("granted");
  });

  it("onay tarihi yoksa null döner", () => {
    expect(adUserDataFor({ consent_at: null, web_payload: null })).toBeNull();
  });

  it("öncelik: old_web_lead_id, onay tarihi olsa bile denied üretir", () => {
    expect(
      adUserDataFor({ consent_at: NOW, ad_consent_revoked_at: null, web_payload: { old_web_lead_id: "x" } }),
    ).toBe("denied");
  });
});
