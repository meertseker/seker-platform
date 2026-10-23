import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { refreshExclusionAudience, fetchGoogleCampaignStates, fetchMetaObjects, upsertAdObjects, getAccessToken, fetchCampaignSpend, ingestConversion, store, metaStore, fetchMetaAdSpend, uploadMetaPending } =
  vi.hoisted(() => ({
    refreshExclusionAudience: vi.fn(),
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
vi.mock("@/lib/ads/audience-refresh", async (orig) => ({
  ...(await orig<typeof import("@/lib/ads/audience-refresh")>()),
  refreshExclusionAudience,
}));

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

const META_ENV = { META_ACCESS_TOKEN: "tok", META_APP_SECRET: "sec", META_AD_ACCOUNT_ID: "42" };
const GOOGLE_ENV = {
  GOOGLE_ADS_CLIENT_ID: "cid",
  GOOGLE_ADS_CLIENT_SECRET: "csec",
  GOOGLE_ADS_REFRESH_TOKEN: "rt",
  GOOGLE_ADS_CUSTOMER_ID: "1234567890",
  GOOGLE_ADS_CONVERSION_ACTION_RANDEVU: "111",
  GOOGLE_ADS_CONVERSION_ACTION_KAYIT: "222",
};

function stub(env: Record<string, string>) {
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
}
const req = () => new NextRequest("http://localhost/api/cron/ads", { headers: { authorization: "Bearer s3cret" } });

// Salı 20 Ekim 2026 09:00 İstanbul; Pazartesi 19 Ekim 09:00 İstanbul.
const TUESDAY = new Date("2026-10-20T06:00:00Z");
const MONDAY = new Date("2026-10-19T06:00:00Z");
const BASE_META = { spendRows: 0, sent: 0, failed: 0, skipped: 0, capi: "kapali", objects: 0 };

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  inserts.length = 0;
  yoneticiler = [{ id: "y1" }];
  fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("gerçek ağ çağrısı yasak"));
  vi.stubEnv("CRON_SECRET", "s3cret");
  for (const k of [...Object.keys(GOOGLE_ENV), ...Object.keys(META_ENV), "META_PIXEL_ID", "META_CAPI_ENABLED"]) vi.stubEnv(k, "");
  vi.spyOn(console, "error").mockImplementation(() => {});
  metaStore.upsertSpend.mockResolvedValue(undefined);
  fetchMetaAdSpend.mockResolvedValue([]);
  uploadMetaPending.mockResolvedValue({ sent: 0, failed: 0, skipped: 0 });
  fetchGoogleCampaignStates.mockResolvedValue([]);
  fetchMetaObjects.mockResolvedValue([]);
  upsertAdObjects.mockImplementation(async (_db: unknown, rows: unknown[]) => rows.length);
  refreshExclusionAudience.mockResolvedValue({ status: "uygulandi", count: 12, message: "✓ Kitle güncellendi" });
});

afterEach(() => {
  expect(fetchSpy).not.toHaveBeenCalled();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/cron/ads · mevcut veli kitlesi (K23)", () => {
  it("cron Salı günü kitleye dokunmaz ve yanıt değişmez", async () => {
    vi.setSystemTime(TUESDAY);
    stub(META_ENV);
    const response = await GET(req());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      skipped: "yapilandirilmamis",
      meta: BASE_META,
      connections: "yenilendi",
    });
    expect(refreshExclusionAudience).not.toHaveBeenCalled();
  });

  it("Pazartesi yanıtta meta.audience", async () => {
    vi.setSystemTime(MONDAY);
    stub(META_ENV);
    const response = await GET(req());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      skipped: "yapilandirilmamis",
      meta: { ...BASE_META, audience: { status: "uygulandi", count: 12 } },
      connections: "yenilendi",
    });
    expect(refreshExclusionAudience).toHaveBeenCalledTimes(1);
    const deps = refreshExclusionAudience.mock.calls[0][0] as { now: Date; cfg: { adAccountId: string } };
    expect(deps.now.toISOString()).toBe(MONDAY.toISOString());
    expect(deps.cfg.adAccountId).toBe("act_42");
  });

  it("Pazartesi İstanbul'a göre: UTC Pazar 22:30 = İstanbul Pazartesi 01:30", async () => {
    vi.setSystemTime(new Date("2026-10-18T22:30:00Z"));
    stub(META_ENV);
    const body = await (await GET(req())).json();
    expect(body.meta.audience).toEqual({ status: "uygulandi", count: 12 });
  });

  it("UTC Pazartesi 22:30 = İstanbul Salı 01:30: kitleye dokunmaz", async () => {
    vi.setSystemTime(new Date("2026-10-19T22:30:00Z"));
    stub(META_ENV);
    const body = await (await GET(req())).json();
    expect(body.meta).not.toHaveProperty("audience");
    expect(refreshExclusionAudience).not.toHaveBeenCalled();
  });

  it("atlandi ve uygulanmadi_kapali hata sayılmaz", async () => {
    vi.setSystemTime(MONDAY);
    stub(META_ENV);
    refreshExclusionAudience.mockResolvedValue({ status: "uygulanmadi_kapali", count: 12, message: "kapalı" });
    const response = await GET(req());
    expect(response.status).toBe(200);
    expect((await response.json()).meta.audience).toEqual({ status: "uygulanmadi_kapali", count: 12 });
  });

  it("kitle hatası 'Meta kitle:' önekiyle bildirime eklenir, diğer Meta sonuçları korunur", async () => {
    vi.setSystemTime(MONDAY);
    stub(META_ENV);
    refreshExclusionAudience.mockResolvedValue({
      status: "hata",
      count: 12,
      message: "Uygulanamadı: Meta'da Özel Hedef Kitle şartları kabul edilmemiş · Mert kabul eder · kayda geçti",
    });
    const response = await GET(req());
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.meta).toMatchObject({ spendRows: 0, objects: 0, audience: { status: "hata", count: 12 } });
    expect(body.error).toContain("Meta kitle: Uygulanamadı: Meta'da Özel Hedef Kitle şartları kabul edilmemiş");
    expect(inserts).toHaveLength(1);
    expect((inserts[0].payload as { message: string }).message).toContain("Meta kitle:");
  });

  it("kitle güncellemesi atarsa meta.audience null ve hata bildirilir", async () => {
    vi.setSystemTime(MONDAY);
    stub(META_ENV);
    refreshExclusionAudience.mockRejectedValue(new Error("beklenmeyen"));
    const response = await GET(req());
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.meta.audience).toBeNull();
    expect(body.error).toContain("Meta kitle: beklenmeyen");
  });

  it("Pazartesi ama Meta yapılandırılmamışsa kitleye dokunmaz, yanıtta meta yok", async () => {
    vi.setSystemTime(MONDAY);
    stub(GOOGLE_ENV);
    getAccessToken.mockResolvedValue("tok");
    fetchCampaignSpend.mockResolvedValue([]);
    store.listPending.mockResolvedValue([]);
    const body = await (await GET(req())).json();
    expect(body).toEqual({ ok: true, spendRows: 0, sent: 0, failed: 0, skipped: 0, objects: 0 });
    expect(refreshExclusionAudience).not.toHaveBeenCalled();
  });
});
