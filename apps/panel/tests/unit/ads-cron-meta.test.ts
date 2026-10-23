import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchGoogleCampaignStates, fetchMetaObjects, upsertAdObjects, getAccessToken, fetchCampaignSpend, ingestConversion, store, metaStore, fetchMetaAdSpend, uploadMetaPending } =
  vi.hoisted(() => ({
    fetchGoogleCampaignStates: vi.fn(),
    fetchMetaObjects: vi.fn(),
    upsertAdObjects: vi.fn(),
    getAccessToken: vi.fn(),
    fetchCampaignSpend: vi.fn(),
    ingestConversion: vi.fn(),
    store: { upsertSpend: vi.fn(), listPending: vi.fn(), saveOutcomes: vi.fn() },
    metaStore: { upsertSpend: vi.fn(), listPending: vi.fn(), saveOutcomes: vi.fn() },
    fetchMetaAdSpend: vi.fn(),
    uploadMetaPending: vi.fn(),
  }));

vi.mock("@/lib/ads/googleAds", () => ({ getAccessToken, fetchCampaignSpend, ingestConversion }));
vi.mock("@/lib/ads/store", () => ({ supabaseAdsStore: () => store, supabaseMetaStore: () => metaStore }));
vi.mock("@/lib/ads/meta/insights", () => ({ fetchMetaAdSpend }));
vi.mock("@/lib/ads/meta/capi", () => ({ uploadMetaPending }));
vi.mock("@/lib/ads/google-objects", () => ({ fetchGoogleCampaignStates }));
vi.mock("@/lib/ads/meta/objects", () => ({ fetchMetaObjects }));
vi.mock("@/lib/ads/objects-store", () => ({ upsertAdObjects }));

const inserts: Array<Record<string, unknown>> = [];
let yoneticiler: Array<{ id: string }> = [];

function query(table: string) {
  const q: Record<string, unknown> = {
    select: () => q,
    eq: () => q,
    limit: () => q,
    insert: (rows: Record<string, unknown> | Array<Record<string, unknown>>) => {
      inserts.push(...(Array.isArray(rows) ? rows : [rows]));
      return Promise.resolve({ error: null });
    },
    then: (resolve: (value: unknown) => void) =>
      resolve({ data: table === "profiles" ? yoneticiler : [], error: null }),
  };
  return q;
}
// Bağlantı durumu yenilemesi (Paket B) ayrı testte; burada ağa gitmesin.
vi.mock("@/lib/ads/connections-cache", () => ({ refreshConnections: async () => ({}) }));
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

function stub(env: Record<string, string>) {
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
}
const req = () => new NextRequest("http://localhost/api/cron/ads", { headers: { authorization: "Bearer s3cret" } });

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetAllMocks();
  // Salı: Pazartesi kitle güncellemesi (K23) bu dosyanın beklediği yanıta girmesin; o adım ads-cron-audience.test.ts'te.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-27T06:00:00+03:00"));
  inserts.length = 0;
  yoneticiler = [{ id: "y1" }];
  fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("gerçek ağ çağrısı yasak"));
  vi.stubEnv("CRON_SECRET", "s3cret");
  for (const k of [...Object.keys(GOOGLE_ENV), ...Object.keys(META_ENV), "META_PIXEL_ID", "META_CAPI_ENABLED"])
    vi.stubEnv(k, "");
  vi.spyOn(console, "error").mockImplementation(() => {});
  metaStore.upsertSpend.mockResolvedValue(undefined);
  uploadMetaPending.mockResolvedValue({ sent: 0, failed: 0, skipped: 0 });
  fetchGoogleCampaignStates.mockResolvedValue([]);
  fetchMetaObjects.mockResolvedValue([]);
  upsertAdObjects.mockImplementation(async (_db: unknown, rows: unknown[]) => rows.length);
});

afterEach(() => {
  expect(fetchSpy).not.toHaveBeenCalled();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("GET /api/cron/ads · Meta", () => {
  it("yalnız Meta yapılandırılmışsa Google çağrılmaz, meta harcaması yazılır, capi kapalı", async () => {
    stub(META_ENV);
    fetchMetaAdSpend.mockResolvedValue([{ date: "2026-10-14" }, { date: "2026-10-15" }]);
    const response = await GET(req());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      skipped: "yapilandirilmamis",
      meta: { spendRows: 2, sent: 0, failed: 0, skipped: 0, capi: "kapali", objects: 0 },
      connections: "yenilendi",
    });
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(metaStore.upsertSpend).toHaveBeenCalledTimes(1);
  });

  it("Meta harcama hatası Google sonucunu bozmaz ve bildirim Meta önekiyle yazılır", async () => {
    stub({ ...GOOGLE_ENV, ...META_ENV });
    getAccessToken.mockResolvedValue("tok");
    fetchCampaignSpend.mockResolvedValue([]);
    store.listPending.mockResolvedValue([]);
    fetchMetaAdSpend.mockRejectedValue(new Error("190 token süresi doldu"));
    const response = await GET(req());
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({
      ok: false,
      spendRows: 0,
      sent: 0,
      meta: { spendRows: null, capi: "kapali" },
    });
    expect(body.error).toContain("Meta harcama:");
    expect(fetchCampaignSpend).toHaveBeenCalledTimes(1);
    expect(inserts).toHaveLength(1);
    expect((inserts[0].payload as { message: string }).message).toContain("Meta harcama:");
  });

  it("META_CAPI_ENABLED=true ve piksel varken bekleyen olaylar gönderilir", async () => {
    stub({ ...META_ENV, META_PIXEL_ID: "999", META_CAPI_ENABLED: "true" });
    fetchMetaAdSpend.mockResolvedValue([]);
    uploadMetaPending.mockResolvedValue({ sent: 3, failed: 0, skipped: 1 });
    const response = await GET(req());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      skipped: "yapilandirilmamis",
      meta: { spendRows: 0, sent: 3, failed: 0, skipped: 1, capi: "acik", objects: 0 },
      connections: "yenilendi",
    });
    expect(uploadMetaPending).toHaveBeenCalledTimes(1);
  });

  it("Meta yapılandırılmamışken yanıtta meta anahtarı yok", async () => {
    stub(GOOGLE_ENV);
    getAccessToken.mockResolvedValue("tok");
    fetchCampaignSpend.mockResolvedValue([]);
    store.listPending.mockResolvedValue([]);
    const body = await (await GET(req())).json();
    expect(body).toEqual({ ok: true, spendRows: 0, sent: 0, failed: 0, skipped: 0, objects: 0 });
    expect(fetchMetaAdSpend).not.toHaveBeenCalled();
  });

  it.each([
    ["", "https://yeni.sekeranaokulu.com"],
    ["   ", "https://yeni.sekeranaokulu.com"],
    [" https://www.sekeranaokulu.com ", "https://www.sekeranaokulu.com"],
  ])("SITE_PUBLIC_URL=%j iken site adresi %s (boş değer varsayılana düşer, I-5)", async (value, expected) => {
    stub({ ...META_ENV, META_PIXEL_ID: "999", META_CAPI_ENABLED: "true", SITE_PUBLIC_URL: value });
    fetchMetaAdSpend.mockResolvedValue([]);
    await GET(req());
    expect(uploadMetaPending).toHaveBeenCalledTimes(1);
    expect(uploadMetaPending.mock.calls[0][0]).toMatchObject({ siteUrl: expected });
  });
});
