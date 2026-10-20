import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getAccessToken, fetchCampaignSpend, ingestConversion, store } = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  fetchCampaignSpend: vi.fn(),
  ingestConversion: vi.fn(),
  store: { upsertSpend: vi.fn(), listPending: vi.fn(), saveOutcomes: vi.fn() },
}));

vi.mock("@/lib/ads/googleAds", () => ({ getAccessToken, fetchCampaignSpend, ingestConversion }));
vi.mock("@/lib/ads/store", () => ({ supabaseAdsStore: () => store }));

const inserts: Array<Record<string, unknown>> = [];
const existingNotifications = new Set<string>();
let yoneticiler: Array<{ id: string }> = [];

/** Zincirlenebilir, await edilebilir sahte sorgu. */
function query(table: string) {
  const filters: Record<string, unknown> = {};
  const q: Record<string, unknown> = {
    select: () => q,
    eq: (column: string, value: unknown) => {
      filters[column] = value;
      return q;
    },
    limit: () => q,
    insert: (row: Record<string, unknown> | Record<string, unknown>[]) => {
      inserts.push(...(Array.isArray(row) ? row : [row]));
      return Promise.resolve({ error: null });
    },
    then: (resolve: (value: unknown) => void) => {
      if (table === "profiles") return resolve({ data: yoneticiler, error: null });
      const key = `${filters.user_id}|${filters["payload->>tarih"]}`;
      return resolve({ data: existingNotifications.has(key) ? [{ id: "n" }] : [], error: null });
    },
  };
  return q;
}
vi.mock("@seker/auth/admin", () => ({ createAdminSupabase: () => ({ from: (t: string) => query(t) }) }));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/ads/route";

const ADS_ENV = {
  GOOGLE_ADS_CLIENT_ID: "cid",
  GOOGLE_ADS_CLIENT_SECRET: "csec",
  GOOGLE_ADS_REFRESH_TOKEN: "rt",
  GOOGLE_ADS_CUSTOMER_ID: "1234567890",
  GOOGLE_ADS_CONVERSION_ACTION_RANDEVU: "111",
  GOOGLE_ADS_CONVERSION_ACTION_KAYIT: "222",
};

function stubAdsEnv(overrides: Record<string, string> = {}) {
  for (const [k, v] of Object.entries({ ...ADS_ENV, ...overrides })) vi.stubEnv(k, v);
}

function request(auth?: string) {
  return new NextRequest("http://localhost/api/cron/ads", {
    headers: auth ? { authorization: auth } : {},
  });
}

const pending = {
  id: "u1",
  leadId: "l1",
  gclid: "g",
  action: "randevu",
  conversionAt: new Date().toISOString(),
  clickAt: new Date().toISOString(),
  value: null,
  adUserData: "granted",
};

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetAllMocks();
  inserts.length = 0;
  existingNotifications.clear();
  yoneticiler = [{ id: "y1" }, { id: "y2" }];
  fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("gerçek ağ çağrısı yasak"));
  vi.stubEnv("CRON_SECRET", "s3cret");
  for (const key of Object.keys(ADS_ENV)) vi.stubEnv(key, "");
  vi.spyOn(console, "error").mockImplementation(() => {});
  store.upsertSpend.mockResolvedValue(undefined);
  store.listPending.mockResolvedValue([]);
  store.saveOutcomes.mockResolvedValue(undefined);
});

