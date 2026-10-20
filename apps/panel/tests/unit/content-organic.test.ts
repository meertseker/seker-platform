import { describe, expect, it, vi } from "vitest";
import { compare72h, syncOrganicStats } from "@/lib/content/organic";
import type { MetaConfig } from "@/lib/ads/meta/config";

const NOW = new Date("2026-10-20T09:00:00Z");
const cfg: MetaConfig = {
  accessToken: "t", appSecret: "s", adAccountId: "act_1", pixelId: null, testEventCode: null, capiEnabled: false,
  instagramUserId: "1784",
};
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

describe("compare72h", () => {
  it("72 saati dolmayanı done:false bırakır", () => {
    const [r] = compare72h([{ code: "R-2643-A", publishedAt: hoursAgo(71), views: 10, saves: 0, shares: 0 }], NOW);
    expect(r).toMatchObject({ done: false, lead: null, ratio: null });
  });

  it("önde olan 2 katı oranını verir", () => {
    const out = compare72h(
      [
        { code: "R-2643-A", publishedAt: hoursAgo(80), views: 2000, saves: 5, shares: 1 },
        { code: "R-2643-B", publishedAt: hoursAgo(75), views: 1000, saves: 9, shares: 9 },
        { code: "R-2643-C", publishedAt: hoursAgo(10), views: 99999, saves: 0, shares: 0 },
      ],
      NOW,
    );
    expect(out.find((r) => r.code === "R-2643-A")).toMatchObject({ done: true, lead: "onde", ratio: 2 });
    expect(out.find((r) => r.code === "R-2643-B")).toMatchObject({ done: true, lead: "geride" });
    expect(out.find((r) => r.code === "R-2643-C")).toMatchObject({ done: false, lead: null });
  });

  it("izlenme eşitse kaydetme+paylaşım belirler, o da eşitse esit", () => {
    const tie = compare72h(
      [
        { code: "A", publishedAt: hoursAgo(80), views: 100, saves: 5, shares: 5 },
        { code: "B", publishedAt: hoursAgo(80), views: 100, saves: 2, shares: 2 },
      ],
      NOW,
    );
    expect(tie.find((r) => r.code === "A")?.lead).toBe("onde");
    expect(tie.find((r) => r.code === "B")?.lead).toBe("geride");
    const same = compare72h(
      [
        { code: "A", publishedAt: hoursAgo(80), views: 100, saves: 2, shares: 2 },
        { code: "B", publishedAt: hoursAgo(80), views: 100, saves: 3, shares: 1 },
      ],
      NOW,
    );
    expect(same.map((r) => r.lead)).toEqual(["esit", "esit"]);
  });

  it("tek başına dolan, karşılaştırılacak kimse olmadığından lead null", () => {
    const [r] = compare72h([{ code: "A", publishedAt: hoursAgo(80), views: 5, saves: 0, shares: 0 }], NOW);
    expect(r).toMatchObject({ done: true, lead: null });
  });
});

function fakeDb(items: { id: string; ig_permalink: string | null; ig_media_id: string | null }[]) {
  const upserts: unknown[] = [];
  const updates: { patch: unknown; id: unknown }[] = [];
  const db = {
    from: (table: string) => {
      if (table === "content_items") {
        const q: Record<string, unknown> = {
          select: () => q,
          eq: () => q,
          not: () => q,
          then: (res: (v: unknown) => void) => res({ data: items, error: null }),
          update: (patch: unknown) => ({
            eq: (_c: string, id: unknown) => {
              updates.push({ patch, id });
              return Promise.resolve({ error: null });
            },
          }),
        };
        return q;
      }
      return {
        upsert: (row: unknown) => {
          upserts.push(row);
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  return { db, upserts, updates };
}

describe("syncOrganicStats", () => {
  it("yapılandırma yokken istek gitmez ve 0 döner", async () => {
    const fetchFn = vi.fn();
    const { db } = fakeDb([{ id: "c1", ig_permalink: "https://www.instagram.com/reel/X/", ig_media_id: null }]);
    const n = await syncOrganicStats({ cfg: { ...cfg, instagramUserId: null }, db: db as never, fetchFn: fetchFn as never, now: NOW });
    expect(n).toBe(0);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("medya kimliğini çözer, yazar ve bugünün satırını upsert eder", async () => {
    const fetchFn = vi.fn(async (url: string) =>
      url.includes("/media?")
        ? new Response(JSON.stringify({ data: [{ id: "99", permalink: "https://www.instagram.com/reel/X/" }] }))
        : new Response(JSON.stringify({ data: [{ name: "views", values: [{ value: 7 }] }, { name: "ig_reels_avg_watch_time", values: [{ value: 1500 }] }] })),
    );
    const { db, upserts, updates } = fakeDb([{ id: "c1", ig_permalink: "https://www.instagram.com/reel/X/", ig_media_id: null }]);
    const n = await syncOrganicStats({ cfg, db: db as never, fetchFn: fetchFn as never, now: NOW });
    expect(n).toBe(1);
    expect(updates[0]).toEqual({ patch: { ig_media_id: "99" }, id: "c1" });
    expect(upserts[0]).toMatchObject({ content_id: "c1", day: "2026-10-20", views: 7, avg_watch_ms: 1500 });
  });
});
