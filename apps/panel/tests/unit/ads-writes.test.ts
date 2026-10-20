import { describe, it, expect, vi } from "vitest";
import { googleGetBudgetMicros, googleSetBudget, googleSetStatus } from "@/lib/ads/google-writes";
import { metaGetDailyBudget, metaSetDailyBudget, metaSetStatus } from "@/lib/ads/meta/writes";
import {
  adsWriteEnabled,
  executeAdChange,
  type AdChangeDeps,
  type AdChangeInput,
  type AdChangeLogRow,
  type AdChangeStore,
  type AdObjectRow,
} from "@/lib/ads/writes";
import { DEFAULT_AD_SETTINGS } from "@/lib/ads/ad-settings";
import type { AdsConfig } from "@/lib/ads/config";
import type { MetaConfig } from "@/lib/ads/meta/config";

const GOOGLE_CFG: AdsConfig = {
  clientId: "cid",
  clientSecret: "gizli-istemci",
  refreshToken: "yenileme-anahtari",
  customerId: "1234567890",
  loginCustomerId: "9876543210",
  conversionActionIds: { randevu: "1", kayit: "2" },
};
const META_CFG: MetaConfig = {
  accessToken: "META-GIZLI-ANAHTAR",
  appSecret: "uygulama-sirri",
  adAccountId: "act_42",
  pixelId: null,
  testEventCode: null,
  capiEnabled: false,
};

