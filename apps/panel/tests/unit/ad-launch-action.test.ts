import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AdSetup } from "@/lib/ads/ad-setup";
import { DEFAULT_AD_TEMPLATE, type AdTemplate } from "@/lib/ads/ad-template";
import type { PreflightResult } from "@/lib/ads/preflight";
import type { ContentForAd } from "@/lib/ads/preflight-sources";
import { adName, planAdTest } from "@/lib/ads/setup-plans";
import type { AdChangeLogRow, GateStatus } from "@/lib/ads/writes";

const requireRole = vi.fn();
const revalidatePath = vi.fn();
const createAdmin = vi.fn(() => ({ from: vi.fn() }));
const insertCreatedAdObjects = vi.fn();
const moveContentStage = vi.fn();
const buildAdTestContext = vi.fn();
let gate: GateStatus = { red: false, labels: [] };

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

const setupStore = {
  template: vi.fn(async (): Promise<AdTemplate> => FILLED),
  saveTemplate: vi.fn(async () => undefined),
  setup: vi.fn(async (): Promise<AdSetup | null> => SETUP),
  saveSetup: vi.fn(async () => undefined),
  monthMetaSpendTl: vi.fn(async () => 0),
  objectStatus: vi.fn(async () => null),
  activeStudentNames: vi.fn(async () => []),
  weekLaunches: vi.fn(async () => 0),
  launchInFlight: vi.fn(async () => false),
  campaignSetupInFlight: vi.fn(async () => false),
  testAdForCode: vi.fn(async () => []),
  activeAdsInAdset: vi.fn(async () => 0),
};

const recStore = {
  get: vi.fn(),
  claim: vi.fn(async () => ({ id: REC_ID })),
  release: vi.fn(async () => undefined),
  finish: vi.fn(async () => undefined),
  hold: vi.fn(),
};

vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/lib/auth", () => ({ requireRole: (...a: unknown[]) => requireRole(...a) }));
vi.mock("@seker/auth/admin", () => ({ createAdminSupabase: () => createAdmin() }));
vi.mock("@/lib/ads/ad-settings", async (orig) => {
  const actual = await orig<typeof import("@/lib/ads/ad-settings")>();
  return { ...actual, getAdSettings: async () => ({ ...actual.DEFAULT_AD_SETTINGS }) };
});
vi.mock("@/lib/ads/writes", async (orig) => {
  const actual = await orig<typeof import("@/lib/ads/writes")>();
  return { ...actual, supabaseAdChangeStore: () => changeStore, loadGateStatus: async () => gate };
});
vi.mock("@/lib/ads/setup-store", () => ({ supabaseSetupStore: () => setupStore }));
vi.mock("@/lib/ads/objects-store", () => ({
  insertCreatedAdObjects: (...a: unknown[]) => insertCreatedAdObjects(...a),
}));
vi.mock("@/lib/ads/ad-test-context", () => ({
  buildAdTestContext: (...a: unknown[]) => buildAdTestContext(...a),
}));
vi.mock("@/lib/ads/recommendations", () => ({ supabaseRecommendationStore: () => recStore }));
vi.mock("@/actions/content", () => ({ moveContentStage: (...a: unknown[]) => moveContentStage(...a) }));

import { launchAdTest } from "@/actions/ad-setup";

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const REC_ID = "6a1f2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const CODE = "R-2643-A";
const NAME = adName(CODE, "Bahçede ilk gün");

const META_ENV = {
  META_ACCESS_TOKEN: "EAAtokentoken",
  META_APP_SECRET: "appsecret123",
  META_AD_ACCOUNT_ID: "act_42",
  META_PIXEL_ID: "777",
  META_INSTAGRAM_USER_ID: "17841400000000000",
  META_FACEBOOK_PAGE_ID: "1234567",
};

const GREEN: PreflightResult = { ok: true, items: [{ key: "onay", ok: true, label: "Onaylı", fix: null }] };
const RED: PreflightResult = {
  ok: false,
  items: [{ key: "yayin", ok: false, label: "72 saatten önce teste alınamaz · kalan 20 saat", fix: "Bekle" }],
};

