import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AdSetup } from "@/lib/ads/ad-setup";
import { DEFAULT_AD_TEMPLATE, type AdTemplate, type AdTemplateInput } from "@/lib/ads/ad-template";
import type { AdChangeLogRow } from "@/lib/ads/writes";

const requireRole = vi.fn();
const revalidatePath = vi.fn();
const createAdmin = vi.fn(() => ({ from: vi.fn() }));
const insertCreatedAdObjects = vi.fn();
let metaTl = 20_000;

const logs: (AdChangeLogRow & { id: string })[] = [];
const changeStore = {
  loadObject: vi.fn(async () => null),
  weekBudgetBaselineTl: vi.fn(async () => null),
  insertLog: vi.fn(async (row: AdChangeLogRow) => {
    const id = `log-${logs.length + 1}`;
    logs.push(structuredClone({ ...row, id }));
    return id;
  }),
  updateLog: vi.fn(async (id: string, patch: { status: AdChangeLogRow["status"]; error: string | null; newValue?: Record<string, unknown> }) => {
    const row = logs.find((l) => l.id === id);
    if (!row) return;
    row.status = patch.status;
    row.error = patch.error;
    if (patch.newValue) row.newValue = structuredClone(patch.newValue);
  }),
  updateObject: vi.fn(),
  updateBudgetRows: vi.fn(),
  linkContent: vi.fn(),
};

const FILLED: AdTemplate = {
  ...DEFAULT_AD_TEMPLATE,
  okulAdres: "Bahçelievler Mah. 1. Sokak No 5, Ankara",
  lat: 39.92,
  lng: 32.85,
};

const setupStore = {
  template: vi.fn(async (): Promise<AdTemplate> => FILLED),
  saveTemplate: vi.fn(async () => undefined),
  setup: vi.fn(async (): Promise<AdSetup | null> => null),
  saveSetup: vi.fn(async () => undefined),
  monthMetaSpendTl: vi.fn(async () => 0),
  objectStatus: vi.fn(async () => null),
  activeStudentNames: vi.fn(async () => []),
  weekLaunches: vi.fn(async () => 0),
  launchInFlight: vi.fn(async () => false),
  campaignSetupInFlight: vi.fn(async () => false),
  testAdForCode: vi.fn(async () => []),
};

vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/lib/auth", () => ({ requireRole: (...a: unknown[]) => requireRole(...a) }));
vi.mock("@seker/auth/admin", () => ({ createAdminSupabase: () => createAdmin() }));
vi.mock("@/lib/ads/ad-settings", async (orig) => {
  const actual = await orig<typeof import("@/lib/ads/ad-settings")>();
  return {
    ...actual,
    getAdSettings: async () => ({ ...actual.DEFAULT_AD_SETTINGS, monthlyBudget: { googleTl: 0, metaTl } }),
  };
});
vi.mock("@/lib/ads/writes", async (orig) => {
  const actual = await orig<typeof import("@/lib/ads/writes")>();
  return { ...actual, supabaseAdChangeStore: () => changeStore };
});
vi.mock("@/lib/ads/setup-store", () => ({ supabaseSetupStore: () => setupStore }));
vi.mock("@/lib/ads/objects-store", () => ({
  insertCreatedAdObjects: (...a: unknown[]) => insertCreatedAdObjects(...a),
}));

import { saveAdTemplate, setupMetaCampaigns } from "@/actions/ad-setup";

const INPUT: AdTemplateInput = {
  okulAdres: "Bahçelievler Mah. 1. Sokak No 5, Ankara",
  lat: 39.92,
  lng: 32.85,
  yaricapKm: 8,
  yasMin: 25,
  yasMax: 45,
  testGunlukTl: 200,
  buyutmeGunlukTl: 400,
  mevcutVelileriHaricTut: true,
  haftalikYeniReklam: 4,
};

const META_ENV = {
  META_ACCESS_TOKEN: "EAAtokentoken",
  META_APP_SECRET: "appsecret123",
  META_AD_ACCOUNT_ID: "act_42",
  META_PIXEL_ID: "777",
};

const fetchSpy = vi.fn();

