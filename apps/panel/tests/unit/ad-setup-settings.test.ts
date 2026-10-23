import { describe, it, expect } from "vitest";
import { AD_SETUP_KEY, getAdSetup, parseAdSetup } from "@/lib/ads/ad-setup";

const full = {
  testCampaignId: "120200000000000001",
  testAdsetId: "120200000000000002",
  scaleCampaignId: "120200000000000003",
  scaleAdsetId: "120200000000000004",
  exclusionAudienceId: "120200000000000005",
  createdAt: "2026-10-23T10:00:00Z",
  createdBy: "Mert",
};

describe("parseAdSetup", () => {
  it("boş → null", () => {
    expect(AD_SETUP_KEY).toBe("reklam_kurulum");
    expect(parseAdSetup({})).toBeNull();
    expect(parseAdSetup(null)).toBeNull();
    expect(parseAdSetup("x")).toBeNull();
  });

  it("dört kimlik varken nesne", () => {
    expect(parseAdSetup(full)).toEqual(full);
  });

  it("exclusionAudienceId yoksa null", () => {
    const rest: Partial<typeof full> = { ...full };
    delete rest.exclusionAudienceId;
    expect(parseAdSetup(rest)).toEqual({ ...rest, exclusionAudienceId: null });
    expect(parseAdSetup({ ...full, exclusionAudienceId: "abc" })?.exclusionAudienceId).toBeNull();
  });

  it("kimlik rakam değilse ya da eksikse null", () => {
    expect(parseAdSetup({ ...full, testAdsetId: "act_123" })).toBeNull();
    expect(parseAdSetup({ ...full, scaleCampaignId: 123 })).toBeNull();
    expect(parseAdSetup({ ...full, scaleAdsetId: "1".repeat(31) })).toBeNull();
    const noTest: Partial<typeof full> = { ...full };
    delete noTest.testCampaignId;
    expect(parseAdSetup(noTest)).toBeNull();
  });
});

describe("getAdSetup", () => {
  it("app_settings'ten okur", async () => {
    const calls: unknown[][] = [];
    const chain = {
      select: () => chain,
      eq: (...a: unknown[]) => {
        calls.push(a);
        return chain;
      },
      maybeSingle: async () => ({ data: { value: full }, error: null }),
    };
    expect(await getAdSetup({ from: () => chain } as never)).toEqual(full);
    expect(calls).toContainEqual(["key", "reklam_kurulum"]);
  });

  it("tohum {} → null", async () => {
    const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: { value: {} }, error: null }) };
    expect(await getAdSetup({ from: () => chain } as never)).toBeNull();
  });
});
