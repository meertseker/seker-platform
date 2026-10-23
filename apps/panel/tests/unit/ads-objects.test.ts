import { describe, expect, it, vi } from "vitest";
import { fetchGoogleCampaignStates } from "@/lib/ads/google-objects";
import { fetchMetaObjects } from "@/lib/ads/meta/objects";
import { insertCreatedAdObjects, upsertAdObjects, type AdObjectSyncRow } from "@/lib/ads/objects-store";
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

  it("reklam inceleme durumu ve açıklaması okunur; alanlar yalnız reklam isteğinde", async () => {
    const fetchFn = fetchByEdge({
      campaigns: [{ id: "c1", name: "K", status: "ACTIVE" }],
      adsets: [{ id: "s1", name: "S", campaign_id: "c1", status: "ACTIVE" }],
      ads: [
        {
          id: "a1", name: "R-2645-A · Gün", adset_id: "s1", campaign_id: "c1", status: "ACTIVE",
          effective_status: "DISAPPROVED", ad_review_feedback: { global: { a: "Yanıltıcı iddia" } },
        },
        { id: "a2", name: "x", adset_id: "s1", campaign_id: "c1", status: "ACTIVE", effective_status: "ACTIVE" },
      ],
    });
    const rows = await fetchMetaObjects(mcfg, fetchFn);
    const byId = Object.fromEntries(rows.map((r) => [r.objectId, r]));
    expect(byId.a1).toMatchObject({ effectiveStatus: "DISAPPROVED", reviewFeedback: "Yanıltıcı iddia" });
    expect(byId.a2).toMatchObject({ effectiveStatus: "ACTIVE", reviewFeedback: null });
    expect(byId.c1.effectiveStatus).toBeUndefined();
    const fields = Object.fromEntries(
      (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls.map(([u]) => {
        const url = new URL(u as string);
        return [url.pathname.split("/").pop(), url.searchParams.get("fields")];
      }),
    );
    expect(fields.ads).toBe("id,name,adset_id,campaign_id,status,effective_status,ad_review_feedback");
    expect(fields.campaigns).not.toContain("effective_status");
    expect(fields.adsets).not.toContain("effective_status");
  });

  it("sayfa sınırı aşılırsa kısmi liste dönmez, hata fırlatır", async () => {
    const fetchFn = vi.fn(async () =>
      json({ data: [{ id: "c1", name: "K", status: "ACTIVE" }], paging: { next: "https://graph.facebook.com/v26.0/act_42/campaigns?after=x" } }),
    ) as unknown as typeof fetch;
    await expect(fetchMetaObjects(mcfg, fetchFn)).rejects.toThrow("Meta sayfa sınırı aşıldı");
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
    const inCalls: string[][] = [];
    const deletes: { platform?: unknown; level?: unknown; ltSyncedAt?: unknown }[] = [];
    const db = {
      from: (table: string) => {
        if (table === "ad_content_links") {
          const q: Record<string, unknown> = {
            select: () => q,
            eq: () => q,
            in: (_c: string, ids: string[]) => (inCalls.push(ids), Promise.resolve({ data: links.filter((l) => ids.includes(l.ad_id)), error: null })),
          };
          return q;
        }
        return {
          upsert: (rows: Record<string, unknown>[]) => (upserts.push(rows), Promise.resolve({ error: null })),
          delete: () => {
            const rec: { platform?: unknown; level?: unknown; ltSyncedAt?: unknown } = {};
            deletes.push(rec);
            const q: Record<string, unknown> = {
              eq: (c: string, v: unknown) => ((rec[c === "level" ? "level" : "platform"] = v), q),
              lt: (_c: string, v: unknown) => ((rec.ltSyncedAt = v), Promise.resolve({ error: null })),
            };
            return q;
          },
        };
      },
    };
    return { db: db as never, upserts, inCalls, deletes };
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

  it("bağ sorgusu en çok 100 kimlikle parçalanır", async () => {
    const { db, inCalls } = fakeDb([]);
    const rows = Array.from({ length: 250 }, (_, i) => ad({ objectId: `a${i}` }));
    await upsertAdObjects(db, rows);
    expect(inCalls.map((c) => c.length)).toEqual([100, 100, 50]);
  });

  it("yazımdan sonra bu koşuda görülmeyen platform satırları silinir", async () => {
    const { db, upserts, deletes } = fakeDb([]);
    await upsertAdObjects(db, [ad()]);
    expect(deletes).toHaveLength(1);
    expect(deletes[0].platform).toBe("meta");
    expect(deletes[0].level).toBe("ad");
    expect(deletes[0].ltSyncedAt).toBe(upserts[0][0].synced_at);
  });

  it("temizlik seviye bazlıdır: satır gelmeyen seviyeye dokunulmaz", async () => {
    const { db, deletes } = fakeDb([]);
    await upsertAdObjects(db, [ad(), ad({ level: "adset", objectId: "s1" })]);
    expect(deletes.map((d) => d.level).sort()).toEqual(["ad", "adset"]);
    expect(deletes.some((d) => d.level === "campaign")).toBe(false);
  });

  it("inceleme durumu ve açıklaması yüke girer; reklam dışı satırda null", async () => {
    const { db, upserts } = fakeDb([]);
    await upsertAdObjects(db, [
      ad({ effectiveStatus: "DISAPPROVED", reviewFeedback: "Yanıltıcı iddia" }),
      ad({ level: "adset", objectId: "s1", contentCode: null }),
    ]);
    expect(upserts[0][0]).toMatchObject({ effective_status: "DISAPPROVED", review_feedback: "Yanıltıcı iddia" });
    expect(upserts[0][1]).toMatchObject({ effective_status: null, review_feedback: null });
  });

  it("yazım patlarsa temizlik yapılmaz", async () => {
    const { db, deletes } = fakeDb([]);
    const failing = {
      from: (t: string) => (t === "ad_objects" ? { upsert: () => Promise.resolve({ error: { message: "x" } }) } : (db as never as { from: (t: string) => unknown }).from(t)),
    };
    await expect(upsertAdObjects(failing as never, [ad()])).rejects.toThrow("ad_objects yazılamadı");
    expect(deletes).toHaveLength(0);
  });
});

describe("insertCreatedAdObjects", () => {
  function fakeDb(fail?: string) {
    const calls: { table: string; op: string; rows?: Record<string, unknown>[]; opts?: unknown }[] = [];
    const db = {
      from: (table: string) => ({
        upsert: (rows: Record<string, unknown>[], opts?: unknown) => {
          calls.push({ table, op: "upsert", rows, opts });
          return Promise.resolve({ error: fail === table ? { message: "x" } : null });
        },
        delete: () => {
          calls.push({ table, op: "delete" });
          const q: Record<string, unknown> = { eq: () => q, lt: () => Promise.resolve({ error: null }) };
          return q;
        },
        select: () => {
          calls.push({ table, op: "select" });
          const q: Record<string, unknown> = { eq: () => q, in: () => Promise.resolve({ data: [], error: null }) };
          return q;
        },
      }),
    };
    return { db: db as never, calls };
  }
  const created: AdObjectSyncRow[] = [
    { platform: "meta", level: "ad", objectId: "a9", parentId: "s1", campaignId: "c1", name: "R-2645-A · Gün", status: "ACTIVE", dailyBudgetMicros: null, budgetResource: null, contentCode: "R-2645-A", effectiveStatus: "PENDING_REVIEW" },
    { platform: "meta", level: "campaign", objectId: "c1", parentId: null, campaignId: "c1", name: "Test · Instagram", status: "PAUSED", dailyBudgetMicros: 2_000_000_000, budgetResource: "c1", contentCode: null },
  ];

  it("temizlik yapmadan upsert eder, içerik bağını aktörle yazar", async () => {
    const { db, calls } = fakeDb();
    await insertCreatedAdObjects(db, created, "u1");
    expect(calls.some((c) => c.op === "delete")).toBe(false);
    const obj = calls.find((c) => c.table === "ad_objects" && c.op === "upsert")!;
    expect(obj.opts).toEqual({ onConflict: "platform,level,object_id" });
    expect(obj.rows).toHaveLength(2);
    expect(obj.rows![0]).toMatchObject({
      platform: "meta", level: "ad", object_id: "a9", parent_id: "s1", campaign_id: "c1", content_code: "R-2645-A",
      effective_status: "PENDING_REVIEW", review_feedback: null, status: "ACTIVE",
    });
    expect(typeof obj.rows![0].synced_at).toBe("string");
    const link = calls.find((c) => c.table === "ad_content_links" && c.op === "upsert")!;
    expect(link.opts).toEqual({ onConflict: "platform,ad_id" });
    expect(link.rows).toEqual([{ platform: "meta", ad_id: "a9", content_code: "R-2645-A", linked_by: "u1" }]);
  });

  it("kodsuz ya da reklam olmayan satırda bağ yazılmaz; boş listede hiçbir şey yapılmaz", async () => {
    const { db, calls } = fakeDb();
    await insertCreatedAdObjects(db, [created[1]], "u1");
    expect(calls.filter((c) => c.table === "ad_content_links")).toHaveLength(0);
    const empty = fakeDb();
    await insertCreatedAdObjects(empty.db, [], "u1");
    expect(empty.calls).toHaveLength(0);
  });

  it("yazım hatası fırlatılır", async () => {
    await expect(insertCreatedAdObjects(fakeDb("ad_objects").db, created, "u1")).rejects.toThrow("ad_objects yazılamadı");
    await expect(insertCreatedAdObjects(fakeDb("ad_content_links").db, created, "u1")).rejects.toThrow("ad_content_links yazılamadı");
  });
});