const CONTENT: ContentForAd = {
  id: ID,
  code: CODE,
  topic: "Bahçede ilk gün",
  kind: "reels",
  platform: "instagram",
  stage: "organik",
  status: "onaylandi",
  approverFaceCheck: true,
  caption: "Bahçede ilk gün",
  igMediaId: "1790000000001",
  igPermalink: "https://www.instagram.com/reel/abc/",
  igPublishedAt: "2026-10-10T09:00:00Z",
  igPublishStatus: "yayinda",
  mediaMeta: { vertical: true, durationS: 30, subtitled: true },
};

function context(o: {
  checklist?: PreflightResult;
  planned?: boolean;
  activate?: boolean;
  content?: Partial<ContentForAd>;
  needs72h?: boolean;
} = {}) {
  const checklist = o.checklist ?? GREEN;
  const content = { ...CONTENT, ...o.content };
  const planned =
    o.planned === false
      ? null
      : planAdTest({
          adAccountId: "act_42",
          setup: SETUP,
          code: CODE,
          name: NAME,
          link: `https://yeni.sekeranaokulu.com/lp/az-mevcutlu-anaokulu?utm_source=instagram&utm_medium=paid_social&utm_content=${CODE}`,
          urlTags: "utm_campaign={{campaign.id}}",
          source: { kind: "reels", igMediaId: content.igMediaId ?? "1" },
          pageId: "1234567",
          igUserId: "17841400000000000",
          activateCampaign: o.activate ?? false,
          activateAdset: o.activate ?? false,
        });
  return {
    view: {
      contentId: ID,
      code: CODE,
      kind: content.kind,
      topic: content.topic,
      checklist,
      blockText: checklist.ok ? null : "Kurulamaz: 72 saatten önce teste alınamaz · kalan 20 saat",
      needs72hOverride: o.needs72h ?? false,
      hoursLeft: o.needs72h ? 20 : null,
      gateRed: [],
      writeEnabled: true,
      existing: null,
    },
    planned,
    content,
    setup: SETUP,
  };
}

