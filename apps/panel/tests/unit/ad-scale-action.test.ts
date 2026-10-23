import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AdSetup } from "@/lib/ads/ad-setup";
import { DEFAULT_AD_TEMPLATE, type AdTemplate } from "@/lib/ads/ad-template";
import type { ContentForAd } from "@/lib/ads/preflight-sources";
import type { TestAdRow } from "@/lib/ads/setup-store";
import type { AdChangeLogRow, GateStatus } from "@/lib/ads/writes";

const requireRole = vi.fn();
const revalidatePath = vi.fn();
const createAdmin = vi.fn(() => ({ from: vi.fn() }));
const insertCreatedAdObjects = vi.fn();
const moveContentStage = vi.fn();
const loadContentForAd = vi.fn();
let gate: GateStatus = { red: false, labels: [] };
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

const SETUP: AdSetup = {
  testCampaignId: "5001",
  testAdsetId: "5002",
  scaleCampaignId: "5003",
  scaleAdsetId: "5004",
  exclusionAudienceId: null,
  createdAt: "2026-10-01T00:00:00Z",
  createdBy: "yon-1",
};

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const REC_ID = "6a1f2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const CODE = "R-2643-A";
const TEST_AD: TestAdRow = {
  adId: "9002",
  name: `${CODE} · Bahçede ilk gün`,
  status: "ACTIVE",
  effectiveStatus: "ACTIVE",
  reviewFeedback: null,
};

const setupStore = {
  template: vi.fn(async (): Promise<AdTemplate> => FILLED),
  saveTemplate: vi.fn(async () => undefined),
  setup: vi.fn(async (): Promise<AdSetup | null> => SETUP),
  saveSetup: vi.fn(async () => undefined),
  monthMetaSpendTl: vi.fn(async () => 0),
  objectStatus: vi.fn(async (): Promise<string | null> => null),
  activeStudentNames: vi.fn(async () => []),
  weekLaunches: vi.fn(async () => 0),
  launchInFlight: vi.fn(async () => false),
  campaignSetupInFlight: vi.fn(async () => false),
  scaleInFlight: vi.fn(async () => false),
  testAdForCode: vi.fn(async (): Promise<TestAdRow[]> => [TEST_AD]),
  activeAdsInAdset: vi.fn(async () => 0),
};

const recStore = {
  get: vi.fn(),
  claim: vi.fn(async (): Promise<{ id: string } | null> => ({ id: REC_ID })),
  release: vi.fn(async () => undefined),
  finish: vi.fn(async () => undefined),
  hold: vi.fn(),
};

vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/lib/auth", () => ({ requireRole: (...a: unknown[]) => requireRole(...a) }));
vi.mock("@seker/auth/admin", () => ({ createAdminSupabase: () => createAdmin() }));
vi.mock("@/lib/ads/ad-settings", async (orig) => {
  const actual = await orig<typeof import("@/lib/ads/ad-settings")>();
  return { ...actual, getAdSettings: async () => ({ ...actual.DEFAULT_AD_SETTINGS, monthlyBudget: { googleTl: 0, metaTl } }) };
});
vi.mock("@/lib/ads/writes", async (orig) => {
  const actual = await orig<typeof import("@/lib/ads/writes")>();
  return { ...actual, supabaseAdChangeStore: () => changeStore, loadGateStatus: async () => gate };
});
vi.mock("@/lib/ads/setup-store", () => ({ supabaseSetupStore: () => setupStore }));
vi.mock("@/lib/ads/objects-store", () => ({
  insertCreatedAdObjects: (...a: unknown[]) => insertCreatedAdObjects(...a),
}));
vi.mock("@/lib/ads/preflight-sources", async (orig) => {
  const actual = await orig<typeof import("@/lib/ads/preflight-sources")>();
  return { ...actual, loadContentForAd: (...a: unknown[]) => loadContentForAd(...a) };
});
vi.mock("@/lib/ads/recommendations", () => ({ supabaseRecommendationStore: () => recStore }));
vi.mock("@/actions/content", () => ({ moveContentStage: (...a: unknown[]) => moveContentStage(...a) }));

import { moveToScale } from "@/actions/ad-setup";

