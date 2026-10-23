import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AdSetup } from "@/lib/ads/ad-setup";
import { DEFAULT_AD_TEMPLATE, type AdTemplate } from "@/lib/ads/ad-template";
import type { ContentForAd, LandingForAd } from "@/lib/ads/preflight-sources";

const loadContentForAd = vi.fn();
const loadLandingForAd = vi.fn();
const loadWeekInstagramPageSlug = vi.fn();
const loadGateStatus = vi.fn();
let metaTl = 20_000;

vi.mock("@/lib/ads/preflight-sources", async (orig) => {
  const actual = await orig<typeof import("@/lib/ads/preflight-sources")>();
  return {
    ...actual,
    loadContentForAd: (...a: unknown[]) => loadContentForAd(...a),
    loadLandingForAd: (...a: unknown[]) => loadLandingForAd(...a),
    loadWeekInstagramPageSlug: (...a: unknown[]) => loadWeekInstagramPageSlug(...a),
  };
});
vi.mock("@/lib/ads/ad-settings", async (orig) => {
  const actual = await orig<typeof import("@/lib/ads/ad-settings")>();
  return {
    ...actual,
    getAdSettings: async () => ({ ...actual.DEFAULT_AD_SETTINGS, monthlyBudget: { googleTl: 0, metaTl } }),
  };
});
vi.mock("@/lib/ads/writes", async (orig) => {
  const actual = await orig<typeof import("@/lib/ads/writes")>();
  return { ...actual, loadGateStatus: (...a: unknown[]) => loadGateStatus(...a) };
});

import { buildAdTestContext } from "@/lib/ads/ad-test-context";
import { supabaseSetupStore } from "@/lib/ads/setup-store";