const fetchSpy = vi.fn();
function okJson(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}
/** Meta: kreatif 9001, reklam 9002, durum değişiklikleri success. */
function metaOk() {
  fetchSpy.mockImplementation(async (url: string) => {
    if (String(url).endsWith("/adcreatives")) return okJson({ id: "9001" });
    if (String(url).endsWith("/ads")) return okJson({ id: "9002" });
    return okJson({ success: true });
  });
}
const postPaths = () => fetchSpy.mock.calls.map((c) => String(c[0]).replace(/^https:\/\/graph\.facebook\.com\/v[\d.]+\//, ""));

beforeEach(() => {
  vi.clearAllMocks();
  logs.length = 0;
  gate = { red: false, labels: [] };
  vi.useFakeTimers();
  // Perşembe 22 Ekim 2026, 12:00 İstanbul.
  vi.setSystemTime(new Date("2026-10-22T09:00:00Z"));
  vi.stubGlobal("fetch", fetchSpy);
  vi.stubEnv("ADS_WRITE_ENABLED", "true");
  for (const [k, v] of Object.entries(META_ENV)) vi.stubEnv(k, v);
  requireRole.mockResolvedValue({ id: "yon-1", role: "yonetici", full_name: "Zehra Gürsel" });
  setupStore.template.mockResolvedValue(FILLED);
  setupStore.weekLaunches.mockResolvedValue(0);
  setupStore.launchInFlight.mockResolvedValue(false);
  buildAdTestContext.mockResolvedValue(context());
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

describe("launchAdTest", () => {
  it("danışman çağıramaz (gizli istemci açılmaz, kayıt yok)", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(launchAdTest(ID, { mode: "kur" })).rejects.toThrow("NEXT_REDIRECT");
    expect(requireRole).toHaveBeenCalledWith("yonetici");
    expect(createAdmin).not.toHaveBeenCalled();
    expect(changeStore.insertLog).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("geçersiz içerik kimliği ve kip reddedilir", async () => {
    expect(await launchAdTest("bozuk", { mode: "kur" })).toEqual({ error: "Geçersiz içerik." });
    expect(await launchAdTest(ID, { mode: "x" as never })).toEqual({ error: "Geçersiz kip." });
    expect(await launchAdTest(ID, { mode: "kur", recommendationId: "x" })).toEqual({ error: "Geçersiz öneri." });
    expect(buildAdTestContext).not.toHaveBeenCalled();
  });

  it("bayrak kapalı + kur: POST yok, kayıt uygulanmadi_kapali, moveContentStage ve insertCreatedAdObjects çağrılmaz", async () => {
    vi.stubEnv("ADS_WRITE_ENABLED", "");
    const res = await launchAdTest(ID, { mode: "kur" });
    expect(res).toMatchObject({ ok: true, status: "uygulanmadi_kapali", message: "Kaydedildi · uygulanmadı: canlı yazım kapalı" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ action: "reklam_kur", status: "uygulanmadi_kapali", level: "ad", objectId: ID, source: "icerik" });
    expect(moveContentStage).not.toHaveBeenCalled();
    expect(insertCreatedAdObjects).not.toHaveBeenCalled();
    expect(recStore.claim).not.toHaveBeenCalled();
  });

  it("bayrak açık + goster: POST yok, aşama değişmez, haftalık sayıya ve 'zaten kuruldu'ya bakılmaz (RF3)", async () => {
    setupStore.weekLaunches.mockResolvedValue(99);
    setupStore.launchInFlight.mockResolvedValue(true);
    buildAdTestContext.mockResolvedValue(context({ checklist: RED }));
    const res = await launchAdTest(ID, { mode: "goster" });
    expect(res).toMatchObject({ ok: true, status: "uygulanmadi_kapali", message: "Kaydedildi · uygulanmadı: sadece göster" });
    expect("summary" in res && res.summary.length).toBeGreaterThan(0);
    expect(res).toHaveProperty("checklist", RED);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setupStore.weekLaunches).not.toHaveBeenCalled();
    expect(setupStore.launchInFlight).not.toHaveBeenCalled();
    expect(moveContentStage).not.toHaveBeenCalled();
    expect(insertCreatedAdObjects).not.toHaveBeenCalled();
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe("uygulanmadi_kapali");
    // Kayıt checklist ve içerik kodunu taşır (change-log latestByKey içerik koduyla eşler).
    expect(logs[0].newValue).toMatchObject({ mode: "goster", contentCode: CODE, checklist: RED });
  });

  it("goster + plan yok: kayıt yazılmaz, neden ve checklist döner", async () => {
    buildAdTestContext.mockResolvedValue(context({ checklist: RED, planned: false }));
    const res = await launchAdTest(ID, { mode: "goster" });
    expect(res).toEqual({
      error: "Panel şunu kuracaktı: plan oluşturulamadı (Kurulamaz: 72 saatten önce teste alınamaz · kalan 20 saat)",
      checklist: RED,
    });
    expect(changeStore.insertLog).not.toHaveBeenCalled();
  });

  it("bayrak açık + kur, hepsi yeşil: POST sırası /adcreatives, /ads, /<ad>; kampanya/set'e POST yok; aşama organik→test; ad_objects + bağ", async () => {
    const res = await launchAdTest(ID, { mode: "kur" });
    expect(res).toMatchObject({ ok: true, status: "uygulandi", message: "Testte · reklam 9002" });
    expect(postPaths()).toEqual(["act_42/adcreatives", "act_42/ads", "9002"]);
    expect(fetchSpy.mock.calls.every((c) => (c[1] as RequestInit).method === "POST")).toBe(true);
    expect(postPaths().some((p) => p.endsWith("/campaigns") || p.endsWith("/adsets"))).toBe(false);
    // Haftalık sınır İstanbul Pazartesi 00:00'dan (19 Ekim 2026 00:00 +03 = 18 Ekim 21:00Z).
    expect(setupStore.weekLaunches).toHaveBeenCalledWith("2026-10-18T21:00:00.000Z");
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      action: "reklam_kur",
      level: "ad",
      objectId: ID,
      objectName: NAME,
      status: "uygulandi",
      source: "icerik",
      actorId: "yon-1",
    });
    expect(logs[0].newValue).toMatchObject({ contentCode: CODE, checklist: GREEN, ids: { creative: "9001", ad: "9002" } });
    expect(JSON.stringify(logs)).not.toContain("EAAtokentoken");
    expect(moveContentStage).toHaveBeenCalledWith(ID, "test");
    expect(insertCreatedAdObjects).toHaveBeenCalledTimes(1);
    const [, rows, actor] = insertCreatedAdObjects.mock.calls[0];
    expect(actor).toBe("yon-1");
    expect(rows).toEqual([
      expect.objectContaining({
        platform: "meta",
        level: "ad",
        objectId: "9002",
        parentId: "5002",
        campaignId: "5001",
        name: NAME,
        status: "ACTIVE",
        contentCode: CODE,
      }),
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/reklam/icerik");
    expect(revalidatePath).toHaveBeenCalledWith("/reklam/kampanyalar");
    expect(revalidatePath).toHaveBeenCalledWith("/reklam/hafta");
  });

  it("kampanya ve set açıldıysa onların satırları da ACTIVE yazılır", async () => {
    buildAdTestContext.mockResolvedValue(context({ activate: true }));
    const res = await launchAdTest(ID, { mode: "kur" });
    expect(res).toMatchObject({ ok: true, status: "uygulandi" });
    expect(postPaths()).toEqual(["act_42/adcreatives", "act_42/ads", "5001", "5002", "9002"]);
    const rows = insertCreatedAdObjects.mock.calls[0][1] as { level: string; objectId: string; status: string; contentCode: string | null }[];
    expect(rows.map((r) => [r.level, r.objectId, r.status])).toEqual([
      ["ad", "9002", "ACTIVE"],
      ["campaign", "5001", "ACTIVE"],
      ["adset", "5002", "ACTIVE"],
    ]);
    expect(rows.filter((r) => r.level !== "ad").every((r) => r.contentCode === null)).toBe(true);
  });

  it("sayfa ya da zaten test aşamasındaki Reels için aşama değişmez", async () => {
    buildAdTestContext.mockResolvedValue(context({ content: { stage: "test" } }));
    await launchAdTest(ID, { mode: "kur" });
    expect(moveContentStage).not.toHaveBeenCalled();
    buildAdTestContext.mockResolvedValue(context({ content: { kind: "sayfa", stage: "organik" } }));
    await launchAdTest(ID, { mode: "kur" });
    expect(moveContentStage).not.toHaveBeenCalled();
  });

  it("aşama değiştirilemezse reklam yine uygulandı döner, mesaja eklenir", async () => {
    moveContentStage.mockResolvedValue({ error: "Bu aşama geçişi yapılamaz" });
    const res = await launchAdTest(ID, { mode: "kur" });
    expect(res).toMatchObject({ ok: true, status: "uygulandi" });
    expect("message" in res && res.message).toBe("Testte · reklam 9002 · aşama değiştirilemedi: Bu aşama geçişi yapılamaz");
  });

  it("aynı içerik ikinci kez kurulamaz (RF1)", async () => {
    setupStore.launchInFlight.mockResolvedValue(true);
    const res = await launchAdTest(ID, { mode: "kur" });
    expect(res).toEqual({ error: "Bu içerik için reklam zaten kuruldu ya da kuruluyor." });
    expect(setupStore.launchInFlight).toHaveBeenCalledWith(ID, "2026-10-22T08:50:00.000Z");
    expect(changeStore.insertLog).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("aynı anda iki 'Reklamı kur': ikincisi reklam açmaz (RF1, aynı süreç)", async () => {
    // İlki Meta yanıtını beklerken ikincisi gelir; ilk istek kaydı yazana kadar launchInFlight false döner.
    let release!: () => void;
    const hold = new Promise<void>((r) => (release = r));
    fetchSpy.mockImplementationOnce(async () => {
      await hold;
      return okJson({ id: "9001" });
    });
    const first = launchAdTest(ID, { mode: "kur" });
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const second = await launchAdTest(ID, { mode: "kur" });
    expect(second).toEqual({ error: "Bu içerik için reklam zaten kuruldu ya da kuruluyor." });
    release();
    expect(await first).toMatchObject({ ok: true, status: "uygulandi" });
    expect(postPaths().filter((p) => p.endsWith("/ads"))).toHaveLength(1);
    // Kilit bırakılır: aynı süreçte sonraki istek yine launchInFlight'a sorar.
    setupStore.launchInFlight.mockResolvedValue(true);
    expect(await launchAdTest(ID, { mode: "kur" })).toEqual({ error: "Bu içerik için reklam zaten kuruldu ya da kuruluyor." });
  });

  it("haftalık sınıra ulaşıldıysa (şablondaki sayı) yeni reklam reddedilir", async () => {
    setupStore.weekLaunches.mockResolvedValue(4);
    const res = await launchAdTest(ID, { mode: "kur" });
    expect(res).toEqual({ error: "Bu hafta 4 reklam kuruldu; hesap güvenliği için yenisi gelecek Pazartesi." });
    expect(changeStore.insertLog).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    setupStore.template.mockResolvedValue({ ...FILLED, haftalikYeniReklam: 6 });
    setupStore.weekLaunches.mockResolvedValue(5);
    expect(await launchAdTest(ID, { mode: "kur" })).toMatchObject({ ok: true, status: "uygulandi" });
    setupStore.weekLaunches.mockResolvedValue(6);
    expect(await launchAdTest(ID, { mode: "kur" })).toEqual({
      error: "Bu hafta 6 reklam kuruldu; hesap güvenliği için yenisi gelecek Pazartesi.",
    });
  });

  it("skip72h + gerekçesiz → needsReason, kayıt yok (RF4)", async () => {
    buildAdTestContext.mockResolvedValue(context({ checklist: RED, needs72h: true }));
    const res = await launchAdTest(ID, { mode: "kur", skip72h: true, reason: "kısa" });
    expect(res).toMatchObject({ needsReason: true });
    expect("error" in res && res.error).toContain("en az 10 karakter");
    expect(changeStore.insertLog).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("skip72h + gerekçe: gerekçe bağlama ve kayda gider, kaynak icerik", async () => {
    const reason = "Kayıt dönemi bitiyor, bekleyemeyiz";
    const res = await launchAdTest(ID, { mode: "kur", skip72h: true, reason });
    expect(res).toMatchObject({ ok: true, status: "uygulandi" });
    expect(buildAdTestContext.mock.calls[0][2]).toEqual({ skip72hReason: reason });
    expect(logs[0]).toMatchObject({ reason, source: "icerik", gateRed: false });
  });

  it("skip72h yokken gerekçe 72 saat bağlamına gitmez", async () => {
    await launchAdTest(ID, { mode: "kur", reason: "Kapı kırmızı ama deneyelim" });
    expect(buildAdTestContext.mock.calls[0][2]).toEqual({ skip72hReason: null });
  });

  it("kırmızı kapı + gerekçesiz → needsReason, kayıt yok (RF4)", async () => {
    gate = { red: true, labels: ["Maliyet"] };
    const res = await launchAdTest(ID, { mode: "kur" });
    expect(res).toMatchObject({ needsReason: true });
    expect(changeStore.insertLog).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    const ok = await launchAdTest(ID, { mode: "kur", reason: "Yeni dönem kayıtları için gerekli" });
    expect(ok).toMatchObject({ ok: true, status: "uygulandi" });
    expect(logs[0]).toMatchObject({ gateRed: true, reason: "Yeni dönem kayıtları için gerekli" });
  });

  it("kontrol kırmızıyken kur reddedilir ve checklist döner", async () => {
    buildAdTestContext.mockResolvedValue(context({ checklist: RED }));
    const res = await launchAdTest(ID, { mode: "kur" });
    expect(res).toEqual({ error: "Kurulamaz: 72 saatten önce teste alınamaz · kalan 20 saat", checklist: RED });
    expect(changeStore.insertLog).not.toHaveBeenCalled();
    expect(setupStore.launchInFlight).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("kontrol yeşil ama plan yoksa kur reddedilir", async () => {
    buildAdTestContext.mockResolvedValue(context({ planned: false }));
    const res = await launchAdTest(ID, { mode: "kur" });
    expect(res).toMatchObject({ error: expect.stringContaining("plan oluşturulamadı") });
    expect(changeStore.insertLog).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("bağlam hatası aynen döner", async () => {
    buildAdTestContext.mockResolvedValue({ error: "İçerik bulunamadı." });
    expect(await launchAdTest(ID, { mode: "kur" })).toEqual({ error: "İçerik bulunamadı." });
  });

  it("reklam adımı patlarsa: kayıt hata + kreatif kimliği, aşama ve ad_objects değişmez, anahtar sızmaz (RF2)", async () => {
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).endsWith("/adcreatives")) return okJson({ id: "9001" });
      return new Response(JSON.stringify({ error: { message: "Invalid parameter access_token=EAAtokentoken", code: 100 } }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    });
    const res = await launchAdTest(ID, { mode: "kur" });
    expect(res).toHaveProperty("error");
    expect("error" in res && res.error).toContain("9001");
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe("hata");
    expect(logs[0].newValue).toMatchObject({ ids: { creative: "9001" }, failedKey: "ad" });
    expect(JSON.stringify(logs)).not.toContain("EAAtokentoken");
    expect(JSON.stringify(res)).not.toContain("EAAtokentoken");
    expect(moveContentStage).not.toHaveBeenCalled();
    expect(insertCreatedAdObjects).not.toHaveBeenCalled();
    expect(recStore.claim).not.toHaveBeenCalled();
  });

  it("ad_objects yazılamazsa reklam yine uygulandı döner", async () => {
    insertCreatedAdObjects.mockRejectedValue(new Error("db"));
    const res = await launchAdTest(ID, { mode: "kur" });
    expect(res).toMatchObject({ ok: true, status: "uygulandi" });
    expect(moveContentStage).toHaveBeenCalledWith(ID, "test");
  });

  it("öneriden gelince öneri onaylandı ve sonuç yazıldı; source oneri", async () => {
    const res = await launchAdTest(ID, { mode: "kur", recommendationId: REC_ID });
    expect(res).toMatchObject({ ok: true, status: "uygulandi" });
    expect(logs[0]).toMatchObject({ source: "oneri", recommendationId: REC_ID });
    expect(recStore.claim).toHaveBeenCalledWith(REC_ID, "yon-1");
    expect(recStore.finish).toHaveBeenCalledWith(REC_ID, "Testte · reklam 9002");
    expect(recStore.claim.mock.invocationCallOrder[0]).toBeLessThan(recStore.finish.mock.invocationCallOrder[0]);
  });

  it("öneri başkası tarafından karara bağlandıysa sonuç üzerine yazılmaz", async () => {
    recStore.claim.mockResolvedValue(null as never);
    const res = await launchAdTest(ID, { mode: "kur", recommendationId: REC_ID });
    expect(res).toMatchObject({ ok: true, status: "uygulandi" });
    expect(recStore.finish).not.toHaveBeenCalled();
  });
});

describe("istanbulWeekStartIso", () => {
  it("İstanbul Pazartesi 00:00'ı UTC ISO olarak döner (Pazar gecesi ve Pazartesi sabahı sınırları)", async () => {
    const { istanbulWeekStartIso } = await vi.importActual<typeof import("@/lib/ads/weekly")>("@/lib/ads/weekly");
    expect(istanbulWeekStartIso(new Date("2026-10-22T09:00:00Z"))).toBe("2026-10-18T21:00:00.000Z");
    // Pazar 25 Ekim 23:59 İstanbul → hâlâ 19 Ekim haftası.
    expect(istanbulWeekStartIso(new Date("2026-10-25T20:59:00Z"))).toBe("2026-10-18T21:00:00.000Z");
    // Pazartesi 26 Ekim 00:00 İstanbul (25 Ekim 21:00Z) → yeni hafta.
    expect(istanbulWeekStartIso(new Date("2026-10-25T21:00:00Z"))).toBe("2026-10-25T21:00:00.000Z");
  });
});