function okJson(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  vi.clearAllMocks();
  logs.length = 0;
  metaTl = 20_000;
  vi.useFakeTimers();
  // Salı 20 Ekim 2026, 12:00 İstanbul → ayın kalan günü 12 (bugün dahil).
  vi.setSystemTime(new Date("2026-10-20T09:00:00Z"));
  vi.stubGlobal("fetch", fetchSpy);
  vi.stubEnv("ADS_WRITE_ENABLED", "");
  for (const [k, v] of Object.entries(META_ENV)) vi.stubEnv(k, v);
  requireRole.mockResolvedValue({ id: "yon-1", role: "yonetici" });
  setupStore.template.mockResolvedValue(FILLED);
  setupStore.setup.mockResolvedValue(null);
  setupStore.monthMetaSpendTl.mockResolvedValue(0);
  setupStore.campaignSetupInFlight.mockResolvedValue(false);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("rol", () => {
  it("danışman şablon kaydedemez ve kurulum yapamaz (gizli istemci oluşturulmaz)", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(saveAdTemplate(INPUT)).rejects.toThrow("NEXT_REDIRECT");
    await expect(setupMetaCampaigns({ mode: "kur" })).rejects.toThrow("NEXT_REDIRECT");
    expect(requireRole).toHaveBeenCalledWith("yonetici");
    expect(createAdmin).not.toHaveBeenCalled();
    expect(changeStore.insertLog).not.toHaveBeenCalled();
    expect(setupStore.saveTemplate).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("saveAdTemplate", () => {
  it("geçersiz şablonu reddeder, yazmaz", async () => {
    const res = await saveAdTemplate({ ...INPUT, yaricapKm: 0 });
    expect(res).toEqual({ error: "Yarıçap 1–80 km olmalı." });
    expect(changeStore.insertLog).not.toHaveBeenCalled();
    expect(setupStore.saveTemplate).not.toHaveBeenCalled();
  });

  it("şablon tavanı aşıyorsa kaydedilmez (B8)", async () => {
    // 1.000 + (200 + 400) × 12 = 8.200 TL > 8.000 TL
    metaTl = 8_000;
    setupStore.monthMetaSpendTl.mockResolvedValue(1_000);
    const res = await saveAdTemplate(INPUT);
    expect(res).toHaveProperty("error");
    expect("error" in res && res.error).toContain("Aylık Meta bütçesi yetmiyor");
    expect(setupStore.monthMetaSpendTl).toHaveBeenCalledWith("2026-10-20");
    expect(changeStore.insertLog).not.toHaveBeenCalled();
    expect(setupStore.saveTemplate).not.toHaveBeenCalled();
  });

  it("metaTl 0 mesajı", async () => {
    metaTl = 0;
    expect(await saveAdTemplate(INPUT)).toEqual({ error: "Aylık Meta bütçesi Ayarlar'da 0" });
    expect(setupStore.saveTemplate).not.toHaveBeenCalled();
  });

  it("şablon updatedBy ve updatedAt ile yazılır", async () => {
    const res = await saveAdTemplate(INPUT);
    expect(res).toEqual({ ok: true, message: "Kaydedildi" });
    expect(setupStore.saveTemplate).toHaveBeenCalledWith(INPUT, "yon-1", "2026-10-20T09:00:00.000Z");
    expect(revalidatePath).toHaveBeenCalledWith("/reklam/ayarlar");
  });

  it("Ruling P1: kayıt defterine önce `sablon` satırı yazılır (eski/yeni şablon)", async () => {
    setupStore.template.mockResolvedValue({ ...FILLED, yaricapKm: 5, updatedBy: "yon-0", updatedAt: "2026-10-01T00:00:00Z" });
    await saveAdTemplate(INPUT);
    expect(logs).toHaveLength(1);
    const row = logs[0];
    expect(row).toMatchObject({
      action: "sablon",
      source: "ayarlar",
      platform: "meta",
      level: "ayarlar",
      objectId: "reklam_sablonu",
      objectName: "Reklam şablonu",
      status: "uygulandi",
      actorId: "yon-1",
      reason: null,
      error: null,
      gateRed: false,
      recommendationId: null,
    });
    expect(row.oldValue).toEqual({ ...INPUT, yaricapKm: 5, okulAdres: FILLED.okulAdres });
    expect(row.oldValue).not.toHaveProperty("updatedBy");
    expect(row.oldValue).not.toHaveProperty("updatedAt");
    expect(row.newValue).toEqual(INPUT);
    // Kayıt şablondan önce yazılır.
    expect(changeStore.insertLog.mock.invocationCallOrder[0]).toBeLessThan(setupStore.saveTemplate.mock.invocationCallOrder[0]);
  });

  it("kayıt yazılamazsa şablon kaydedilmez", async () => {
    changeStore.insertLog.mockRejectedValueOnce(new Error("db"));
    expect(await saveAdTemplate(INPUT)).toEqual({ error: "Kayıt yazılamadı; değişiklik yapılmadı." });
    expect(setupStore.saveTemplate).not.toHaveBeenCalled();
  });

  it("şablon yazılamazsa kayıt `hata` olur", async () => {
    setupStore.saveTemplate.mockRejectedValueOnce(new Error("db"));
    const res = await saveAdTemplate(INPUT);
    expect(res).toEqual({ error: "Şablon kaydedilemedi, tekrar deneyin." });
    expect(logs[0]).toMatchObject({ status: "hata" });
  });
});

describe("setupMetaCampaigns", () => {
  const EXISTING: AdSetup = {
    testCampaignId: "1",
    testAdsetId: "2",
    scaleCampaignId: "3",
    scaleAdsetId: "4",
    exclusionAudienceId: null,
    createdAt: "2026-10-01T00:00:00Z",
    createdBy: "yon-1",
  };

  it("Meta yapılandırması yoksa reddedilir", async () => {
    vi.stubEnv("META_ACCESS_TOKEN", "");
    expect(await setupMetaCampaigns({ mode: "kur" })).toEqual({ error: "Meta bağlı değil" });
    expect(changeStore.insertLog).not.toHaveBeenCalled();
  });

  it("kurulum zaten varsa reddedilir", async () => {
    setupStore.setup.mockResolvedValue(EXISTING);
    expect(await setupMetaCampaigns({ mode: "kur" })).toEqual({ error: "Test ve Büyütme kampanyaları zaten kurulu." });
    expect(changeStore.insertLog).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("piksel yoksa reddedilir", async () => {
    vi.stubEnv("META_PIXEL_ID", "");
    expect(await setupMetaCampaigns({ mode: "kur" })).toEqual({ error: "Piksel kimliği yok · Mert ekler" });
  });

  it("şablon eksikse reddedilir", async () => {
    setupStore.template.mockResolvedValue(DEFAULT_AD_TEMPLATE);
    expect(await setupMetaCampaigns({ mode: "kur" })).toEqual({ error: "Reklam şablonu eksik: Okul adresi, Okul konumu" });
    expect(changeStore.insertLog).not.toHaveBeenCalled();
  });

  it("aylık tavan aşılıyorsa kurulmaz (B8)", async () => {
    metaTl = 0;
    expect(await setupMetaCampaigns({ mode: "kur" })).toEqual({ error: "Aylık Meta bütçesi Ayarlar'da 0" });
    expect(changeStore.insertLog).not.toHaveBeenCalled();
  });

  it("geçersiz kip reddedilir", async () => {
    expect(await setupMetaCampaigns({ mode: "x" as "kur" })).toEqual({ error: "Geçersiz kip." });
  });

  it("bayrak kapalı: Meta'ya istek yok, reklam_kurulum yazılmaz, sonuç summary taşır", async () => {
    const res = await setupMetaCampaigns({ mode: "kur" });
    expect(res).toMatchObject({ ok: true, status: "uygulanmadi_kapali" });
    expect("summary" in res && res.summary[0]).toContain("Test · Instagram");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setupStore.saveSetup).not.toHaveBeenCalled();
    expect(insertCreatedAdObjects).not.toHaveBeenCalled();
    expect(logs[0]).toMatchObject({
      action: "kampanya_kur",
      level: "campaign",
      objectId: "kurulum",
      source: "ayarlar",
      status: "uygulanmadi_kapali",
    });
  });

  it("bayrak açık + goster: Meta'ya istek yok", async () => {
    vi.stubEnv("ADS_WRITE_ENABLED", "true");
    const res = await setupMetaCampaigns({ mode: "goster" });
    expect(res).toMatchObject({ ok: true, status: "uygulanmadi_kapali" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setupStore.saveSetup).not.toHaveBeenCalled();
  });

  it("bayrak açık + kur: 4 POST (/campaigns, /adsets, /campaigns, /adsets), reklam_kurulum dört kimlikle yazılır, ad_objects'e 4 satır", async () => {
    vi.stubEnv("ADS_WRITE_ENABLED", "true");
    let n = 100;
    fetchSpy.mockImplementation(async () => okJson({ id: String(++n) }));
    const res = await setupMetaCampaigns({ mode: "kur" });
    expect(res).toEqual({
      ok: true,
      status: "uygulandi",
      ids: { testCampaign: "101", testAdset: "102", scaleCampaign: "103", scaleAdset: "104" },
      message: "✓ Test ve Büyütme kampanyaları kuruldu (DURAKLATILMIŞ)",
    });
    const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(urls).toHaveLength(4);
    expect(urls.map((u) => u.replace(/^.*\/act_42/, ""))).toEqual(["/campaigns", "/adsets", "/campaigns", "/adsets"]);
    expect(fetchSpy.mock.calls.every((c) => (c[1] as RequestInit).method === "POST")).toBe(true);

    expect(setupStore.saveSetup).toHaveBeenCalledWith({
      testCampaignId: "101",
      testAdsetId: "102",
      scaleCampaignId: "103",
      scaleAdsetId: "104",
      exclusionAudienceId: null,
      createdAt: "2026-10-20T09:00:00.000Z",
      createdBy: "yon-1",
    });

    expect(insertCreatedAdObjects).toHaveBeenCalledTimes(1);
    const [, rows, actor] = insertCreatedAdObjects.mock.calls[0] as [unknown, Record<string, unknown>[], string];
    expect(actor).toBe("yon-1");
    expect(rows).toHaveLength(4);
    expect(rows).toEqual([
      expect.objectContaining({ platform: "meta", level: "campaign", objectId: "101", parentId: null, campaignId: "101", name: "Test · Instagram", status: "PAUSED", dailyBudgetMicros: 200_000_000, budgetResource: "101", contentCode: null }),
      expect.objectContaining({ platform: "meta", level: "adset", objectId: "102", parentId: "101", campaignId: "101", status: "PAUSED", dailyBudgetMicros: 200_000_000, budgetResource: "101" }),
      expect.objectContaining({ platform: "meta", level: "campaign", objectId: "103", parentId: null, campaignId: "103", name: "Büyütme · Instagram", status: "PAUSED", dailyBudgetMicros: 400_000_000, budgetResource: "103" }),
      expect.objectContaining({ platform: "meta", level: "adset", objectId: "104", parentId: "103", campaignId: "103", status: "PAUSED", dailyBudgetMicros: 400_000_000, budgetResource: "103" }),
    ]);
    expect(logs[0]).toMatchObject({ action: "kampanya_kur", status: "uygulandi" });
    expect(JSON.stringify(logs)).not.toContain("EAAtokentoken");
    expect(revalidatePath).toHaveBeenCalledWith("/reklam/ayarlar");
  });

  it("kurulum okunamazsa (geçici hata) kurulmaz: istek ve kayıt yok", async () => {
    vi.stubEnv("ADS_WRITE_ENABLED", "true");
    setupStore.setup.mockRejectedValueOnce(new Error("db"));
    expect(await setupMetaCampaigns({ mode: "kur" })).toEqual({ error: "İşlem yapılamadı, tekrar deneyin." });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(changeStore.insertLog).not.toHaveBeenCalled();
    expect(setupStore.saveSetup).not.toHaveBeenCalled();
  });

  it("kurulum sürüyor ya da daha önce uygulandıysa 'kur' reddedilir (son 10 dk penceresiyle sorulur)", async () => {
    vi.stubEnv("ADS_WRITE_ENABLED", "true");
    setupStore.campaignSetupInFlight.mockResolvedValue(true);
    expect(await setupMetaCampaigns({ mode: "kur" })).toEqual({
      error: "Kurulum sürüyor ya da daha önce yapıldı; Reklam Yöneticisi'ni kontrol edin.",
    });
    expect(setupStore.campaignSetupInFlight).toHaveBeenCalledWith("2026-10-20T08:50:00.000Z");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(changeStore.insertLog).not.toHaveBeenCalled();
  });

  it("'goster' kipi kurulum-sürüyor denetimine takılmaz", async () => {
    vi.stubEnv("ADS_WRITE_ENABLED", "true");
    setupStore.campaignSetupInFlight.mockResolvedValue(true);
    const res = await setupMetaCampaigns({ mode: "goster" });
    expect(res).toMatchObject({ ok: true, status: "uygulanmadi_kapali" });
    expect(setupStore.campaignSetupInFlight).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("yarıda patlarsa reklam_kurulum yazılmaz", async () => {
    vi.stubEnv("ADS_WRITE_ENABLED", "true");
    fetchSpy
      .mockResolvedValueOnce(okJson({ id: "101" }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "Invalid parameter", code: 100 } }), {
          status: 400,
          headers: { "content-type": "application/json" },
        }),
      );
    const res = await setupMetaCampaigns({ mode: "kur" });
    expect(res).toHaveProperty("error");
    expect(res).toMatchObject({ ids: { testCampaign: "101" } });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(setupStore.saveSetup).not.toHaveBeenCalled();
    expect(insertCreatedAdObjects).not.toHaveBeenCalled();
    expect(logs[0]).toMatchObject({ status: "hata" });
  });
});

describe("supabaseSetupStore", () => {
  type Rec = { table: string; ops: [string, unknown[]][] };
  function recordingDb(results: Record<string, unknown>) {
    const calls: Rec[] = [];
    const db = {
      from: (table: string) => {
        const rec: Rec = { table, ops: [] };
        calls.push(rec);
        const chain: Record<string, unknown> = {};
        for (const op of ["select", "eq", "in", "gte", "lte", "order", "range", "limit", "upsert", "maybeSingle"]) {
          chain[op] = (...args: unknown[]) => (rec.ops.push([op, args]), chain);
        }
        chain.then = (res: (v: unknown) => unknown) =>
          Promise.resolve(results[table] ?? { data: [], error: null }).then(res);
        return chain;
      },
    };
    return { db, calls };
  }

  async function real() {
    return (await vi.importActual<typeof import("@/lib/ads/setup-store")>("@/lib/ads/setup-store")).supabaseSetupStore;
  }

  it("monthMetaSpendTl ay başından bugüne Meta harcamasını TL döner (mikro / 1.000.000)", async () => {
    const { db, calls } = recordingDb({
      ad_spend_daily: { data: [{ cost_micros: 1_500_000_000 }, { cost_micros: "250500000" }], error: null },
    });
    expect(await (await real())(db as never).monthMetaSpendTl("2026-10-20")).toBe(1750.5);
    const ops = calls[0].ops;
    expect(ops).toContainEqual(["eq", ["platform", "meta"]]);
    expect(ops).toContainEqual(["gte", ["date", "2026-10-01"]]);
    expect(ops).toContainEqual(["lte", ["date", "2026-10-20"]]);
  });

  it("weekLaunches yalnız uygulanan reklam_kur kayıtlarını sayar", async () => {
    const { db, calls } = recordingDb({ ad_change_log: { count: 3, data: null, error: null } });
    expect(await (await real())(db as never).weekLaunches("2026-10-18T21:00:00.000Z")).toBe(3);
    const ops = calls[0].ops;
    expect(ops).toContainEqual(["eq", ["action", "reklam_kur"]]);
    expect(ops).toContainEqual(["eq", ["status", "uygulandi"]]);
    expect(ops).toContainEqual(["gte", ["created_at", "2026-10-18T21:00:00.000Z"]]);
  });

  it("launchInFlight: uygulanmış ya da son 10 dk bekleyen kurulum varsa true", async () => {
    const make = (rows: unknown[]) =>
      recordingDb({
        ad_change_log: { data: rows, error: null },
        content_items: { data: null, error: null },
        app_settings: { data: null, error: null },
      }).db;
    const store = await real();
    const since = "2026-10-20T08:50:00.000Z";
    expect(await store(make([{ status: "uygulandi", error: null, created_at: "2026-10-01T00:00:00Z" }]) as never).launchInFlight("c1", since)).toBe(true);
    expect(
      await store(make([{ status: "hata", error: "Platform yanıtı bekleniyor", created_at: "2026-10-20T08:55:00Z" }]) as never).launchInFlight("c1", since),
    ).toBe(true);
    expect(
      await store(make([{ status: "hata", error: "Platform yanıtı bekleniyor", created_at: "2026-10-20T08:00:00Z" }]) as never).launchInFlight("c1", since),
    ).toBe(false);
    expect(
      await store(make([{ status: "hata", error: "Invalid parameter", created_at: "2026-10-20T08:55:00Z" }]) as never).launchInFlight("c1", since),
    ).toBe(false);
  });

  it("launchInFlight: Test setinde aynı içerik kodlu reklam varsa true", async () => {
    const { db, calls } = recordingDb({
      ad_change_log: { data: [], error: null },
      content_items: { data: { code: "R-2643-A" }, error: null },
      app_settings: {
        data: { value: { testCampaignId: "1", testAdsetId: "2", scaleCampaignId: "3", scaleAdsetId: "4" } },
        error: null,
      },
      ad_objects: { data: [{ object_id: "900" }], error: null },
    });
    expect(await (await real())(db as never).launchInFlight("c1", "2026-10-20T08:50:00.000Z")).toBe(true);
    const obj = calls.find((c) => c.table === "ad_objects");
    expect(obj?.ops).toContainEqual(["eq", ["content_code", "R-2643-A"]]);
    expect(obj?.ops).toContainEqual(["eq", ["parent_id", "2"]]);
  });

  it("campaignSetupInFlight: uygulanmış ya da son 10 dk bekleyen kampanya_kur varsa true; eski bekleyen ve 'goster' kaydı engellemez", async () => {
    const store = await real();
    const since = "2026-10-20T08:50:00.000Z";
    const check = async (rows: unknown[]) => {
      const { db, calls } = recordingDb({ ad_change_log: { data: rows, error: null } });
      const res = await store(db as never).campaignSetupInFlight(since);
      expect(calls[0].ops).toContainEqual(["eq", ["action", "kampanya_kur"]]);
      return res;
    };
    expect(await check([{ status: "uygulandi", error: null, created_at: "2026-10-01T00:00:00Z" }])).toBe(true);
    expect(await check([{ status: "hata", error: "Platform yanıtı bekleniyor", created_at: "2026-10-20T08:55:00Z" }])).toBe(true);
    expect(await check([{ status: "hata", error: "Platform yanıtı bekleniyor", created_at: "2026-10-20T08:00:00Z" }])).toBe(false);
    expect(await check([{ status: "uygulanmadi_kapali", error: null, created_at: "2026-10-20T08:55:00Z" }])).toBe(false);
    expect(await check([{ status: "hata", error: "Invalid parameter", created_at: "2026-10-20T08:55:00Z" }])).toBe(false);
  });

  it("setup() ve template() okuma hatasında atar (varsayılana düşmez)", async () => {
    const store = await real();
    const { db } = recordingDb({ app_settings: { data: null, error: { message: "timeout" } } });
    await expect(store(db as never).setup()).rejects.toThrow();
    await expect(store(db as never).template()).rejects.toThrow();
  });

  it("setup() satır yoksa null, dolu kurulumu okur", async () => {
    const store = await real();
    expect(await store(recordingDb({ app_settings: { data: { value: {} }, error: null } }).db as never).setup()).toBeNull();
    const full = { testCampaignId: "1", testAdsetId: "2", scaleCampaignId: "3", scaleAdsetId: "4" };
    expect(await store(recordingDb({ app_settings: { data: { value: full }, error: null } }).db as never).setup()).toMatchObject(full);
  });

  it("activeStudentNames aktif öğrencilerin tam adlarını döner", async () => {
    const { db, calls } = recordingDb({ students: { data: [{ full_name: "Ayşe Yılmaz" }, { full_name: "Can Demir" }], error: null } });
    expect(await (await real())(db as never).activeStudentNames()).toEqual(["Ayşe Yılmaz", "Can Demir"]);
    expect(calls[0].ops).toContainEqual(["eq", ["status", "aktif"]]);
  });

  it("saveTemplate updatedBy/updatedAt ile upsert eder", async () => {
    const { db, calls } = recordingDb({ app_settings: { error: null } });
    await (await real())(db as never).saveTemplate(INPUT, "yon-1", "2026-10-20T09:00:00.000Z");
    expect(calls[0].ops[0]).toEqual([
      "upsert",
      [{ key: "reklam_sablonu", value: { ...INPUT, updatedBy: "yon-1", updatedAt: "2026-10-20T09:00:00.000Z" } }, { onConflict: "key" }],
    ]);
  });
});