// Cuma 23 Ekim 2026, 15:00 İstanbul.
const NOW = new Date("2026-10-23T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

const FILLED: AdTemplate = {
  ...DEFAULT_AD_TEMPLATE,
  okulAdres: "Bahçelievler Mah. 1. Sokak No 5, Ankara",
  lat: 39.92,
  lng: 32.85,
};

const SETUP: AdSetup = {
  testCampaignId: "100",
  testAdsetId: "200",
  scaleCampaignId: "300",
  scaleAdsetId: "400",
  exclusionAudienceId: "900",
  createdAt: "",
  createdBy: "",
};

function reels(over: Partial<ContentForAd> = {}): ContentForAd {
  return {
    id: "c1",
    code: "R-2644-A",
    topic: "İlk gün uyumu",
    kind: "reels",
    platform: "instagram",
    stage: "organik",
    status: "onaylandi",
    approverFaceCheck: true,
    caption: "İlk hafta ağlamak çok normal.",
    igMediaId: "1789",
    igPermalink: "https://instagram.com/p/x",
    igPublishedAt: hoursAgo(74),
    igPublishStatus: "yayinda",
    mediaMeta: { vertical: true, durationS: 34, subtitled: true },
    ...over,
  };
}

function page(over: Partial<ContentForAd> = {}): ContentForAd {
  return reels({
    code: "S-2644-B",
    kind: "sayfa",
    stage: "test",
    caption: null,
    igMediaId: null,
    igPermalink: null,
    igPublishedAt: null,
    igPublishStatus: "yok",
    ...over,
  });
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
type TestAd = { adId: string; name: string; status: string | null; effectiveStatus: string | null; reviewFeedback: string | null };

function makeStore() {
  return {
    template: vi.fn(async (): Promise<AdTemplate> => FILLED),
    saveTemplate: vi.fn(async () => undefined),
    setup: vi.fn(async (): Promise<AdSetup | null> => SETUP),
    saveSetup: vi.fn(async () => undefined),
    monthMetaSpendTl: vi.fn(async () => 0),
    objectStatus: vi.fn(async (): Promise<string | null> => "ACTIVE"),
    activeStudentNames: vi.fn(async (): Promise<string[]> => []),
    weekLaunches: vi.fn(async () => 0),
    launchInFlight: vi.fn(async () => false),
    campaignSetupInFlight: vi.fn(async () => false),
    testAdForCode: vi.fn(async (): Promise<TestAd[]> => []),
    activeAdsInAdset: vi.fn(async () => 2),
  };
}

const META_ENV = {
  META_ACCESS_TOKEN: "EAAtokentoken",
  META_APP_SECRET: "appsecret123",
  META_AD_ACCOUNT_ID: "act_42",
  META_PIXEL_ID: "777",
  META_CAPI_ENABLED: "true",
  META_INSTAGRAM_USER_ID: "17841",
  META_FACEBOOK_PAGE_ID: "5555",
};

function healthyFetch() {
  return vi.fn<FetchLike>(
    async () =>
      new Response(JSON.stringify({ account_status: 1, currency: "TRY" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
}

function deps(
  over: {
    store?: ReturnType<typeof makeStore>;
    env?: Record<string, string | undefined>;
    fetchFn?: ReturnType<typeof vi.fn>;
  } = {},
) {
  return {
    db: {} as never,
    store: over.store ?? makeStore(),
    env: over.env ?? { ...META_ENV },
    fetchFn: (over.fetchFn ?? healthyFetch()) as unknown as typeof fetch,
    now: NOW,
    actorName: "Zehra Gürsel",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  metaTl = 20_000;
  loadContentForAd.mockResolvedValue(reels());
  loadLandingForAd.mockResolvedValue(null);
  loadWeekInstagramPageSlug.mockResolvedValue(null);
  loadGateStatus.mockResolvedValue({ red: false, labels: [] });
});

describe("buildAdTestContext", () => {
  it("Reels: Z4 satırları, B14 yedek sayfa bağlantısı, kontroller yeşil, plan hazır", async () => {
    const r = await buildAdTestContext(deps(), "c1", { skip72hReason: null });
    if ("error" in r) throw new Error(r.error);
    const v = r.view;
    expect(v.contentId).toBe("c1");
    expect(v.code).toBe("R-2644-A");
    expect(v.kind).toBe("reels");
    expect(v.topic).toBe("İlk gün uyumu");
    expect(v.preview).toEqual({
      kind: "reels",
      caption: "İlk hafta ağlamak çok normal.",
      permalink: "https://instagram.com/p/x",
    });
    expect(v.rows).toEqual([
      { label: "Kampanya", value: "Test · Instagram", sub: "200 TL/gün, kampanya bütçesi · 2 reklam çalışıyor" },
      { label: "Reklam adı", value: "R-2644-A · İlk gün uyumu", sub: null },
      { label: "Kitle", value: "Şeker Anaokulu çevresi 8 km", sub: "25–45 yaş · geniş hedefleme · mevcut veliler hariç" },
      {
        label: "Hedef",
        value: "Lead (web formu)",
        sub: "piksel + Conversions API · 7 gün tıklama, 1 gün görüntüleme",
      },
      {
        label: "Bağlantı",
        value: "yeni.sekeranaokulu.com/lp/az-mevcutlu-anaokulu",
        sub: "?utm_source=instagram&utm_medium=paid_social&utm_content=R-2644-A",
      },
      { label: "Kayıt", value: "Kuran: Zehra Gürsel · eski/yeni değer kayda geçer", sub: null },
    ]);
    expect(v.checklist.ok).toBe(true);
    expect(v.blockText).toBeNull();
    expect(v.needs72hOverride).toBe(false);
    expect(v.hoursLeft).toBeNull();
    expect(v.gateRed).toEqual([]);
    expect(v.writeEnabled).toBe(false);
    expect(v.existing).toBeNull();
    expect(r.setup).toEqual(SETUP);
    expect(r.content.code).toBe("R-2644-A");
    expect(r.planned?.steps.map((s) => s.key)).toEqual(["creative", "ad", "activateAd"]);
    expect(JSON.stringify(r.planned?.steps[0])).toContain(
      "https://yeni.sekeranaokulu.com/lp/az-mevcutlu-anaokulu?utm_source=instagram&utm_medium=paid_social&utm_content=R-2644-A",
    );
    expect(loadWeekInstagramPageSlug).toHaveBeenCalledWith(expect.anything(), "R-2644-A");
  });

  it("aynı haftanın Instagram sayfası yayındaysa bağlantı o sayfaya; SITE_PUBLIC_URL tabanı", async () => {
    loadWeekInstagramPageSlug.mockResolvedValue("ilk-hafta-uyum");
    const r = await buildAdTestContext(
      deps({ env: { ...META_ENV, SITE_PUBLIC_URL: "https://sekeranaokulu.com/" } }),
      "c1",
      { skip72hReason: null },
    );
    if ("error" in r) throw new Error(r.error);
    expect(r.view.rows[4]).toEqual({
      label: "Bağlantı",
      value: "sekeranaokulu.com/lp/ilk-hafta-uyum",
      sub: "?utm_source=instagram&utm_medium=paid_social&utm_content=R-2644-A",
    });
  });

  it("kitle yoksa ya da şablon kapalıysa 'mevcut veliler hariç' yazmaz; Test kampanyası duraklatılmışsa plan açar", async () => {
    const store = makeStore();
    store.setup.mockResolvedValue({ ...SETUP, exclusionAudienceId: null });
    store.objectStatus.mockResolvedValue("PAUSED");
    store.activeAdsInAdset.mockResolvedValue(0);
    const r = await buildAdTestContext(deps({ store }), "c1", { skip72hReason: null });
    if ("error" in r) throw new Error(r.error);
    expect(r.view.rows[0].sub).toBe("200 TL/gün, kampanya bütçesi · 0 reklam çalışıyor");
    expect(r.view.rows[2].sub).toBe("25–45 yaş · geniş hedefleme");
    expect(r.planned?.steps.map((s) => s.key)).toEqual([
      "creative",
      "ad",
      "activateCampaign",
      "activateAdset",
      "activateAd",
    ]);
    expect(store.activeAdsInAdset).toHaveBeenCalledWith("200");
    expect(store.objectStatus).toHaveBeenCalledWith("campaign", "100");
    expect(store.objectStatus).toHaveBeenCalledWith("adset", "200");

    const store2 = makeStore();
    store2.template.mockResolvedValue({ ...FILLED, mevcutVelileriHaricTut: false });
    const r2 = await buildAdTestContext(deps({ store: store2 }), "c1", { skip72hReason: null });
    if ("error" in r2) throw new Error(r2.error);
    expect(r2.view.rows[2].sub).toBe("25–45 yaş · geniş hedefleme");
  });

  it("kurulum yoksa 0 reklam, #9 kırmızı, plan yok, existing null", async () => {
    const store = makeStore();
    store.setup.mockResolvedValue(null);
    const r = await buildAdTestContext(deps({ store }), "c1", { skip72hReason: null });
    if ("error" in r) throw new Error(r.error);
    expect(r.view.rows[0].sub).toBe("200 TL/gün, kampanya bütçesi · 0 reklam çalışıyor");
    expect(r.view.checklist.items[8]).toMatchObject({ key: "hesap", ok: false, label: "Test kampanyası kurulmamış" });
    expect(r.view.rows[2].sub).toBe("25–45 yaş · geniş hedefleme");
    expect(r.planned).toBeNull();
    expect(r.view.existing).toBeNull();
    expect(store.activeAdsInAdset).not.toHaveBeenCalled();
    expect(store.testAdForCode).not.toHaveBeenCalled();
  });

  it("70 saatte needs72hOverride true, hoursLeft 2; #2 kırmızı; gerekçeyle #2 yeşil ama override yine gerekli", async () => {
    loadContentForAd.mockResolvedValue(reels({ igPublishedAt: hoursAgo(70) }));
    const r = await buildAdTestContext(deps(), "c1", { skip72hReason: null });
    if ("error" in r) throw new Error(r.error);
    expect(r.view.needs72hOverride).toBe(true);
    expect(r.view.hoursLeft).toBe(2);
    expect(r.view.checklist.items[1]).toMatchObject({ key: "yayin", ok: false });
    expect(r.view.blockText).toBe("72 saatten önce teste alınamaz · kalan 2 saat");

    const r2 = await buildAdTestContext(deps(), "c1", { skip72hReason: "Okul haftası başlıyor, beklemeyelim" });
    if ("error" in r2) throw new Error(r2.error);
    expect(r2.view.checklist.items[1]).toMatchObject({ key: "yayin", ok: true });
    expect(r2.view.needs72hOverride).toBe(true);
    expect(r2.view.hoursLeft).toBe(2);
  });

  it("Instagram'da yayında değilse override gerekmez (gerekçe geçirmez)", async () => {
    loadContentForAd.mockResolvedValue(reels({ igPublishedAt: null, igPublishStatus: "yok" }));
    const r = await buildAdTestContext(deps(), "c1", { skip72hReason: null });
    if ("error" in r) throw new Error(r.error);
    expect(r.view.needs72hOverride).toBe(false);
    expect(r.view.hoursLeft).toBeNull();
  });

  it("Meta yapılandırılmamışken fetch hiç çağrılmaz, #9 kırmızı, plan yok", async () => {
    const fetchFn = healthyFetch();
    const r = await buildAdTestContext(deps({ env: { META_FACEBOOK_PAGE_ID: "5555" }, fetchFn }), "c1", {
      skip72hReason: null,
    });
    if ("error" in r) throw new Error(r.error);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(r.view.checklist.items[8]).toMatchObject({ key: "hesap", ok: false, label: "Reklam hesabı okunamadı" });
    expect(r.planned).toBeNull();
  });

  it("Meta yapılandırılmışsa hesap sağlığı bir kez GET ile okunur; TRY değilse #9 kırmızı", async () => {
    const fetchFn = vi.fn<FetchLike>(
      async () => new Response(JSON.stringify({ account_status: 1, currency: "USD" }), { status: 200 }),
    );
    const r = await buildAdTestContext(deps({ fetchFn }), "c1", { skip72hReason: null });
    if ("error" in r) throw new Error(r.error);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][1]).toMatchObject({ method: "GET" });
    expect(r.view.checklist.items[8].label).toBe("Hesap para birimi TRY değil (USD)");
  });

  it("Facebook sayfa kimliği yoksa #9 kırmızı ve plan yok", async () => {
    const env: Record<string, string | undefined> = { ...META_ENV };
    delete env.META_FACEBOOK_PAGE_ID;
    const r = await buildAdTestContext(deps({ env }), "c1", { skip72hReason: null });
    if ("error" in r) throw new Error(r.error);
    expect(r.view.checklist.items[8].label).toBe("Facebook sayfası bağlı değil · Mert ekler");
    expect(r.planned).toBeNull();
  });

  it("mevcut Test reklamı varsa existing dolu ve inceleme etiketi", async () => {
    const store = makeStore();
    store.testAdForCode.mockResolvedValue([
      {
        adId: "1208",
        name: "R-2644-A · İlk gün uyumu",
        status: "ACTIVE",
        effectiveStatus: "PENDING_REVIEW",
        reviewFeedback: null,
      },
    ]);
    const r = await buildAdTestContext(deps({ store }), "c1", { skip72hReason: null });
    if ("error" in r) throw new Error(r.error);
    expect(r.view.existing).toEqual({ adId: "1208", review: "İncelemede" });
    expect(store.testAdForCode).toHaveBeenCalledWith("R-2644-A", "200");
  });

  it("sayfa içeriği (A stub): preview boş, #2 ve #8 kırmızı, plan yok", async () => {
    loadContentForAd.mockResolvedValue(page());
    const r = await buildAdTestContext(deps(), "c1", { skip72hReason: null });
    if ("error" in r) throw new Error(r.error);
    expect(r.view.kind).toBe("sayfa");
    expect(r.view.preview).toEqual({ kind: "sayfa", imageUrl: null, headline: null, primaryText: null });
    const red = r.view.checklist.items.filter((x) => !x.ok).map((x) => x.key);
    expect(red).toEqual(["yayin", "bicim"]);
    expect(r.view.needs72hOverride).toBe(false);
    expect(r.view.hoursLeft).toBeNull();
    expect(r.planned).toBeNull();
    expect(loadWeekInstagramPageSlug).not.toHaveBeenCalled();
    expect(loadLandingForAd).toHaveBeenCalledWith(expect.anything(), "c1", "https://yeni.sekeranaokulu.com");
  });

  it("sayfa yayında ve görseli varsa bağlantı sayfanın slug'ı, plan bağlantı kreatifi", async () => {
    loadContentForAd.mockResolvedValue(page());
    const landing: LandingForAd = {
      status: "yayinda",
      slug: "bahce-oyunu",
      headline: "Bahçede oyun",
      primaryText: "Her sabah bahçede",
      imageUrl: "https://yeni.sekeranaokulu.com/media/a.webp",
    };
    loadLandingForAd.mockResolvedValue(landing);
    const r = await buildAdTestContext(deps(), "c1", { skip72hReason: null });
    if ("error" in r) throw new Error(r.error);
    expect(r.view.preview).toEqual({
      kind: "sayfa",
      imageUrl: "https://yeni.sekeranaokulu.com/media/a.webp",
      headline: "Bahçede oyun",
      primaryText: "Her sabah bahçede",
    });
    expect(r.view.rows[4].value).toBe("yeni.sekeranaokulu.com/lp/bahce-oyunu");
    expect(r.view.checklist.ok).toBe(true);
    expect(r.planned?.steps.map((s) => s.key)).toEqual(["creative", "ad", "activateAd"]);
  });

  it("kapı kırmızıysa etiketleri; bayrak açıksa writeEnabled", async () => {
    loadGateStatus.mockResolvedValue({ red: true, labels: ["Randevu verilen · geçen hafta"] });
    const r = await buildAdTestContext(deps({ env: { ...META_ENV, ADS_WRITE_ENABLED: "true" } }), "c1", {
      skip72hReason: null,
    });
    if ("error" in r) throw new Error(r.error);
    expect(r.view.gateRed).toEqual(["Randevu verilen · geçen hafta"]);
    expect(r.view.writeEnabled).toBe(true);
  });

  it("aylık Meta bütçesi 0 → #6 kırmızı", async () => {
    metaTl = 0;
    const r = await buildAdTestContext(deps(), "c1", { skip72hReason: null });
    if ("error" in r) throw new Error(r.error);
    expect(r.view.checklist.items[5]).toMatchObject({
      key: "butce",
      ok: false,
      label: "Aylık Meta bütçesi Ayarlar'da 0",
    });
  });

  it("içerik yoksa ya da Google içeriğiyse hata; okuma hatasında hata", async () => {
    loadContentForAd.mockResolvedValue(null);
    expect(await buildAdTestContext(deps(), "c1", { skip72hReason: null })).toEqual({ error: "İçerik bulunamadı." });
    loadContentForAd.mockResolvedValue(reels({ platform: "google" }));
    expect(await buildAdTestContext(deps(), "c1", { skip72hReason: null })).toEqual({
      error: "Yalnız Instagram içerikleri reklam testine alınır.",
    });
    loadContentForAd.mockResolvedValue(reels());
    const store = makeStore();
    store.setup.mockRejectedValue(new Error("db"));
    expect(await buildAdTestContext(deps({ store }), "c1", { skip72hReason: null })).toEqual({
      error: "Bilgiler okunamadı, tekrar deneyin.",
    });
  });
});

type Call = { method: string; args: unknown[] };

function thenableDb(result: unknown, calls: Call[]) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "in", "limit"]) {
    chain[m] = (...args: unknown[]) => {
      calls.push({ method: m, args });
      return chain;
    };
  }
  chain.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return {
    from: (t: string) => {
      calls.push({ method: "from", args: [t] });
      return chain;
    },
  } as never;
}

describe("supabaseSetupStore (Z4 okumaları)", () => {
  it("activeAdsInAdset: Test setindeki ACTIVE reklam sayısı", async () => {
    const calls: Call[] = [];
    const store = supabaseSetupStore(thenableDb({ count: 3, error: null }, calls));
    expect(await store.activeAdsInAdset("200")).toBe(3);
    expect(calls).toContainEqual({ method: "from", args: ["ad_objects"] });
    expect(calls).toContainEqual({ method: "eq", args: ["platform", "meta"] });
    expect(calls).toContainEqual({ method: "eq", args: ["level", "ad"] });
    expect(calls).toContainEqual({ method: "eq", args: ["parent_id", "200"] });
    expect(calls).toContainEqual({ method: "eq", args: ["status", "ACTIVE"] });
  });

  it("activeAdsInAdset: okuma hatasında atar", async () => {
    const store = supabaseSetupStore(thenableDb({ count: null, error: { message: "x" } }, []));
    await expect(store.activeAdsInAdset("200")).rejects.toThrow();
  });

  it("testAdForCode inceleme durumunu da döner", async () => {
    const store = supabaseSetupStore(
      thenableDb(
        {
          data: [
            {
              object_id: "1208",
              name: "R-2644-A · x",
              status: "ACTIVE",
              effective_status: "DISAPPROVED",
              review_feedback: "Metin",
            },
          ],
          error: null,
        },
        [],
      ),
    );
    expect(await store.testAdForCode("R-2644-A", "200")).toEqual([
      { adId: "1208", name: "R-2644-A · x", status: "ACTIVE", effectiveStatus: "DISAPPROVED", reviewFeedback: "Metin" },
    ]);
  });
});
