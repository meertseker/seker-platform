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

function fakeDb(
  items: { id: string; ig_permalink: string | null; ig_media_id: string | null; ig_published_at?: string | null }[],
  relinked: string[] = [],
) {
  const upserts: unknown[] = [];
  const updates: { patch: unknown; id: unknown; filters?: unknown[][] }[] = [];
  const db = {
    from: (table: string) => {
      if (table === "content_items") {
        const q: Record<string, unknown> = {
          select: () => q,
          eq: () => q,
          not: () => q,
          then: (res: (v: unknown) => void) => res({ data: items, error: null }),
          update: (patch: unknown) => {
            const filters: unknown[][] = [];
            const u: Record<string, unknown> = {
              eq: (c: string, v: unknown) => (filters.push([c, v]), u),
              select: () => u,
              then: (res: (v: unknown) => void) => {
                const id = filters.find((f) => f[0] === "id")?.[1];
                updates.push({ patch, id, filters });
                // Senkron sırasında bağlantısı değişen kart eşleşmez.
                res({ data: relinked.includes(id as string) ? [] : [{ id }], error: null });
              },
            };
            return u;
          },
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
  it("medya listesi senkron başına bir kez çekilir, tüm kartlar ona karşı eşlenir", async () => {
    const list = [
      { id: "1", permalink: "https://www.instagram.com/reel/A/", timestamp: "2026-10-13T09:30:00+0000" },
      { id: "2", permalink: "https://www.instagram.com/reel/B/", timestamp: "2026-10-14T09:30:00+0000" },
    ];
    const fetchFn = vi.fn(async (url: string) =>
      url.includes("/media?")
        ? new Response(JSON.stringify({ data: list }))
        : new Response(JSON.stringify({ data: [{ name: "views", values: [{ value: 1 }] }] })),
    );
    const { db, updates } = fakeDb([
      { id: "c1", ig_permalink: "https://www.instagram.com/reel/A/", ig_media_id: null },
      { id: "c2", ig_permalink: "https://www.instagram.com/reel/B/", ig_media_id: null },
    ]);
    await syncOrganicStats({ cfg, db: db as never, fetchFn: fetchFn as never, now: NOW });
    expect(fetchFn.mock.calls.filter(([u]) => String(u).includes("/media?"))).toHaveLength(1);
    expect(updates.map((u) => u.id)).toEqual(["c1", "c2"]);
  });

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
        ? new Response(JSON.stringify({ data: [{ id: "99", permalink: "https://www.instagram.com/reel/X/", timestamp: "2026-10-13T09:30:00+0000" }] }))
        : new Response(JSON.stringify({ data: [{ name: "views", values: [{ value: 7 }] }, { name: "ig_reels_avg_watch_time", values: [{ value: 1500 }] }] })),
    );
    const { db, upserts, updates } = fakeDb([{ id: "c1", ig_permalink: "https://www.instagram.com/reel/X/", ig_media_id: null }]);
    const n = await syncOrganicStats({ cfg, db: db as never, fetchFn: fetchFn as never, now: NOW });
    expect(n).toBe(1);
    expect(updates[0]).toMatchObject({ patch: { ig_media_id: "99", ig_published_at: "2026-10-13T09:30:00.000Z" }, id: "c1" });
    expect(upserts[0]).toMatchObject({ content_id: "c1", day: "2026-10-20", views: 7, avg_watch_ms: 1500 });
  });
});

describe("syncOrganicStats bağlantı yarışı", () => {
  it("senkron sırasında bağlantı değişirse eski medya kimliği yazılmaz, eski sayılar eklenmez", async () => {
    const fetchFn = vi.fn(async (url: string) =>
      url.includes("/media?")
        ? new Response(JSON.stringify({ data: [{ id: "99", permalink: "https://www.instagram.com/reel/X/", timestamp: "2026-10-13T09:30:00+0000" }] }))
        : new Response(JSON.stringify({ data: [{ name: "views", values: [{ value: 7 }] }] })),
    );
    const { db, upserts, updates } = fakeDb([{ id: "c1", ig_permalink: "https://www.instagram.com/reel/X/", ig_media_id: null }], ["c1"]);
    const n = await syncOrganicStats({ cfg, db: db as never, fetchFn: fetchFn as never, now: NOW });
    expect(updates[0].filters).toContainEqual(["ig_permalink", "https://www.instagram.com/reel/X/"]);
    expect(n).toBe(0);
    expect(upserts).toHaveLength(0);
  });
});

describe("loadOrganicInfo", () => {
  const board = (over: Record<string, unknown>) =>
    ({ id: "c1", code: "R-2643-A", kind: "reels", stage: "organik", igPermalink: "https://www.instagram.com/reel/X/", igPublishedAt: null, ...over }) as never;
  const supa = (meta: unknown[]) => ({
    from: (t: string) => {
      const rows =
        t === "content_organic_stats"
          ? [{ content_id: "c1", day: "2026-10-19", views: 50, reach: 1, saved: 1, shares: 1, avg_watch_ms: 1 }]
          : meta;
      const q: Record<string, unknown> = { select: () => q, in: () => q, order: () => q, then: (r: (v: unknown) => void) => r({ data: rows, error: null }) };
      return q;
    },
  });

  it("medya kimliği yokken (bağlantı değişti) eski sayılar gösterilmez", async () => {
    const { loadOrganicInfo } = await import("@/lib/content/organic");
    const out = await loadOrganicInfo(supa([{ id: "c1", week_start: "2026-10-12", ig_media_id: null, ig_published_at: null }]) as never, [board({})], true, NOW);
    expect(out.c1).toEqual({ state: "bekliyor", numbers: null, lead: null });
  });

  it("bağlı değilken sayılar yok ve 'baglanmadi' döner", async () => {
    const { loadOrganicInfo } = await import("@/lib/content/organic");
    const out = await loadOrganicInfo(supa([]) as never, [board({})], false, NOW);
    expect(out.c1.state).toBe("baglanmadi");
  });
});
