import { describe, it, expect } from "vitest";
import type { CampaignRow } from "@/lib/ads/campaigns";
import { defaultNewBudget, dialogLines, instagramCodes, reasonToSend, statusLabel } from "@/lib/ads/change-text";

function row(o: Partial<CampaignRow>): CampaignRow {
  return {
    key: "meta:ad:1", platform: "meta", level: "ad", depth: 1, objectId: "1", name: "R-2641-A", status: "reklam",
    spendKurus: 0, leads: 0, platformResults: 0, qualified: 0, appts: 0, enrolled: 0, cplKurus: null, cplTone: "red",
    contentCode: "R-2641-A", unmatched: false, dailyBudgetTl: 150, selfPaused: false, parentPaused: false, budgetNote: null, adsetId: null, review: null, ...o,
  };
}

const PARENT_LINE = "Kampanya / reklam seti durdurulmuş; bu reklam üst düzey başlatılana kadar gösterilmez.";

describe("statusLabel", () => {
  it("yayında, reklam, durduruldu ve üst düzey ayrımları", () => {
    expect(statusLabel(row({ level: "campaign", status: "yayinda" }))).toBe("yayında");
    expect(statusLabel(row({ status: "reklam" }))).toBe("reklam");
    expect(statusLabel(row({ status: "durduruldu", selfPaused: true }))).toBe("durduruldu");
    expect(statusLabel(row({ status: "durduruldu", parentPaused: true }))).toBe("durduruldu · üst düzey");
    expect(statusLabel(row({ status: "durduruldu", selfPaused: true, parentPaused: true }))).toBe("durduruldu · üst düzey de durdurulmuş");
    expect(statusLabel(row({ status: null }))).toBeNull();
  });
});

describe("dialogLines", () => {
  const on = { writeEnabled: true, currentTl: 150, nextTl: 180 };
  const off = { ...on, writeEnabled: false };

  it("başlat: üst düzey durmuşsa 'yeniden gösterilir' sözü verilmez", () => {
    expect(dialogLines(row({ selfPaused: true, parentPaused: true, status: "durduruldu" }), "resume", on)).toEqual([PARENT_LINE]);
    expect(dialogLines(row({ selfPaused: true, status: "durduruldu" }), "resume", on)).toEqual([
      "Reklam yeniden gösterilmeye başlar.",
      "Instagram'da öğrenme dönemi baştan başlayabilir.",
    ]);
    expect(dialogLines(row({ platform: "google", level: "campaign", selfPaused: true }), "resume", on)).toEqual(["Reklam yeniden gösterilmeye başlar."]);
  });

  it("canlı yazım kapalıyken durdur/başlat yalnız kayda geçtiğini söyler", () => {
    expect(dialogLines(row({}), "pause", on)).toEqual([
      "Reklam bugün içinde gösterilmeyi bırakır, harcama durur.",
      "Gelmiş veliler ve geçmiş sayılar silinmez.",
      "İstediğinizde aynı düğmeyle yeniden başlatılır.",
    ]);
    expect(dialogLines(row({}), "pause", off)).toEqual([
      "Yalnız kayda geçer; platforma gönderilmez, reklam yayında kalır.",
      "Gelmiş veliler ve geçmiş sayılar silinmez.",
    ]);
    expect(dialogLines(row({ selfPaused: true, parentPaused: true }), "resume", off)).toEqual([
      "Yalnız kayda geçer; platforma gönderilmez, reklam durdurulmuş kalır.",
      PARENT_LINE,
    ]);
  });

  it("bütçe: paylaşılan bütçe satırı ve canlı yazıma göre 'hemen uygulanır'", () => {
    const note = "Bu bütçe reklam seti “Beykent” düzeyinde; aynı bütçeyi kullanan reklamları da etkiler.";
    expect(dialogLines(row({ budgetNote: note }), "budget", on)).toEqual([
      "Aylık en fazla 900 TL ek harcama demek.",
      note,
      "Instagram hesabında hemen uygulanır.",
      "Kim, ne zaman, eski ve yeni değer kayda geçer.",
    ]);
    expect(dialogLines(row({}), "budget", { writeEnabled: false, currentTl: 150, nextTl: 120 })).toEqual([
      "Aylık en fazla 900 TL daha az harcama demek.",
      "Kim, ne zaman, eski ve yeni değer kayda geçer.",
    ]);
  });
});

describe("reasonToSend", () => {
  it("uyarı yokken gerekçe gönderilmez", () => {
    expect(reasonToSend(false, "bütçe artışı gerekli")).toBeUndefined();
    expect(reasonToSend(true, "  bütçe artışı gerekli ")).toBe("bütçe artışı gerekli");
    expect(reasonToSend(true, "   ")).toBeUndefined();
  });
});

describe("instagramCodes", () => {
  it("Instagram reklamına yalnız R- kodları", () => {
    expect(instagramCodes([{ code: "S-2641-A", topic: "a" }, { code: "R-2641-B", topic: "b" }])).toEqual([{ code: "R-2641-B", topic: "b" }]);
  });
});

describe("defaultNewBudget", () => {
  it("haftalık sınır kadar artış, aşağı yuvarlanır: sınırı aşıp gerekçe istemez (153 → 183, 184 değil)", () => {
    expect(defaultNewBudget(153, 20)).toBe(183);
    expect(defaultNewBudget(150, 20)).toBe(180);
    expect(defaultNewBudget(125, 20)).toBe(150);
    expect(defaultNewBudget(0, 20)).toBe(0);
  });
});