const GOOGLE_ENV = {
  GOOGLE_ADS_CLIENT_ID: "cid",
  GOOGLE_ADS_CLIENT_SECRET: "gizli-istemci",
  GOOGLE_ADS_REFRESH_TOKEN: "yenileme-anahtari",
  GOOGLE_ADS_CUSTOMER_ID: "123-456-7890",
  GOOGLE_ADS_CONVERSION_ACTION_RANDEVU: "1",
  GOOGLE_ADS_CONVERSION_ACTION_KAYIT: "2",
};
const META_ENV = { META_ACCESS_TOKEN: "META-GIZLI-ANAHTAR", META_APP_SECRET: "uygulama-sirri", META_AD_ACCOUNT_ID: "42" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("adsWriteEnabled", () => {
  it("yalnız tam olarak \"true\" iken açık", () => {
    expect(adsWriteEnabled({})).toBe(false);
    expect(adsWriteEnabled({ ADS_WRITE_ENABLED: "1" })).toBe(false);
    expect(adsWriteEnabled({ ADS_WRITE_ENABLED: "TRUE" })).toBe(false);
    expect(adsWriteEnabled({ ADS_WRITE_ENABLED: "true" })).toBe(true);
  });
});

describe("Google yazma gövdeleri", () => {
  it("durum: campaigns:mutate, updateMask status, login-customer-id başlığı, developer-token yok", async () => {
    const fetchFn = vi.fn(async () => json({ results: [{ resourceName: "customers/1234567890/campaigns/55" }] }));
    await googleSetStatus(GOOGLE_CFG, "erisim", "55", "PAUSED", fetchFn as unknown as typeof fetch);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://googleads.googleapis.com/v25/customers/1234567890/campaigns:mutate");
    expect(init.method).toBe("POST");
    const h = init.headers as Record<string, string>;
    expect(h.authorization).toBe("Bearer erisim");
    expect(h["login-customer-id"]).toBe("9876543210");
    expect(Object.keys(h).some((k) => k.toLowerCase() === "developer-token")).toBe(false);
    expect(JSON.parse(String(init.body))).toEqual({
      operations: [{ update: { resourceName: "customers/1234567890/campaigns/55", status: "PAUSED" }, updateMask: "status" }],
    });
  });

  it("bütçe: campaignBudgets:mutate, amountMicros metin, updateMask amount_micros", async () => {
    const fetchFn = vi.fn(async () => json({ results: [{}] }));
    await googleSetBudget(GOOGLE_CFG, "erisim", "customers/1234567890/campaignBudgets/77", 180_000_000, fetchFn as unknown as typeof fetch);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://googleads.googleapis.com/v25/customers/1234567890/campaignBudgets:mutate");
    expect(JSON.parse(String(init.body))).toEqual({
      operations: [
        { update: { resourceName: "customers/1234567890/campaignBudgets/77", amountMicros: "180000000" }, updateMask: "amount_micros" },
      ],
    });
  });

  it("başka müşterinin bütçe kaynağına ve bozuk kimliğe istek atmaz", async () => {
    const fetchFn = vi.fn();
    await expect(
      googleSetBudget(GOOGLE_CFG, "erisim", "customers/999/campaignBudgets/77", 1, fetchFn as unknown as typeof fetch),
    ).rejects.toThrow();
    await expect(googleSetStatus(GOOGLE_CFG, "erisim", "55/../x", "PAUSED", fetchFn as unknown as typeof fetch)).rejects.toThrow();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("hata yanıtında Google mesajını taşır, erişim anahtarını taşımaz", async () => {
    const fetchFn = vi.fn(async () => json({ error: { message: "yetki yok erisim" } }, 403));
    const err = await googleSetStatus(GOOGLE_CFG, "erisim", "55", "ENABLED", fetchFn as unknown as typeof fetch).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain("yetki yok");
    expect((err as Error).message).not.toContain("erisim");
  });
});

describe("Meta yazma gövdeleri", () => {
  it("durum: POST /<id> status=PAUSED, anahtar başlıkta, URL'de değil", async () => {
    const fetchFn = vi.fn(async () => json({ success: true }));
    await metaSetStatus(META_CFG, "120000111", "PAUSED", fetchFn as unknown as typeof fetch);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v26.0/120000111");
    expect(url).not.toContain("META-GIZLI-ANAHTAR");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer META-GIZLI-ANAHTAR");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("status")).toBe("PAUSED");
    expect(body.get("appsecret_proof")).toMatch(/^[0-9a-f]{64}$/);
    expect(body.get("access_token")).toBeNull();
  });

  it("bütçe: daily_budget kuruş (TRY ×100) tam sayı", async () => {
    const fetchFn = vi.fn(async () => json({ success: true }));
    await metaSetDailyBudget(META_CFG, "120000222", 18_050, fetchFn as unknown as typeof fetch);
    const body = new URLSearchParams(String((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.get("daily_budget")).toBe("18050");
  });

  it("success:true yoksa hata; hata mesajında anahtar ve proof yok", async () => {
    const ok = vi.fn(async () => json({ success: false }));
    await expect(metaSetStatus(META_CFG, "1", "ACTIVE", ok as unknown as typeof fetch)).rejects.toThrow();
    const bad = vi.fn(async () => json({ error: { message: "Invalid token META-GIZLI-ANAHTAR", code: 190 } }, 400));
    const err = (await metaSetStatus(META_CFG, "1", "ACTIVE", bad as unknown as typeof fetch).catch((e: Error) => e)) as Error;
    expect(err.message).not.toContain("META-GIZLI-ANAHTAR");
    expect(err.message).toContain("[gizli]");
  });

  it("bozuk kimlik ve kuruş reddedilir, istek atılmaz", async () => {
    const fetchFn = vi.fn();
    await expect(metaSetStatus(META_CFG, "act_1/insights", "PAUSED", fetchFn as unknown as typeof fetch)).rejects.toThrow();
    await expect(metaSetDailyBudget(META_CFG, "1", 10.5, fetchFn as unknown as typeof fetch)).rejects.toThrow();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

// ---- Kapı (executeAdChange) ----

type Logged = AdChangeLogRow & { id: string };

function fakeStore(
  objects: AdObjectRow[],
  opts: { baselineTl?: number | null; insertFails?: boolean; updateLogFails?: boolean } = {},
) {
  const logs: Logged[] = [];
  const objectUpdates: { key: [string, string, string]; patch: Record<string, unknown> }[] = [];
  const budgetUpdates: { platform: string; budgetResource: string; micros: number }[] = [];
  const store: AdChangeStore = {
    loadObject: vi.fn(async (platform, level, objectId) =>
      objects.find((o) => o.platform === platform && o.level === level && o.objectId === objectId) ?? null,
    ),
    weekBudgetBaselineTl: vi.fn(async () => opts.baselineTl ?? null),
    insertLog: vi.fn(async (row: AdChangeLogRow) => {
      if (opts.insertFails) throw new Error("db");
      const id = `log-${logs.length + 1}`;
      logs.push({ ...row, id });
      return id;
    }),
    updateLog: vi.fn(async (id: string, patch: Partial<AdChangeLogRow>) => {
      if (opts.updateLogFails) throw new Error("db");
      const row = logs.find((l) => l.id === id);
      if (row) Object.assign(row, patch);
    }),
    updateObject: vi.fn(async (platform, level, objectId, patch) => {
      objectUpdates.push({ key: [platform, level, objectId], patch });
    }),
    updateBudgetRows: vi.fn(async (platform, budgetResource, micros) => {
      budgetUpdates.push({ platform, budgetResource, micros });
    }),
  };
  return { store, logs, objectUpdates, budgetUpdates };
}

const META_AD: AdObjectRow = {
  platform: "meta",
  level: "adset",
  objectId: "120000111",
  name: "R-2641-A · Bir günümüz",
  status: "ACTIVE",
  dailyBudgetMicros: 150_000_000,
  budgetResource: "120000111",
};
const GOOGLE_CAMPAIGN: AdObjectRow = {
  platform: "google",
  level: "campaign",
  objectId: "55",
  name: "TR_K2-A",
  status: "ENABLED",
  dailyBudgetMicros: 150_000_000,
  budgetResource: "customers/1234567890/campaignBudgets/77",
};

function deps(
  store: AdChangeStore,
  over: Partial<Omit<AdChangeDeps, "store">> & { red?: boolean } = {},
): AdChangeDeps {
  const { red = false, ...rest } = over;
  return {
    store,
    actorId: "yon-1",
    env: {},
    fetchFn: vi.fn(async () => {
      throw new Error("gerçek istek yok");
    }) as unknown as typeof fetch,
    settings: async () => DEFAULT_AD_SETTINGS,
    gateStatus: vi.fn(async () => (red ? { red: true, labels: ["Randevu verilen"] } : { red: false, labels: [] })),
    ...rest,
  };
}

const pause = (o: AdObjectRow = META_AD): AdChangeInput => ({
  platform: o.platform,
  level: o.level,
  objectId: o.objectId,
  objectName: o.name,
  kind: "pause",
  source: "kampanyalar",
});
const budget = (tl: number, o: AdObjectRow = META_AD, reason?: string): AdChangeInput => ({
  platform: o.platform,
  level: o.level,
  objectId: o.objectId,
  objectName: o.name,
  kind: "budget",
  newDailyBudgetTl: tl,
  source: "kampanyalar",
  reason,
});

describe("executeAdChange · canlı yazım kapalı", () => {
  it("platforma hiç istek atmaz, kayıt uygulanmadi_kapali", async () => {
    const { store, logs, objectUpdates } = fakeStore([META_AD]);
    const d = deps(store);
    const res = await executeAdChange(d, pause());
    expect(res).toEqual({ ok: true, status: "uygulanmadi_kapali", message: "Kaydedildi · uygulanmadı: canlı yazım kapalı" });
    expect(d.fetchFn).not.toHaveBeenCalled();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      platform: "meta",
      level: "adset",
      objectId: "120000111",
      action: "pause",
      status: "uygulanmadi_kapali",
      oldValue: { status: "ACTIVE" },
      newValue: { status: "PAUSED" },
      actorId: "yon-1",
      source: "kampanyalar",
    });
    expect(objectUpdates).toEqual([]);
  });

  it("ADS_WRITE_ENABLED=\"1\" de kapalı sayılır", async () => {
    const { store } = fakeStore([META_AD]);
    const d = deps(store, { env: { ...META_ENV, ADS_WRITE_ENABLED: "1" } });
    const res = await executeAdChange(d, pause());
    expect(res).toMatchObject({ status: "uygulanmadi_kapali" });
    expect(d.fetchFn).not.toHaveBeenCalled();
  });
});

describe("executeAdChange · kırmızı kapı (Review Focus 1-2)", () => {
  it("kırmızı kapıda gerekçesiz bütçe artışı reddedilir, kayıt yazılmaz", async () => {
    const { store, logs } = fakeStore([META_AD]);
    const res = await executeAdChange(deps(store, { red: true }), budget(165));
    expect(res).toMatchObject({ needsReason: true });
    expect("error" in res && res.error).toContain("Bir kapı kırmızı (Randevu verilen)");
    expect(logs).toHaveLength(0);
  });

  it("10 karakterden kısa gerekçe de reddedilir", async () => {
    const { store, logs } = fakeStore([META_AD]);
    const res = await executeAdChange(deps(store, { red: true }), budget(165, META_AD, "   kısa    "));
    expect(res).toMatchObject({ needsReason: true });
    expect(logs).toHaveLength(0);
  });

  it("gerekçeyle kabul, gate_red=true ve gerekçe kayda yazılır", async () => {
    const { store, logs } = fakeStore([META_AD]);
    const res = await executeAdChange(deps(store, { red: true }), budget(165, META_AD, "Kayıt dönemi son haftası"));
    expect(res).toMatchObject({ ok: true, status: "uygulanmadi_kapali" });
    expect(logs[0]).toMatchObject({
      action: "budget",
      gateRed: true,
      reason: "Kayıt dönemi son haftası",
      oldValue: { daily_budget_tl: 150 },
      newValue: { daily_budget_tl: 165 },
    });
  });

  it("kırmızı kapıda durdurma gerekçesiz geçer", async () => {
    const { store, logs } = fakeStore([META_AD]);
    const res = await executeAdChange(deps(store, { red: true }), pause());
    expect(res).toMatchObject({ ok: true });
    expect(logs[0]).toMatchObject({ action: "pause", gateRed: true, reason: null });
  });

  it("kırmızı kapıda bütçe azaltma gerekçesiz geçer", async () => {
    const { store, logs } = fakeStore([META_AD]);
    const res = await executeAdChange(deps(store, { red: true }), budget(100));
    expect(res).toMatchObject({ ok: true });
    expect(logs[0]).toMatchObject({ action: "budget", reason: null, newValue: { daily_budget_tl: 100 } });
  });

  it("kapılar hesaplanamazsa artış reddedilir (kapalı kapı), durdurma yine geçer", async () => {
    const { store, logs } = fakeStore([META_AD]);
    const failing = vi.fn(async () => {
      throw new Error("db");
    });
    const inc = await executeAdChange(deps(store, { gateStatus: failing }), budget(160));
    expect(inc).toHaveProperty("error");
    expect(logs).toHaveLength(0);
    const p = await executeAdChange(deps(store, { gateStatus: failing }), pause());
    expect(p).toMatchObject({ ok: true });
    expect(logs[0]).toMatchObject({ action: "pause", gateRed: false });
  });
});

describe("executeAdChange · haftalık büyütme sınırı", () => {
  it("%20 üstü artış gerekçe ister (kapılar yeşilken de)", async () => {
    const { store, logs } = fakeStore([META_AD]);
    const res = await executeAdChange(deps(store), budget(181));
    expect(res).toMatchObject({ needsReason: true });
    expect("error" in res && res.error).toContain("%20");
    expect(logs).toHaveLength(0);
  });

  it("tam %20 gerekçesiz geçer", async () => {
    const { store, logs } = fakeStore([META_AD]);
    const res = await executeAdChange(deps(store), budget(180));
    expect(res).toMatchObject({ ok: true });
    expect(logs[0]).toMatchObject({ gateRed: false, reason: null });
  });

  it("sınır haftanın başındaki bütçeye göre: 150→180 uygulandıysa 180→190 gerekçe ister", async () => {
    const { store } = fakeStore([{ ...META_AD, dailyBudgetMicros: 180_000_000 }], { baselineTl: 150 });
    const res = await executeAdChange(deps(store), budget(190));
    expect(res).toMatchObject({ needsReason: true });
  });

  it("eski bütçe bilinmiyorsa artış gerekçe ister", async () => {
    const { store } = fakeStore([{ ...META_AD, dailyBudgetMicros: null }]);
    const res = await executeAdChange(deps(store), budget(50));
    expect(res).toMatchObject({ needsReason: true });
  });

  it("ayardaki scaleMaxPct kullanılır", async () => {
    const { store } = fakeStore([META_AD]);
    const res = await executeAdChange(
      deps(store, { settings: async () => ({ ...DEFAULT_AD_SETTINGS, scaleMaxPct: 50 }) }),
      budget(220),
    );
    expect(res).toMatchObject({ ok: true });
  });
});

describe("executeAdChange · doğrulama", () => {
  it("panelde olmayan nesne, bozuk kimlik ve geçersiz bütçe reddedilir", async () => {
    const { store, logs } = fakeStore([META_AD]);
    const d = deps(store);
    expect(await executeAdChange(d, { ...pause(), objectId: "999" })).toHaveProperty("error");
    expect(await executeAdChange(d, { ...pause(), objectId: "1 or 1=1" })).toHaveProperty("error");
    expect(await executeAdChange(d, budget(0))).toHaveProperty("error");
    expect(await executeAdChange(d, budget(Number.NaN))).toHaveProperty("error");
    expect(await executeAdChange(d, budget(150))).toHaveProperty("error");
    expect(await executeAdChange(d, { ...pause(), kind: "create" as never })).toHaveProperty("error");
    expect(await executeAdChange(d, { ...pause(), source: "x" as never })).toHaveProperty("error");
    expect(await executeAdChange(d, { ...pause(), recommendationId: "bozuk" })).toHaveProperty("error");
    expect(logs).toHaveLength(0);
  });

  it("Google'da yalnız kampanya düzeyi", async () => {
    const { store } = fakeStore([{ ...GOOGLE_CAMPAIGN, level: "adset" }]);
    expect(await executeAdChange(deps(store), pause({ ...GOOGLE_CAMPAIGN, level: "adset" }))).toHaveProperty("error");
  });

  it("satırdaki eski durum durdurma/başlatmayı engellemez (platformda tekrar zararsız)", async () => {
    const { store } = fakeStore([{ ...META_AD, status: "PAUSED" }]);
    const fetchFn = vi.fn(async () => json({ success: true }));
    const d = deps(store, { env: { ...META_ENV, ADS_WRITE_ENABLED: "true" }, fetchFn: fetchFn as unknown as typeof fetch });
    expect(await executeAdChange(d, pause())).toMatchObject({ ok: true, status: "uygulandi" });
    const { store: s2 } = fakeStore([{ ...META_AD, status: "ACTIVE" }]);
    const d2 = deps(s2, { env: { ...META_ENV, ADS_WRITE_ENABLED: "true" }, fetchFn: fetchFn as unknown as typeof fetch });
    expect(await executeAdChange(d2, { ...pause(), kind: "resume" })).toMatchObject({ ok: true, status: "uygulandi" });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("bütçesi olmayan nesnede bütçe değiştirilmez", async () => {
    const { store } = fakeStore([{ ...META_AD, budgetResource: null }]);
    expect(await executeAdChange(deps(store), budget(140))).toHaveProperty("error");
  });

  it("kayıt yazılamazsa platforma gidilmez", async () => {
    const { store } = fakeStore([META_AD], { insertFails: true });
    const d = deps(store, { env: { ...META_ENV, ADS_WRITE_ENABLED: "true" } });
    expect(await executeAdChange(d, pause())).toHaveProperty("error");
    expect(d.fetchFn).not.toHaveBeenCalled();
  });
});

describe("executeAdChange · canlı yazım açık", () => {
  it("Google durdurma: gövde updateMask status, kayıt uygulandi, ad_objects güncellenir", async () => {
    const { store, logs, objectUpdates } = fakeStore([GOOGLE_CAMPAIGN]);
    const fetchFn = vi.fn(async (url: string) =>
      url.includes("oauth2") ? json({ access_token: "erisim" }) : json({ results: [{}] }),
    );
    const res = await executeAdChange(
      deps(store, { env: { ...GOOGLE_ENV, ADS_WRITE_ENABLED: "true" }, fetchFn: fetchFn as unknown as typeof fetch }),
      pause(GOOGLE_CAMPAIGN),
    );
    expect(res).toEqual({ ok: true, status: "uygulandi", message: "✓ TR_K2-A durduruldu · kayda geçti" });
    const mutate = fetchFn.mock.calls.find((c) => String(c[0]).includes("campaigns:mutate")) as unknown as [string, RequestInit];
    expect(JSON.parse(String(mutate[1].body)).operations[0]).toMatchObject({ updateMask: "status", update: { status: "PAUSED" } });
    expect(logs[0]).toMatchObject({ status: "uygulandi", error: null });
    expect(objectUpdates).toEqual([{ key: ["google", "campaign", "55"], patch: { status: "PAUSED" } }]);
  });

  it("Google bütçe: canlı bütçe okunur, kaynak adıyla campaignBudgets:mutate, aynı bütçeli tüm satırlar güncellenir", async () => {
    const { store, objectUpdates, budgetUpdates } = fakeStore([GOOGLE_CAMPAIGN]);
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes("oauth2")) return json({ access_token: "erisim" });
      if (url.includes("searchStream")) return json([{ results: [{ campaignBudget: { amountMicros: "150000000" } }] }]);
      return json({ results: [{}] });
    });
    const res = await executeAdChange(
      deps(store, { env: { ...GOOGLE_ENV, ADS_WRITE_ENABLED: "true" }, fetchFn: fetchFn as unknown as typeof fetch }),
      budget(180, GOOGLE_CAMPAIGN),
    );
    expect(res).toEqual({ ok: true, status: "uygulandi", message: "✓ Bütçe 150 TL → 180 TL · kayda geçti" });
    const call = fetchFn.mock.calls.find((c) => String(c[0]).includes("campaignBudgets:mutate")) as unknown as [string, RequestInit];
    expect(JSON.parse(String(call[1].body)).operations[0].update).toEqual({
      resourceName: "customers/1234567890/campaignBudgets/77",
      amountMicros: "180000000",
    });
    const search = fetchFn.mock.calls.find((c) => String(c[0]).includes("searchStream")) as unknown as [string, RequestInit];
    expect(JSON.parse(String(search[1].body)).query).toBe(
      "SELECT campaign_budget.amount_micros FROM campaign_budget WHERE campaign_budget.resource_name = 'customers/1234567890/campaignBudgets/77'",
    );
    // Tek OAuth: okuma ve yazma aynı erişim anahtarıyla.
    expect(fetchFn.mock.calls.filter((c) => String(c[0]).includes("oauth2"))).toHaveLength(1);
    expect(budgetUpdates).toEqual([{ platform: "google", budgetResource: "customers/1234567890/campaignBudgets/77", micros: 180_000_000 }]);
    expect(objectUpdates).toEqual([]);
  });

  it("Meta durdurma status=PAUSED; başlatma ACTIVE ve mesajı", async () => {
    const { store, logs } = fakeStore([META_AD, { ...META_AD, objectId: "120000333", status: "PAUSED", name: "S-2650-B" }]);
    const fetchFn = vi.fn(async () => json({ success: true }));
    const d = deps(store, { env: { ...META_ENV, ADS_WRITE_ENABLED: "true" }, fetchFn: fetchFn as unknown as typeof fetch });
    const p = await executeAdChange(d, pause());
    expect(p).toMatchObject({ message: "✓ R-2641-A · Bir günümüz durduruldu · kayda geçti" });
    expect(new URLSearchParams(String((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body)).get("status")).toBe("PAUSED");
    const r = await executeAdChange(d, { ...pause(), objectId: "120000333", objectName: "S-2650-B", kind: "resume" });
    expect(r).toMatchObject({ status: "uygulandi", message: "✓ S-2650-B yeniden başladı · kayda geçti" });
    expect(new URLSearchParams(String((fetchFn.mock.calls[1] as unknown as [string, RequestInit])[1].body)).get("status")).toBe("ACTIVE");
    expect(logs.map((l) => l.status)).toEqual(["uygulandi", "uygulandi"]);
  });

  it("Meta bütçe kuruşla bütçenin durduğu nesneye gider", async () => {
    const { store } = fakeStore([{ ...META_AD, budgetResource: "120000999" }]);
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "POST" ? json({ success: true }) : json({ id: "120000999", daily_budget: "15000" }),
    );
    await executeAdChange(
      deps(store, { env: { ...META_ENV, ADS_WRITE_ENABLED: "true" }, fetchFn: fetchFn as unknown as typeof fetch }),
      budget(172.5),
    );
    const [getUrl, getInit] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(getInit.method ?? "GET").toBe("GET");
    expect(getUrl.startsWith("https://graph.facebook.com/v26.0/120000999?")).toBe(true);
    expect(new URL(getUrl).searchParams.get("fields")).toBe("daily_budget");
    expect(new URL(getUrl).searchParams.get("appsecret_proof")).toMatch(/^[0-9a-f]{64}$/);
    expect(getUrl).not.toContain("META-GIZLI-ANAHTAR");
    const [url, init] = fetchFn.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v26.0/120000999");
    expect(new URLSearchParams(String(init.body)).get("daily_budget")).toBe("17250");
  });

  it("platform hatası: kayıt hata + mesaj, anahtar sızmaz, ad_objects değişmez", async () => {
    const { store, logs, objectUpdates } = fakeStore([META_AD]);
    const fetchFn = vi.fn(async () => json({ error: { message: "Token META-GIZLI-ANAHTAR expired", code: 190 } }, 400));
    const res = await executeAdChange(
      deps(store, { env: { ...META_ENV, ADS_WRITE_ENABLED: "true" }, fetchFn: fetchFn as unknown as typeof fetch }),
      pause(),
    );
    expect(res).toHaveProperty("error");
    const msg = (res as { error: string }).error;
    expect(msg).toContain("kayda geçti");
    expect(msg).toContain("expired");
    expect(msg).not.toContain("META-GIZLI-ANAHTAR");
    expect(logs[0].status).toBe("hata");
    expect(logs[0].error).toContain("expired");
    expect(logs[0].error).not.toContain("META-GIZLI-ANAHTAR");
    expect(objectUpdates).toEqual([]);
  });

  it("ağ hatası ve OAuth hatası gizli değer taşımaz", async () => {
    const { store, logs } = fakeStore([GOOGLE_CAMPAIGN]);
    const fetchFn = vi.fn(async () => json({ error: "invalid_grant", error_description: "bad yenileme-anahtari gizli-istemci" }, 400));
    const res = await executeAdChange(
      deps(store, { env: { ...GOOGLE_ENV, ADS_WRITE_ENABLED: "true" }, fetchFn: fetchFn as unknown as typeof fetch }),
      pause(GOOGLE_CAMPAIGN),
    );
    const msg = (res as { error: string }).error;
    expect(msg).not.toContain("yenileme-anahtari");
    expect(msg).not.toContain("gizli-istemci");
    expect(logs[0].error).not.toContain("yenileme-anahtari");

    const net = fakeStore([META_AD]);
    const boom = vi.fn(async () => {
      throw new TypeError("fetch failed META-GIZLI-ANAHTAR");
    });
    const r2 = await executeAdChange(
      deps(net.store, { env: { ...META_ENV, ADS_WRITE_ENABLED: "true" }, fetchFn: boom as unknown as typeof fetch }),
      pause(),
    );
    expect((r2 as { error: string }).error).not.toContain("META-GIZLI-ANAHTAR");
    expect(net.logs[0]).toMatchObject({ status: "hata" });
  });

  it("platform yapılandırılmamışsa hata kaydı, istek yok", async () => {
    const { store, logs } = fakeStore([META_AD]);
    const d = deps(store, { env: { ADS_WRITE_ENABLED: "true" } });
    const res = await executeAdChange(d, pause());
    expect(res).toHaveProperty("error");
    expect(d.fetchFn).not.toHaveBeenCalled();
    expect(logs[0].status).toBe("hata");
  });
});

describe("executeAdChange · canlı bütçe (bayat satır artışı gizleyemez)", () => {
  const ENABLED_META = { ...META_ENV, ADS_WRITE_ENABLED: "true" };
  // Satır 200 TL der; Reklam Yöneticisi'nde 100 TL'ye indirilmiş.
  const STALE = { ...META_AD, dailyBudgetMicros: 200_000_000 };
  const liveMeta = (kurus: string | null, status = 200) =>
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") return json({ success: true });
      if (kurus === null) return json({ error: { message: "boom" } }, status);
      return json({ id: "120000111", daily_budget: kurus });
    });

  it("bayat satırda 200→190 görünen ama canlıda 100→190 olan artış kırmızı kapıda gerekçe ister", async () => {
    const { store, logs } = fakeStore([STALE]);
    const fetchFn = liveMeta("10000");
    const res = await executeAdChange(deps(store, { red: true, env: ENABLED_META, fetchFn: fetchFn as unknown as typeof fetch }), budget(190));
    expect(res).toMatchObject({ needsReason: true });
    expect(logs).toHaveLength(0);
    expect(fetchFn.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === "POST")).toBe(false);
  });

  it("canlı bütçeye göre büyütme sınırı (100→190 = +%90) kapılar yeşilken de gerekçe ister", async () => {
    const { store } = fakeStore([STALE]);
    const res = await executeAdChange(deps(store, { env: ENABLED_META, fetchFn: liveMeta("10000") as unknown as typeof fetch }), budget(190));
    expect(res).toMatchObject({ needsReason: true });
  });

  it("eski değer platformdaki canlı tutar: satırdan yüksekse de o kullanılır ve kayda geçer", async () => {
    const { store, logs } = fakeStore([META_AD]);
    const res = await executeAdChange(
      deps(store, { red: true, env: ENABLED_META, fetchFn: liveMeta("20000") as unknown as typeof fetch }),
      budget(190),
    );
    // 200 → 190 azaltma: gerekçesiz geçer.
    expect(res).toMatchObject({ ok: true, message: "✓ Bütçe 200 TL → 190 TL · kayda geçti" });
    expect(logs[0].oldValue).toMatchObject({ daily_budget_tl: 200, live_budget_tl: 200, budget_resource: "120000111" });
  });

  it("canlı okuma başarısızsa değişiklik artış sayılır: kırmızı kapıda gerekçe ister, gerekçeyle uygulanır", async () => {
    const { store, logs } = fakeStore([STALE]);
    const fetchFn = liveMeta(null, 500);
    const d = deps(store, { red: true, env: ENABLED_META, fetchFn: fetchFn as unknown as typeof fetch });
    expect(await executeAdChange(d, budget(150))).toMatchObject({ needsReason: true });
    const ok = await executeAdChange(d, budget(150, META_AD, "Kayıt dönemi son haftası"));
    expect(ok).toMatchObject({ ok: true, status: "uygulandi" });
    expect(logs[0].oldValue).toMatchObject({ live_budget_tl: null, canli_okuma: "basarisiz" });
  });

  it("canlı okuma başarısız ve haftalık taban yoksa kapı yeşilken de bayat satıra göre azaltma sayılmaz: gerekçe ister", async () => {
    const { store, logs } = fakeStore([STALE]);
    const fetchFn = liveMeta(null, 500);
    const res = await executeAdChange(deps(store, { env: ENABLED_META, fetchFn: fetchFn as unknown as typeof fetch }), budget(190));
    expect(res).toMatchObject({ needsReason: true });
    expect("error" in res && res.error).toContain("eski bütçe bilinmiyor");
    expect(logs).toHaveLength(0);
    expect(fetchFn.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === "POST")).toBe(false);
  });

  it("canlı okuma başarısız ama bu hafta taban varsa sınır tabana göre", async () => {
    const { store } = fakeStore([STALE], { baselineTl: 180 });
    const res = await executeAdChange(
      deps(store, { env: ENABLED_META, fetchFn: liveMeta(null, 500) as unknown as typeof fetch }),
      budget(190),
    );
    expect(res).toMatchObject({ ok: true, status: "uygulandi" });
  });

  it("canlı yazım kapalıyken canlı okuma yapılmaz, satır kullanılır", async () => {
    const { store } = fakeStore([STALE]);
    const d = deps(store, { red: true });
    expect(await executeAdChange(d, budget(190))).toMatchObject({ ok: true, status: "uygulanmadi_kapali" });
    expect(d.fetchFn).not.toHaveBeenCalled();
  });
});

describe("executeAdChange · haftalık sınır bütçe kaynağına göre", () => {
  it("taban bütçe kaynağıyla sorulur; aynı bütçeyi paylaşan ikinci satırdan aşma gerekçe ister", async () => {
    const SHARED = "120000999";
    const a = { ...META_AD, objectId: "120000111", budgetResource: SHARED, dailyBudgetMicros: 180_000_000 };
    const b = { ...META_AD, objectId: "120000222", budgetResource: SHARED, dailyBudgetMicros: 180_000_000 };
    const { store } = fakeStore([a, b], { baselineTl: 150 });
    const res = await executeAdChange(deps(store), budget(200, b));
    expect(res).toMatchObject({ needsReason: true });
    expect(store.weekBudgetBaselineTl).toHaveBeenCalledWith("meta", SHARED, expect.any(String), "120000222");
  });

  it("kayıtta eski ve yeni değer bütçe kaynağını taşır", async () => {
    const { store, logs } = fakeStore([META_AD]);
    await executeAdChange(deps(store), budget(160));
    expect(logs[0].oldValue).toMatchObject({ daily_budget_tl: 150, budget_resource: "120000111" });
    expect(logs[0].newValue).toMatchObject({ daily_budget_tl: 160, budget_resource: "120000111" });
  });
});

describe("executeAdChange · küçük düzeltmeler", () => {
  it("kapı hesaplanamazsa durdurma kaydında not düşülür", async () => {
    const { store, logs } = fakeStore([META_AD]);
    const failing = vi.fn(async () => {
      throw new Error("db");
    });
    await executeAdChange(deps(store, { gateStatus: failing }), pause());
    expect(logs[0].newValue).toMatchObject({ kapi: "hesaplanamadı" });
  });

  it("kayıt güncellenemese de ad_objects güncellenir", async () => {
    const { store, objectUpdates } = fakeStore([META_AD], { updateLogFails: true });
    const fetchFn = vi.fn(async () => json({ success: true }));
    const res = await executeAdChange(
      deps(store, { env: { ...META_ENV, ADS_WRITE_ENABLED: "true" }, fetchFn: fetchFn as unknown as typeof fetch }),
      pause(),
    );
    expect(res).toMatchObject({ ok: true, status: "uygulandi" });
    expect(objectUpdates).toEqual([{ key: ["meta", "adset", "120000111"], patch: { status: "PAUSED" } }]);
  });
});

describe("canlı bütçe okuma", () => {
  it("Google: campaign_budget sorgusu; yabancı kaynakta istek yok", async () => {
    const fetchFn = vi.fn(async () => json([{ results: [{ campaignBudget: { amountMicros: "120000000" } }] }]));
    expect(
      await googleGetBudgetMicros(GOOGLE_CFG, "erisim", "customers/1234567890/campaignBudgets/77", fetchFn as unknown as typeof fetch),
    ).toBe(120_000_000);
    const none = vi.fn();
    await expect(
      googleGetBudgetMicros(GOOGLE_CFG, "erisim", "customers/1/campaignBudgets/77", none as unknown as typeof fetch),
    ).rejects.toThrow();
    expect(none).not.toHaveBeenCalled();
    const empty = vi.fn(async () => json([{ results: [] }]));
    await expect(
      googleGetBudgetMicros(GOOGLE_CFG, "erisim", "customers/1234567890/campaignBudgets/77", empty as unknown as typeof fetch),
    ).rejects.toThrow();
  });

  it("Meta: daily_budget kuruş; yoksa hata", async () => {
    const fetchFn = vi.fn(async () => json({ id: "1", daily_budget: "15000" }));
    expect(await metaGetDailyBudget(META_CFG, "1", fetchFn as unknown as typeof fetch)).toBe(15_000);
    const init = (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer META-GIZLI-ANAHTAR");
    const missing = vi.fn(async () => json({ id: "1" }));
    await expect(metaGetDailyBudget(META_CFG, "1", missing as unknown as typeof fetch)).rejects.toThrow();
  });
});

describe("executeAdChange · öneriden bütçe artışı (beklenen eski bütçe)", () => {
  const ENABLED_META = { ...META_ENV, ADS_WRITE_ENABLED: "true" };
  const liveMeta = (kurus: string) =>
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") return json({ success: true });
      return json({ id: "120000111", daily_budget: kurus });
    });
  const fromRec = (tl: number, expectedOldTl?: number, reason?: string): AdChangeInput => ({
    ...budget(tl, META_AD, reason),
    source: "oneri",
    recommendationId: "22222222-2222-4222-8222-222222222222",
    expectedOldTl,
  });
  const CHANGED = "Bütçe öneriden sonra değişti; sayfayı yenileyin.";
  const posted = (f: ReturnType<typeof liveMeta>) => f.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === "POST");

  it("canlı bütçe öneriden sonra yükseldiyse (150 → 300) 180'e indirmez: reddedilir, kayıt ve istek yok", async () => {
    const { store, logs } = fakeStore([META_AD]);
    const fetchFn = liveMeta("30000");
    const res = await executeAdChange(deps(store, { env: ENABLED_META, fetchFn: fetchFn as unknown as typeof fetch }), fromRec(180, 150));
    expect(res).toEqual({ error: CHANGED });
    expect(logs).toHaveLength(0);
    expect(posted(fetchFn)).toBe(false);
  });

  it("canlı yazım kapalıyken satırdaki bütçe beklenenden farklıysa reddedilir", async () => {
    const { store, logs } = fakeStore([{ ...META_AD, dailyBudgetMicros: 160_000_000 }]);
    expect(await executeAdChange(deps(store), fromRec(180, 150))).toEqual({ error: CHANGED });
    expect(logs).toHaveLength(0);
  });

  it("beklenen eski bütçe tutuyorsa uygulanır", async () => {
    const { store, logs } = fakeStore([META_AD]);
    const fetchFn = liveMeta("15000");
    const res = await executeAdChange(deps(store, { env: ENABLED_META, fetchFn: fetchFn as unknown as typeof fetch }), fromRec(180, 150));
    expect(res).toMatchObject({ ok: true, status: "uygulandi", message: "✓ Bütçe 150 TL → 180 TL · kayda geçti" });
    expect(logs[0]).toMatchObject({ source: "oneri", oldValue: { daily_budget_tl: 150 }, newValue: { daily_budget_tl: 180 } });
  });

  it("öneriden gelen bütçe değişikliği azaltma olamaz; beklenen eski bütçe yoksa da uygulanmaz", async () => {
    const { store, logs } = fakeStore([META_AD]);
    expect(await executeAdChange(deps(store), fromRec(120, 150))).toEqual({ error: CHANGED });
    expect(await executeAdChange(deps(store), fromRec(180))).toEqual({ error: CHANGED });
    expect(logs).toHaveLength(0);
  });

  it("Kampanyalar ekranından gelen değişiklikte beklenen eski bütçe aranmaz", async () => {
    const { store } = fakeStore([META_AD]);
    expect(await executeAdChange(deps(store), budget(120))).toMatchObject({ ok: true });
  });
});
