import { describe, it, expect } from "vitest";
import type { CampaignRow } from "@/lib/ads/campaigns";
import type { AdSetup } from "@/lib/ads/ad-setup";
import { canMoveToScale } from "@/lib/ads/campaign-scale";

const SETUP: AdSetup = {
  testCampaignId: "100",
  testAdsetId: "101",
  scaleCampaignId: "200",
  scaleAdsetId: "201",
  exclusionAudienceId: null,
  createdAt: "2026-11-01T06:00:00Z",
  createdBy: "u-mert",
};

function row(over: Partial<CampaignRow> = {}): CampaignRow {
  return {
    key: "meta:ad:900",
    platform: "meta",
    level: "ad",
    depth: 1,
    objectId: "900",
    name: "R-2644-A · İlk gün uyumu",
    status: "reklam",
    spendKurus: 192_000,
    leads: 7,
    platformResults: 8,
    qualified: 4,
    appts: 2,
    enrolled: 0,
    cplKurus: 48_000,
    cplTone: "green",
    contentCode: "R-2644-A",
    unmatched: false,
    dailyBudgetTl: 200,
    selfPaused: false,
    parentPaused: false,
    budgetNote: null,
    adsetId: "101",
    review: null,
    ...over,
  };
}

describe("canMoveToScale", () => {
  it("Test setindeki, kodlu, yayındaki Meta reklamı taşınabilir", () => {
    expect(canMoveToScale(row(), SETUP)).toBe(true);
  });

  it("Google satırı taşınamaz", () => {
    expect(canMoveToScale(row({ platform: "google", level: "campaign", depth: 0, adsetId: null, contentCode: null }), SETUP)).toBe(false);
  });

  it("içerik kodu olmayan (eşleşmemiş) reklam taşınamaz", () => {
    expect(canMoveToScale(row({ contentCode: null, unmatched: true }), SETUP)).toBe(false);
  });

  it("Büyütme setindeki reklam yeniden taşınamaz", () => {
    expect(canMoveToScale(row({ adsetId: "201" }), SETUP)).toBe(false);
  });

  it("durdurulmuş reklam taşınamaz", () => {
    expect(canMoveToScale(row({ status: "durduruldu", selfPaused: true }), SETUP)).toBe(false);
    expect(canMoveToScale(row({ status: "durduruldu", parentPaused: true }), SETUP)).toBe(false);
  });

  it("kurulum yoksa taşınamaz", () => {
    expect(canMoveToScale(row(), null)).toBe(false);
  });
});