const META_ENV = {
  META_ACCESS_TOKEN: "EAAtokentoken",
  META_APP_SECRET: "appsecret123",
  META_AD_ACCOUNT_ID: "act_42",
  META_PIXEL_ID: "777",
  META_INSTAGRAM_USER_ID: "17841400000000000",
  META_FACEBOOK_PAGE_ID: "1234567",
};

const CONTENT: ContentForAd = {
  id: ID,
  code: CODE,
  topic: "Bahçede ilk gün",
  kind: "reels",
  platform: "instagram",
  stage: "test",
  status: "onaylandi",
  approverFaceCheck: true,
  caption: "Bahçede ilk gün",
  igMediaId: "1790000000001",
  igPermalink: "https://www.instagram.com/reel/abc/",
  igPublishedAt: "2026-10-10T09:00:00Z",
  igPublishStatus: "yayinda",
  mediaMeta: { vertical: true, durationS: 30, subtitled: true },
};

const MSG_ALREADY = "Bu içerik Büyütme'ye zaten taşındı ya da taşınıyor.";

const fetchSpy = vi.fn();
function okJson(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}
/** Meta: kopya 9100, durum değişiklikleri success. */
function metaOk() {
  fetchSpy.mockImplementation(async (url: string) => {
    if (String(url).endsWith("/copies")) return okJson({ copied_ad_id: "9100" });
    return okJson({ success: true });
  });
}
const postPaths = () => fetchSpy.mock.calls.map((c) => String(c[0]).replace(/^https:\/\/graph\.facebook\.com\/v[\d.]+\//, ""));
const bodyOf = (i: number) => new URLSearchParams(String((fetchSpy.mock.calls[i][1] as RequestInit).body));

beforeEach(() => {
  vi.clearAllMocks();
  logs.length = 0;
  gate = { red: false, labels: [] };
  metaTl = 20_000;
  vi.useFakeTimers();
  // Perşembe 22 Ekim 2026, 12:00 İstanbul.
  vi.setSystemTime(new Date("2026-10-22T09:00:00Z"));
  vi.stubGlobal("fetch", fetchSpy);
  vi.stubEnv("ADS_WRITE_ENABLED", "true");
  for (const [k, v] of Object.entries(META_ENV)) vi.stubEnv(k, v);
  requireRole.mockResolvedValue({ id: "yon-1", role: "yonetici", full_name: "Zehra Gürsel" });
  loadContentForAd.mockResolvedValue(CONTENT);
  setupStore.setup.mockResolvedValue(SETUP);
  setupStore.template.mockResolvedValue(FILLED);
  setupStore.testAdForCode.mockResolvedValue([TEST_AD]);
  setupStore.objectStatus.mockResolvedValue("ACTIVE");
  setupStore.monthMetaSpendTl.mockResolvedValue(0);
  setupStore.scaleInFlight.mockResolvedValue(false);
  moveContentStage.mockResolvedValue({ ok: true });
  recStore.claim.mockResolvedValue({ id: REC_ID });
  insertCreatedAdObjects.mockResolvedValue(undefined);
  metaOk();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("moveToScale", () => {
  it("danışman çağıramaz (gizli istemci açılmaz, kayıt yok)", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(moveToScale(ID, { mode: "kur" })).rejects.toThrow("NEXT_REDIRECT");
    expect(requireRole).toHaveBeenCalledWith("yonetici");
    expect(createAdmin).not.toHaveBeenCalled();
    expect(changeStore.insertLog).not.toHaveBeenCalled();
  });

  it("geçersiz girdiler reddedilir", async () => {
    expect(await moveToScale("bozuk", { mode: "kur" })).toEqual({ error: "Geçersiz içerik." });
    expect(await moveToScale(ID, { mode: "x" as never })).toEqual({ error: "Geçersiz kip." });
    expect(await moveToScale(ID, { mode: "kur", recommendationId: "x" })).toEqual({ error: "Geçersiz öneri." });
    expect(await moveToScale(ID, { mode: "kur", source: "cron" as never })).toEqual({ error: "Geçersiz kaynak." });
    expect(loadContentForAd).not.toHaveBeenCalled();
  });

  it("kurulum yoksa Ayarlar'a yönlendirir", async () => {
    setupStore.setup.mockResolvedValue(null);
    expect(await moveToScale(ID, { mode: "kur" })).toEqual({
      error: "Önce Ayarlar'da Test ve Büyütme kampanyalarını kurun.",
    });
    expect(logs).toHaveLength(0);
  });

  it("Test'te reklam yoksa ya da birden fazlaysa taşınmaz", async () => {
    setupStore.testAdForCode.mockResolvedValue([]);
    expect(await moveToScale(ID, { mode: "kur" })).toEqual({ error: "Bu içeriğin Test'te reklamı yok." });
    setupStore.testAdForCode.mockResolvedValue([TEST_AD, { ...TEST_AD, adId: "9003" }]);
    expect(await moveToScale(ID, { mode: "kur" })).toEqual({
      error: "Bu koda bağlı birden fazla Test reklamı var; Kampanyalar'dan seçin.",
    });
    expect(setupStore.testAdForCode).toHaveBeenCalledWith(CODE, SETUP.testAdsetId);
    expect(logs).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("kur: kopya Büyütme setine, sonra kopya ACTIVE, sonra Test PAUSED; nesneler, aşama, mesaj", async () => {
    const res = await moveToScale(ID, { mode: "kur" });
    expect(res).toMatchObject({ ok: true, status: "uygulandi", message: `✓ ${CODE} Büyütme'ye taşındı · Test'teki reklam durdu` });

    expect(postPaths()).toEqual(["9002/copies", "9100", "9002"]);
    expect(bodyOf(0).get("adset_id")).toBe(SETUP.scaleAdsetId);
    expect(bodyOf(1).get("status")).toBe("ACTIVE");
    expect(bodyOf(2).get("status")).toBe("PAUSED");

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      action: "buyutmeye_tasi",
      level: "ad",
      objectId: "9002",
      source: "kampanyalar",
      status: "uygulandi",
      gateRed: false,
    });
    expect(logs[0].newValue).toMatchObject({ contentCode: CODE, ids: { copy: "9100" } });
    expect(JSON.stringify(logs)).not.toContain("EAAtokentoken");

    expect(insertCreatedAdObjects).toHaveBeenCalledTimes(1);
    const [, rows, actor] = insertCreatedAdObjects.mock.calls[0] as [unknown, Record<string, unknown>[], string];
    expect(actor).toBe("yon-1");
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: "ad", objectId: "9100", parentId: SETUP.scaleAdsetId, contentCode: CODE, status: "ACTIVE" }),
        expect.objectContaining({ level: "ad", objectId: "9002", parentId: SETUP.testAdsetId, contentCode: CODE, status: "PAUSED" }),
      ]),
    );
    expect(moveContentStage).toHaveBeenCalledWith(ID, "kazanan");
  });

  it("Büyütme kampanyası/seti duraklatılmışsa önce açılır", async () => {
    setupStore.objectStatus.mockResolvedValue("PAUSED");
    const res = await moveToScale(ID, { mode: "kur" });
    expect(res).toMatchObject({ ok: true, status: "uygulandi" });
    expect(postPaths()).toEqual(["9002/copies", SETUP.scaleCampaignId, SETUP.scaleAdsetId, "9100", "9002"]);
    const [, rows] = insertCreatedAdObjects.mock.calls[0] as [unknown, Record<string, unknown>[]];
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: "campaign", objectId: SETUP.scaleCampaignId, status: "ACTIVE" }),
        expect.objectContaining({ level: "adset", objectId: SETUP.scaleAdsetId, status: "ACTIVE" }),
      ]),
    );
  });

  it("bayrak kapalı + kur: POST yok, kayıt uygulanmadi_kapali, aşama ve ad_objects değişmez", async () => {
    vi.stubEnv("ADS_WRITE_ENABLED", "");
    const res = await moveToScale(ID, { mode: "kur" });
    expect(res).toMatchObject({ ok: true, status: "uygulanmadi_kapali", message: "Kaydedildi · uygulanmadı: canlı yazım kapalı" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ action: "buyutmeye_tasi", status: "uygulanmadi_kapali", objectId: "9002" });
    expect(moveContentStage).not.toHaveBeenCalled();
    expect(insertCreatedAdObjects).not.toHaveBeenCalled();
  });

  it("sadece göster: bayrak açıkken de POST yok, özet döner, aşama değişmez; tavana bakmaz", async () => {
    metaTl = 0;
    const res = await moveToScale(ID, { mode: "goster" });
    expect(res).toMatchObject({ ok: true, status: "uygulanmadi_kapali", message: "Kaydedildi · uygulanmadı: sadece göster" });
    expect("summary" in res && res.summary).toContain("Test'teki reklam durur");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(moveContentStage).not.toHaveBeenCalled();
    expect(insertCreatedAdObjects).not.toHaveBeenCalled();
  });

  it("kırmızı kapıda gerekçesiz: needsReason, kayıt yok; gerekçeyle uygulanır ve gate_red kayda geçer", async () => {
    gate = { red: true, labels: ["Randevu verilen"] };
    const res = await moveToScale(ID, { mode: "kur" });
    expect(res).toMatchObject({ needsReason: true });
    expect(logs).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();

    const ok = await moveToScale(ID, { mode: "kur", reason: "Kazanan belli, beklemeyelim" });
    expect(ok).toMatchObject({ ok: true, status: "uygulandi" });
    expect(logs[0]).toMatchObject({ gateRed: true, reason: "Kazanan belli, beklemeyelim" });
  });

  it("aylık tavan aşılıyorsa (B8) kayıt yazılmadan reddedilir", async () => {
    metaTl = 0;
    expect(await moveToScale(ID, { mode: "kur" })).toEqual({ error: "Aylık Meta bütçesi Ayarlar'da 0" });
    metaTl = 5_000;
    setupStore.monthMetaSpendTl.mockResolvedValue(1_000);
    const res = await moveToScale(ID, { mode: "kur" });
    expect(res).toMatchObject({ error: expect.stringContaining("Aylık Meta bütçesi yetmiyor") });
    expect(logs).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("daha önce taşınmışsa ya da taşınıyorsa ikinci kez taşınmaz", async () => {
    setupStore.scaleInFlight.mockResolvedValue(true);
    expect(await moveToScale(ID, { mode: "kur" })).toEqual({ error: MSG_ALREADY });
    expect(setupStore.scaleInFlight).toHaveBeenCalledWith("9002", CODE, SETUP.scaleAdsetId, expect.any(String));
    expect(logs).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("çift tıklama: aynı süreçte eşzamanlı ikinci istek kopya açmaz", async () => {
    const results = await Promise.all([moveToScale(ID, { mode: "kur" }), moveToScale(ID, { mode: "kur" })]);
    expect(results.filter((r) => "ok" in r)).toHaveLength(1);
    expect(results.filter((r) => "error" in r && r.error === MSG_ALREADY)).toHaveLength(1);
    expect(fetchSpy.mock.calls.filter((c) => String(c[0]).endsWith("/copies"))).toHaveLength(1);
  });

  it("kopya kuruldu, açma patladı: kayıt hata + kimlik, aşama ve ad_objects değişmez, anahtar sızmaz", async () => {
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).endsWith("/copies")) return okJson({ copied_ad_id: "9100" });
      return new Response(JSON.stringify({ error: { message: "bozuk EAAtokentoken" } }), { status: 400 });
    });
    const res = await moveToScale(ID, { mode: "kur" });
    expect(res).toMatchObject({ error: expect.stringContaining("9100") });
    expect(logs[0]).toMatchObject({ status: "hata" });
    expect(JSON.stringify(logs)).not.toContain("EAAtokentoken");
    expect(JSON.stringify(res)).not.toContain("EAAtokentoken");
    expect(moveContentStage).not.toHaveBeenCalled();
    expect(insertCreatedAdObjects).not.toHaveBeenCalled();
  });

  it("öneriden: kaynak oneri ve öneri kimliği kayda geçer", async () => {
    vi.stubEnv("ADS_WRITE_ENABLED", "");
    await moveToScale(ID, { mode: "kur", source: "oneri", recommendationId: REC_ID });
    expect(logs[0]).toMatchObject({ source: "oneri", recommendationId: REC_ID });
  });

  it("aşama değiştirilemezse taşınma başarılı kalır, mesaj bunu söyler", async () => {
    moveContentStage.mockResolvedValue({ error: "Bu aşama geçişi yapılamaz" });
    const res = await moveToScale(ID, { mode: "kur" });
    expect(res).toMatchObject({ ok: true, status: "uygulandi" });
    expect("message" in res && res.message).toContain("aşama değiştirilemedi: Bu aşama geçişi yapılamaz");
  });
});
