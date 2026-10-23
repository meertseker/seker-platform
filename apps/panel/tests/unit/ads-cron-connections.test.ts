import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Sabah cron'u bağlantı durumunu yeniler; hatası harcama ve CAPI sonuçlarını bozmaz.
const { fetchMetaObjects, upsertAdObjects, metaStore, fetchMetaAdSpend, uploadMetaPending, refreshConnections } = vi.hoisted(() => ({
  fetchMetaObjects: vi.fn(),
  upsertAdObjects: vi.fn(),
  metaStore: { upsertSpend: vi.fn(), listPending: vi.fn(), saveOutcomes: vi.fn() },
  fetchMetaAdSpend: vi.fn(),
  uploadMetaPending: vi.fn(),
  refreshConnections: vi.fn(),
}));

vi.mock("@/lib/ads/googleAds", () => ({ getAccessToken: vi.fn(), fetchCampaignSpend: vi.fn(), ingestConversion: vi.fn() }));
vi.mock("@/lib/ads/store", () => ({ supabaseAdsStore: () => ({}), supabaseMetaStore: () => metaStore }));
vi.mock("@/lib/ads/meta/insights", () => ({ fetchMetaAdSpend }));
vi.mock("@/lib/ads/meta/capi", () => ({ uploadMetaPending }));
vi.mock("@/lib/ads/google-objects", () => ({ fetchGoogleCampaignStates: vi.fn() }));
vi.mock("@/lib/ads/meta/objects", () => ({ fetchMetaObjects }));
vi.mock("@/lib/ads/objects-store", () => ({ upsertAdObjects }));
vi.mock("@/lib/ads/connections-cache", () => ({ refreshConnections }));

function query() {
  const q: Record<string, unknown> = {
    select: () => q,
    eq: () => q,
    limit: () => q,
    insert: () => Promise.resolve({ error: null }),
    then: (resolve: (value: unknown) => void) => resolve({ data: [], error: null }),
  };
  return q;
}
vi.mock("@seker/auth/admin", () => ({ createAdminSupabase: () => ({ from: () => query() }) }));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/ads/route";

const META_ENV = { META_ACCESS_TOKEN: "tok", META_APP_SECRET: "sec", META_AD_ACCOUNT_ID: "42" };
const req = () => new NextRequest("http://localhost/api/cron/ads", { headers: { authorization: "Bearer s3cret" } });

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("gerçek ağ çağrısı yasak"));
  vi.stubEnv("CRON_SECRET", "s3cret");
  for (const k of ["GOOGLE_ADS_CLIENT_ID", "META_INSTAGRAM_USER_ID", "META_PIXEL_ID", "META_CAPI_ENABLED", ...Object.keys(META_ENV)]) vi.stubEnv(k, "");
  vi.spyOn(console, "error").mockImplementation(() => {});
  fetchMetaAdSpend.mockResolvedValue([]);
  uploadMetaPending.mockResolvedValue({ sent: 0, failed: 0, skipped: 0 });
  fetchMetaObjects.mockResolvedValue([]);
  upsertAdObjects.mockResolvedValue(0);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/cron/ads · bağlantı durumu", () => {
  it("yenileme patlasa da harcama ve CAPI sonuçları döner, yanıtta connections hata", async () => {
    for (const [k, v] of Object.entries(META_ENV)) vi.stubEnv(k, v);
    refreshConnections.mockRejectedValue(new Error("db koptu"));
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, connections: "hata", meta: { spendRows: 0, sent: 0, capi: "kapali" } });
  });

  it("başarılı yenilemede connections yenilendi", async () => {
    for (const [k, v] of Object.entries(META_ENV)) vi.stubEnv(k, v);
    refreshConnections.mockResolvedValue({});
    const body = await (await GET(req())).json();
    expect(body.connections).toBe("yenilendi");
    expect(refreshConnections).toHaveBeenCalledTimes(1);
  });

  it("Meta yapılandırması yokken çağrılmaz, yanıt bugünkü gibi", async () => {
    const body = await (await GET(req())).json();
    expect(body).toEqual({ ok: true, skipped: "yapilandirilmamis" });
    expect(refreshConnections).not.toHaveBeenCalled();
  });
});
