import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { syncOrganicStats, metaStore, fetchMetaAdSpend, uploadMetaPending } = vi.hoisted(() => ({
  syncOrganicStats: vi.fn(),
  metaStore: { upsertSpend: vi.fn(), listPending: vi.fn(), saveOutcomes: vi.fn() },
  fetchMetaAdSpend: vi.fn(),
  uploadMetaPending: vi.fn(),
}));

vi.mock("@/lib/ads/googleAds", () => ({ getAccessToken: vi.fn(), fetchCampaignSpend: vi.fn(), ingestConversion: vi.fn() }));
vi.mock("@/lib/ads/store", () => ({ supabaseAdsStore: () => ({}), supabaseMetaStore: () => metaStore }));
vi.mock("@/lib/ads/meta/insights", () => ({ fetchMetaAdSpend }));
vi.mock("@/lib/ads/meta/capi", () => ({ uploadMetaPending }));
vi.mock("@/lib/content/organic", () => ({ syncOrganicStats }));

const inserts: Array<Record<string, unknown>> = [];
function query(table: string) {
  const q: Record<string, unknown> = {
    select: () => q,
    eq: () => q,
    limit: () => q,
    insert: (rows: Record<string, unknown> | Array<Record<string, unknown>>) => {
      inserts.push(...(Array.isArray(rows) ? rows : [rows]));
      return Promise.resolve({ error: null });
    },
    then: (resolve: (value: unknown) => void) => resolve({ data: table === "profiles" ? [{ id: "y1" }] : [], error: null }),
  };
  return q;
}
vi.mock("@seker/auth/admin", () => ({ createAdminSupabase: () => ({ from: (t: string) => query(t) }) }));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/ads/route";

const META_ENV = { META_ACCESS_TOKEN: "tok", META_APP_SECRET: "sec", META_AD_ACCOUNT_ID: "42" };
const req = () => new NextRequest("http://localhost/api/cron/ads", { headers: { authorization: "Bearer s3cret" } });

beforeEach(() => {
  vi.resetAllMocks();
  inserts.length = 0;
  vi.stubEnv("CRON_SECRET", "s3cret");
  for (const k of ["GOOGLE_ADS_CLIENT_ID", "META_INSTAGRAM_USER_ID", "META_PIXEL_ID", "META_CAPI_ENABLED"]) vi.stubEnv(k, "");
  for (const [k, v] of Object.entries(META_ENV)) vi.stubEnv(k, v);
  vi.spyOn(console, "error").mockImplementation(() => {});
  fetchMetaAdSpend.mockResolvedValue([]);
  uploadMetaPending.mockResolvedValue({ sent: 0, failed: 0, skipped: 0 });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/cron/ads · Meta organik", () => {
  it("META_INSTAGRAM_USER_ID yoksa organik çalışmaz ve yanıtta alan yoktur", async () => {
    const body = await (await GET(req())).json();
    expect(syncOrganicStats).not.toHaveBeenCalled();
    expect(body.meta).not.toHaveProperty("organic");
  });

  it("hesap kimliği varsa organik sayı meta içinde döner", async () => {
    vi.stubEnv("META_INSTAGRAM_USER_ID", "1784");
    syncOrganicStats.mockResolvedValue(3);
    const body = await (await GET(req())).json();
    expect(body.meta).toMatchObject({ spendRows: 0, organic: 3 });
  });

  it("organik hatası 'Meta organik:' önekiyle bildirilir, harcamayı bozmaz", async () => {
    vi.stubEnv("META_INSTAGRAM_USER_ID", "1784");
    syncOrganicStats.mockRejectedValue(new Error("2 gönderi okunamadı"));
    const response = await GET(req());
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain("Meta organik: 2 gönderi okunamadı");
    expect(body.meta).toMatchObject({ spendRows: 0, organic: null });
    expect(inserts[0]?.payload).toMatchObject({ message: expect.stringContaining("Meta organik:") });
  });
});
