import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  fetchCampaignSpend: vi.fn(),
  ingestConversion: vi.fn(),
  store: { upsertSpend: vi.fn(), listPending: vi.fn(), saveOutcomes: vi.fn() },
  metaStore: { upsertSpend: vi.fn(), listPending: vi.fn(), saveOutcomes: vi.fn() },
  fetchMetaAdSpend: vi.fn(),
  uploadMetaPending: vi.fn(),
  fetchGoogleCampaignStates: vi.fn(),
  fetchMetaObjects: vi.fn(),
  upsertAdObjects: vi.fn(),
}));

vi.mock("@/lib/ads/googleAds", () => ({
  getAccessToken: m.getAccessToken,
  fetchCampaignSpend: m.fetchCampaignSpend,
  ingestConversion: m.ingestConversion,
}));
vi.mock("@/lib/ads/store", () => ({ supabaseAdsStore: () => m.store, supabaseMetaStore: () => m.metaStore }));
vi.mock("@/lib/ads/meta/insights", () => ({ fetchMetaAdSpend: m.fetchMetaAdSpend }));
vi.mock("@/lib/ads/meta/capi", () => ({ uploadMetaPending: m.uploadMetaPending }));
vi.mock("@/lib/ads/google-objects", () => ({ fetchGoogleCampaignStates: m.fetchGoogleCampaignStates }));
vi.mock("@/lib/ads/meta/objects", () => ({ fetchMetaObjects: m.fetchMetaObjects }));
vi.mock("@/lib/ads/objects-store", () => ({ upsertAdObjects: m.upsertAdObjects }));

const inserts: Array<Record<string, unknown>> = [];
function query(table: string) {
  const q: Record<string, unknown> = {
    select: () => q,
    eq: () => q,
    limit: () => q,
    insert: (row: Record<string, unknown>) => (inserts.push(row), Promise.resolve({ error: null })),
    then: (resolve: (v: unknown) => void) => resolve({ data: table === "profiles" ? [{ id: "y1" }] : [], error: null }),
  };
  return q;
}
vi.mock("@seker/auth/admin", () => ({ createAdminSupabase: () => ({ from: (t: string) => query(t) }) }));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/ads/route";

const GOOGLE_ENV = {
  GOOGLE_ADS_CLIENT_ID: "cid",
  GOOGLE_ADS_CLIENT_SECRET: "csec",
  GOOGLE_ADS_REFRESH_TOKEN: "rt",
  GOOGLE_ADS_CUSTOMER_ID: "1234567890",
  GOOGLE_ADS_CONVERSION_ACTION_RANDEVU: "111",
  GOOGLE_ADS_CONVERSION_ACTION_KAYIT: "222",
};
const META_ENV = { META_ACCESS_TOKEN: "tok", META_APP_SECRET: "sec", META_AD_ACCOUNT_ID: "42" };
const stub = (env: Record<string, string>) => Object.entries(env).forEach(([k, v]) => vi.stubEnv(k, v));
const req = () => new NextRequest("http://localhost/api/cron/ads", { headers: { authorization: "Bearer s3cret" } });

let fetchSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.resetAllMocks();
  inserts.length = 0;
  fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("gerçek ağ çağrısı yasak"));
  vi.stubEnv("CRON_SECRET", "s3cret");
  for (const k of [...Object.keys(GOOGLE_ENV), ...Object.keys(META_ENV)]) vi.stubEnv(k, "");
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.getAccessToken.mockResolvedValue("tok");
  m.fetchCampaignSpend.mockResolvedValue([{}]);
  m.store.listPending.mockResolvedValue([]);
  m.metaStore.upsertSpend.mockResolvedValue(undefined);
  m.fetchMetaAdSpend.mockResolvedValue([{ date: "2026-10-14" }]);
  m.uploadMetaPending.mockResolvedValue({ sent: 0, failed: 0, skipped: 0 });
  m.fetchGoogleCampaignStates.mockResolvedValue([{ a: 1 }, { a: 2 }]);
  m.fetchMetaObjects.mockResolvedValue([{ a: 1 }]);
  m.upsertAdObjects.mockImplementation(async (_db: unknown, rows: unknown[]) => rows.length);
});
afterEach(() => {
  expect(fetchSpy).not.toHaveBeenCalled();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/cron/ads · nesne durumu", () => {
  it("yapılandırılmamışken yanıt birebir aynı ve durum adımı çalışmaz", async () => {
    const response = await GET(req());
    expect(await response.json()).toEqual({ ok: true, skipped: "yapilandirilmamis" });
    expect(m.fetchGoogleCampaignStates).not.toHaveBeenCalled();
    expect(m.fetchMetaObjects).not.toHaveBeenCalled();
  });

  it("iki platform da yapılandırılmışken her ikisinin nesneleri yazılır", async () => {
    stub({ ...GOOGLE_ENV, ...META_ENV });
    const body = await (await GET(req())).json();
    expect(body).toMatchObject({ ok: true, objects: 2, meta: { objects: 1 } });
    expect(m.upsertAdObjects).toHaveBeenCalledTimes(2);
  });

  it("durum hatası harcamayı bozmaz: spendRows korunur, hata Google durum önekiyle bildirilir", async () => {
    stub(GOOGLE_ENV);
    m.fetchGoogleCampaignStates.mockRejectedValue(new Error("sorgu patladı"));
    const response = await GET(req());
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({ ok: false, spendRows: 1, sent: 0, failed: 0, objects: null });
    expect(body.error).toContain("Google durum: sorgu patladı");
    expect(m.fetchCampaignSpend).toHaveBeenCalledTimes(1);
    expect(inserts).toHaveLength(1);
  });

  it("Meta durum hatası Meta harcamasını ve Google'ı bozmaz", async () => {
    stub({ ...GOOGLE_ENV, ...META_ENV });
    m.fetchMetaObjects.mockRejectedValue(new Error("190 süresi doldu"));
    const response = await GET(req());
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({ ok: false, spendRows: 1, objects: 2, meta: { spendRows: 1, objects: null } });
    expect(body.error).toContain("Meta durum: 190 süresi doldu");
    // Çekim başarısızsa yazım da temizlik de çalışmaz: yalnız Google yazıldı.
    expect(m.upsertAdObjects).toHaveBeenCalledTimes(1);
  });
});