afterEach(() => {
  expect(fetchSpy).not.toHaveBeenCalled();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/cron/ads", () => {
  it("yetkisiz istek 401", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("Bearer yanlis"))).status).toBe(401);
    expect(getAccessToken).not.toHaveBeenCalled();
  });

  it("GOOGLE_ADS_* yokken 200 skipped ve Google hiç çağrılmaz", async () => {
    const response = await GET(request("Bearer s3cret"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, skipped: "yapilandirilmamis" });
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(fetchCampaignSpend).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(0);
  });

  it("başarılı koşu harcama ve yükleme sayılarını döner", async () => {
    stubAdsEnv();
    getAccessToken.mockResolvedValue("tok");
    fetchCampaignSpend.mockResolvedValue([
      { date: "2026-10-14", campaignId: "c", campaignName: "n", costMicros: 5, clicks: 1, impressions: 2 },
    ]);
    store.listPending.mockResolvedValue([pending]);
    ingestConversion.mockResolvedValue({ ok: true, requestId: "r" });
    const response = await GET(request("Bearer s3cret"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, spendRows: 1, sent: 1, failed: 0, skipped: 0 });
    expect(inserts).toHaveLength(0);
  });

  it("OAuth hatası 500 ve yönetici başına tek bildirim, tarihe göre tekilleştirilir", async () => {
    stubAdsEnv();
    getAccessToken.mockRejectedValue(new Error("invalid_grant"));
    const response = await GET(request("Bearer s3cret"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("invalid_grant");
    expect(inserts).toHaveLength(2);
    expect(inserts.map((i) => i.user_id).sort()).toEqual(["y1", "y2"]);
    expect(inserts.every((i) => i.type === "ads_senkron_hata")).toBe(true);
    const payload = inserts[0].payload as { message: string; tarih: string };
    expect(payload.tarih).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(payload.message).toContain("invalid_grant");
    expect(fetchCampaignSpend).not.toHaveBeenCalled();
    expect(store.listPending).not.toHaveBeenCalled();

    // aynı gün ikinci koşu: iki yönetici de zaten bildirilmiş
    existingNotifications.add(`y1|${payload.tarih}`);
    existingNotifications.add(`y2|${payload.tarih}`);
    inserts.length = 0;
    await GET(request("Bearer s3cret"));
    expect(inserts).toHaveLength(0);
  });

  it("harcama patlasa da yüklemeler çalışır; 500 ve bildirim", async () => {
    stubAdsEnv();
    getAccessToken.mockResolvedValue("tok");
    fetchCampaignSpend.mockRejectedValue(new Error("403 CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION"));
    store.listPending.mockResolvedValue([pending]);
    ingestConversion.mockResolvedValue({ ok: true, requestId: "r" });
    const response = await GET(request("Bearer s3cret"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({ ok: false, sent: 1, failed: 0, skipped: 0, spendRows: null });
    expect(body.error).toContain("Harcama:");
    expect(ingestConversion).toHaveBeenCalledTimes(1);
    expect(store.saveOutcomes).toHaveBeenCalledTimes(1);
    expect(inserts).toHaveLength(2);
  });

  it("developer token olmadan da harcama çekilir ve dönüşümler gider", async () => {
    stubAdsEnv();
    getAccessToken.mockResolvedValue("tok");
    fetchCampaignSpend.mockResolvedValue([]);
    store.listPending.mockResolvedValue([pending]);
    ingestConversion.mockResolvedValue({ ok: true, requestId: "r" });
    const response = await GET(request("Bearer s3cret"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, spendRows: 0, sent: 1, failed: 0, skipped: 0 });
    expect(fetchCampaignSpend).toHaveBeenCalledTimes(1);
  });

  it("saveOutcomes patlarsa hata kaydedilir ve bildirilir", async () => {
    stubAdsEnv();
    getAccessToken.mockResolvedValue("tok");
    fetchCampaignSpend.mockResolvedValue([]);
    store.listPending.mockResolvedValue([pending]);
    ingestConversion.mockResolvedValue({ ok: true, requestId: "r" });
    store.saveOutcomes.mockRejectedValue(new Error("db kapalı"));
    const response = await GET(request("Bearer s3cret"));
    expect(response.status).toBe(500);
    expect((await response.json()).error).toContain("Dönüşüm:");
    expect(inserts).toHaveLength(2);
  });

  it("kayıt başına yükleme hatası 500 ve bildirim üretir", async () => {
    stubAdsEnv();
    getAccessToken.mockResolvedValue("tok");
    fetchCampaignSpend.mockResolvedValue([]);
    store.listPending.mockResolvedValue([pending]);
    ingestConversion.mockResolvedValue({ ok: false, error: "INVALID_ARGUMENT" });
    const response = await GET(request("Bearer s3cret"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({ ok: false, failed: 1 });
    expect(body.error).toContain("Dönüşüm: 1 kayıt gönderilemedi");
    expect(inserts).toHaveLength(2);
  });
});
