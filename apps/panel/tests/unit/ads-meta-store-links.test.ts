import { describe, expect, it, vi } from "vitest";
import { supabaseMetaStore } from "@/lib/ads/store";
import type { PlatformSpendRow } from "@/lib/ads/types";

const row = (over: Partial<PlatformSpendRow> = {}): PlatformSpendRow => ({
  date: "2026-10-14", campaignId: "c", campaignName: "k", costMicros: 5, clicks: 1, impressions: 2,
  platform: "meta", level: "ad", objectId: "a1", adsetId: "s", adsetName: "s", adId: "a1", adName: "R-2645-A · x",
  contentCode: "R-2645-A", reach: null, frequency: null, platformResults: 0, ...over,
});

function fakeDb(linkResult: { data?: unknown; error?: { message: string } | null }) {
  const upserts: Record<string, unknown>[][] = [];
  const db = {
    from: (table: string) => {
      if (table === "ad_content_links") {
        const q: Record<string, unknown> = {
          select: () => q,
          eq: () => q,
          in: () => Promise.resolve({ data: linkResult.data ?? [], error: linkResult.error ?? null }),
        };
        return q;
      }
      return { upsert: (r: Record<string, unknown>[]) => (upserts.push(r), Promise.resolve({ error: null })) };
    },
  };
  return { db: db as never, upserts };
}

describe("supabaseMetaStore.upsertSpend · elle bağ", () => {
  it("elle bağlı kod harcama satırında adın kodunun üstüne geçer", async () => {
    const { db, upserts } = fakeDb({ data: [{ ad_id: "a1", content_code: "S-0001-B" }] });
    await supabaseMetaStore(db).upsertSpend([row()]);
    expect(upserts[0][0]).toMatchObject({ content_code: "S-0001-B" });
  });

  it("bağ tablosu okunamazsa harcama yine yazılır, ayrıştırılan kodla", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { db, upserts } = fakeDb({ error: { message: "patladı" } });
    await supabaseMetaStore(db).upsertSpend([row()]);
    expect(upserts[0][0]).toMatchObject({ content_code: "R-2645-A", cost_micros: 5 });
  });
});
