import { describe, it, expect } from "vitest";
import { recWhoWhen, type ChangeLogEntry } from "@/lib/ads/change-log";
import type { RecommendationRow } from "@/lib/ads/recommendations";

// 10 Kasım 2026 13:00 İstanbul.
const NOW = new Date("2026-11-10T10:00:00Z");
const NAMES = new Map([
  ["u-zehra", "Zehra Gürsel"],
  ["u-mehtap", "Mehtap Şeker"],
]);

function rec(over: Partial<RecommendationRow> = {}): RecommendationRow {
  return {
    id: "rec-1",
    weekStart: "2026-11-02",
    ruleKey: "durdur",
    objectKey: "meta:ad:900",
    platform: "meta",
    title: "S-2644-I'yi durdur",
    why: "1.650 TL harcadı, nitelikli veli yok.",
    action: { kind: "pause", platform: "meta", objectId: "900", objectName: "S-2644-I" } as RecommendationRow["action"],
    blockedReason: null,
    status: "onaylandi",
    result: "✓ Durduruldu · kayda geçti",
    decidedAt: "2026-11-10T05:14:00Z",
    decidedBy: "u-zehra",
    ...over,
  };
}

function log(over: Partial<ChangeLogEntry> = {}): ChangeLogEntry {
  return {
    id: "log-1",
    createdAt: "2026-11-10T05:14:00Z", // bugün 08:14 İstanbul
    platform: "meta",
    level: "ad",
    objectId: "900",
    objectName: "S-2644-I",
    action: "pause",
    oldValue: { status: "ACTIVE" },
    newValue: { status: "PAUSED" },
    reason: "3 kat harcadı, nitelikli yok",
    status: "uygulandi",
    source: "oneri",
    recommendationId: "rec-1",
    actorId: "u-zehra",
    ...over,
  };
}

describe("recWhoWhen", () => {
  it("M1 tasarım metni birebir", () => {
    const logs = new Map([["rec-1", log()]]);
    expect(recWhoWhen(rec(), NAMES, logs, NOW)).toBe('✓ Uygulandı · Zehra Gürsel · bugün 08:14 · "3 kat harcadı, nitelikli yok"');
  });

  it("gerekçesiz uygulanan kararda tırnak parçası yok", () => {
    const logs = new Map([["rec-1", log({ reason: null })]]);
    expect(recWhoWhen(rec(), NAMES, logs, NOW)).toBe("✓ Uygulandı · Zehra Gürsel · bugün 08:14");
  });

  it("canlı yazım kapalıyken kaydedildi · uygulanmadı", () => {
    const logs = new Map([["rec-1", log({ reason: null, status: "uygulanmadi_kapali", createdAt: "2026-11-09T07:30:00Z" })]]);
    expect(recWhoWhen(rec({ result: "Kaydedildi · uygulanmadı: canlı yazım kapalı" }), NAMES, logs, NOW)).toBe(
      "Kaydedildi · uygulanmadı · Zehra Gürsel · 9 Kasım 10:30",
    );
  });

  it("bekletilen öneri: kim ve ne zaman", () => {
    const r = rec({ status: "bekletildi", result: "Bekletiliyor · gelecek hafta tekrar sorulur", decidedBy: "u-mehtap" });
    expect(recWhoWhen(r, NAMES, new Map(), NOW)).toBe("Bekletildi · Mehtap Şeker · bugün 08:14");
  });

  it("kayıt satırı olmayan aşama kararı öneri sonucundan", () => {
    const r = rec({ ruleKey: "sonucsuz", action: { kind: "stage", contentId: "c-1", to: "arsiv" }, result: "✓ Uygulandı · kayda geçti" });
    expect(recWhoWhen(r, NAMES, new Map(), NOW)).toBe("✓ Uygulandı · Zehra Gürsel · bugün 08:14");
    const none = rec({ action: null, result: "Kaydedildi · panelde uygulanacak reklam bulunamadı" });
    expect(recWhoWhen(none, NAMES, new Map(), NOW)).toBe("Kaydedildi · uygulanmadı · Zehra Gürsel · bugün 08:14");
  });

  it("açık ya da geçersiz öneride satır yok", () => {
    expect(recWhoWhen(rec({ status: "acik", decidedAt: null, decidedBy: null, result: null }), NAMES, new Map(), NOW)).toBeNull();
    expect(recWhoWhen(rec({ status: "gecersiz" }), NAMES, new Map(), NOW)).toBeNull();
  });

  it("adı bilinmeyen kişi Bilinmiyor yazılır", () => {
    const logs = new Map([["rec-1", log({ reason: null, actorId: "u-x" })]]);
    expect(recWhoWhen(rec({ decidedBy: "u-x" }), NAMES, logs, NOW)).toBe("✓ Uygulandı · Bilinmiyor · bugün 08:14");
  });
});
