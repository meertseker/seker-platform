import { describe, expect, it, vi } from "vitest";
import { fetchGoogleCampaignStates } from "@/lib/ads/google-objects";
import { fetchMetaObjects } from "@/lib/ads/meta/objects";
import { upsertAdObjects, type AdObjectSyncRow } from "@/lib/ads/objects-store";
import type { AdsConfig } from "@/lib/ads/config";
import type { MetaConfig } from "@/lib/ads/meta/config";

const gcfg = { customerId: "123", clientId: "c", clientSecret: "s", refreshToken: "r", loginCustomerId: null, conversionActionIds: {} } as unknown as AdsConfig;
const mcfg: MetaConfig = { accessToken: "tok", appSecret: "sec", adAccountId: "act_42", pixelId: null, testEventCode: null, capiEnabled: false };

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("fetchGoogleCampaignStates", () => {
  it("durum, bütçe kaynak adı ve mikroyu eşler; ayrı GAQL kullanır", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      json([
        {
          results: [
            {
              campaign: { id: "7", name: "Yaz", status: "ENABLED" },
              campaignBudget: { resourceName: "customers/123/campaignBudgets/9", amountMicros: "250000000" },
            },
          ],
        },
      ]),
    );
    const rows = await fetchGoogleCampaignStates(gcfg, "t", fetchFn as unknown as typeof fetch);
    expect(rows).toEqual([
      {
        platform: "google", level: "campaign", objectId: "7", parentId: null, campaignId: "7", name: "Yaz",
        status: "ENABLED", dailyBudgetMicros: 250_000_000, budgetResource: "customers/123/campaignBudgets/9", contentCode: null,
      },
    ]);
    const body = JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string);
    expect(body.query).toContain("campaign.status != 'REMOVED'");
    expect(body.query).not.toContain("metrics");
  });
});

describe("fetchMetaObjects", () => {
  function fetchByEdge(pages: Record<string, unknown[]>) {
    return vi.fn(async (url: string) => {
      const edge = new URL(url).pathname.split("/").pop() as string;
      return json({ data: pages[edge] });
    }) as unknown as typeof fetch;
  }

  it("nesneleri, kuruştan mikroya bütçeyi ve reklam kodunu eşler", async () => {
    const rows = await fetchMetaObjects(
      mcfg,
      fetchByEdge({
        campaigns: [{ id: "c1", name: "K", status: "ACTIVE", daily_budget: "50000" }],
        adsets: [{ id: "s1", name: "S", campaign_id: "c1", status: "ACTIVE" }],
        ads: [{ id: "a1", name: "R-2645-A · Gün", adset_id: "s1", campaign_id: "c1", status: "PAUSED" }],
      }),
    );
    const byId = Object.fromEntries(rows.map((r) => [r.objectId, r]));
    expect(byId.c1).toMatchObject({ dailyBudgetMicros: 500_000_000, budgetResource: "c1", status: "ACTIVE" });
    expect(byId.a1).toMatchObject({ parentId: "s1", campaignId: "c1", contentCode: "R-2645-A", status: "PAUSED" });
  });

  it("bütçe üstte duruyorsa alt satırlar üstün bütçesini ve kaynağını devralır", async () => {
    const rows = await fetchMetaObjects(
      mcfg,
      fetchByEdge({
        campaigns: [
          { id: "c1", name: "K1", status: "ACTIVE", daily_budget: "50000" },
          { id: "c2", name: "K2", status: "ACTIVE" },
        ],
        adsets: [
          { id: "s1", name: "S1", campaign_id: "c1", status: "ACTIVE" },
          { id: "s2", name: "S2", campaign_id: "c2", status: "ACTIVE", daily_budget: "20000" },
        ],
        ads: [
          { id: "a1", name: "x", adset_id: "s1", campaign_id: "c1", status: "ACTIVE" },
          { id: "a2", name: "y", adset_id: "s2", campaign_id: "c2", status: "ACTIVE" },
        ],
      }),
    );
    const byId = Object.fromEntries(rows.map((r) => [r.objectId, r]));
    expect(byId.s1).toMatchObject({ dailyBudgetMicros: 500_000_000, budgetResource: "c1" });
    expect(byId.a1).toMatchObject({ dailyBudgetMicros: 500_000_000, budgetResource: "c1" });
    expect(byId.c2).toMatchObject({ dailyBudgetMicros: null, budgetResource: null });
    expect(byId.s2).toMatchObject({ dailyBudgetMicros: 200_000_000, budgetResource: "s2" });
    expect(byId.a2).toMatchObject({ dailyBudgetMicros: 200_000_000, budgetResource: "s2" });
  });
});

describe("upsertAdObjects", () => {
  const ad = (over: Partial<AdObjectSyncRow> = {}): AdObjectSyncRow => ({
    platform: "meta", level: "ad", objectId: "a1", parentId: "s1", campaignId: "c1", name: "R-2645-A · x",
    status: "ACTIVE", dailyBudgetMicros: null, budgetResource: null, contentCode: "R-2645-A", ...over,
  });

  function fakeDb(links: { ad_id: string; content_code: string }[]) {
    const upserts: Record<string, unknown>[][] = [];
    const db = {
      from: (table: string) => {
        if (table === "ad_content_links") {
          const q: Record<string, unknown> = { select: () => q, eq: () => q, in: () => Promise.resolve({ data: links, error: null }) };
          return q;
        }
        return { upsert: (rows: Record<string, unknown>[]) => (upserts.push(rows), Promise.resolve({ error: null })) };
      },
    };
    return { db: db as never, upserts };
  }

  it("elle bağlı kod adın kodunun üstüne yazılır", async () => {
    const { db, upserts } = fakeDb([{ ad_id: "a1", content_code: "S-0001-B" }]);
    await upsertAdObjects(db, [ad()]);
    expect(upserts[0][0]).toMatchObject({ content_code: "S-0001-B" });
  });

  it("bağ yoksa addan çıkarılan kod kalır", async () => {
    const { db, upserts } = fakeDb([]);
    await upsertAdObjects(db, [ad()]);
    expect(upserts[0][0]).toMatchObject({ content_code: "R-2645-A" });
  });
});
