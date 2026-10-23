import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { appSecretProof, type MetaConfig } from "@/lib/ads/meta/config";
import {
  ADSET_OPTIMIZATION_GOAL,
  buildAdsetTargeting,
  copyAdToAdset,
  createAd,
  createAdSet,
  createCampaign,
  createLinkCreative,
  createReelCreative,
  readAccountHealth,
  ref,
  reviewFeedbackText,
  reviewLabel,
  runSetupSteps,
  setObjectStatus,
  tlToMinor,
} from "@/lib/ads/meta/setup";
import { DEFAULT_AD_TEMPLATE, type AdTemplate } from "@/lib/ads/ad-template";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const R = JSON.parse(readFileSync(join(__dirname, "../fixtures/meta-setup-responses.json"), "utf8")) as Record<
  string,
  unknown
>;

const CFG: MetaConfig = {
  accessToken: "META-GIZLI-ANAHTAR",
  appSecret: "uygulama-sirri",
  adAccountId: "act_42",
  pixelId: "999",
  testEventCode: null,
  capiEnabled: false,
};
const PROOF = appSecretProof(CFG.accessToken, CFG.appSecret);

const TEMPLATE: AdTemplate = { ...DEFAULT_AD_TEMPLATE, okulAdres: "Beylikdüzü", lat: 41.0, lng: 28.6 };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Sırayla yanıt veren sahte fetch; çağrıları kaydeder. */
function fakeFetch(responses: Array<[unknown, number?]>) {
  const queue = [...responses];
  return vi.fn(async (_url: string, _init?: RequestInit) => {
    const next = queue.shift();
    if (!next) throw new Error("beklenmeyen çağrı");
    return json(next[0], next[1] ?? 200);
  });
}

function bodyOf(init: RequestInit | undefined): URLSearchParams {
  return new URLSearchParams(String(init?.body ?? ""));
}

describe("adım yükleri", () => {
  it("kampanya yükü", () => {
    const step = createCampaign("act_42", { key: "test", name: "Test · Instagram", dailyBudgetTl: 200 });
    expect(step.path).toBe("act_42/campaigns");
    expect(step.result).toBe("id");
    expect(step.params.daily_budget).toBe(20000);
    expect(step.params.objective).toBe("OUTCOME_LEADS");
    expect(step.params.status).toBe("PAUSED");
    expect(step.params.special_ad_categories).toEqual([]);
    expect(step.params.bid_strategy).toBe("LOWEST_COST_WITHOUT_CAP");
    expect(tlToMinor(12.345)).toBe(1235);
  });

  it("reklam seti yükü", () => {
    const step = createAdSet("act_42", {
      key: "adset",
      name: "Test · set",
      campaign: ref("campaign"),
      pixelId: "999",
      template: TEMPLATE,
      excludedAudience: null,
    });
    const p = step.params as Any;
    expect(step.path).toBe("act_42/adsets");
    expect(p.campaign_id).toEqual({ $ref: "campaign" });
    expect(p.optimization_goal).toBe(ADSET_OPTIMIZATION_GOAL);
    expect(p.optimization_goal).toBe("OFFSITE_CONVERSIONS");
    expect(p.billing_event).toBe("IMPRESSIONS");
    expect(p.status).toBe("PAUSED");
    expect(p.destination_type).toBe("WEBSITE");
    expect(p.promoted_object).toEqual({ pixel_id: "999", custom_event_type: "LEAD" });
    expect(p.attribution_spec).toHaveLength(2);
    const loc = p.targeting.geo_locations.custom_locations[0];
    expect(loc).toEqual({ latitude: 41.0, longitude: 28.6, radius: 8, distance_unit: "kilometer" });
    expect(p.targeting.age_min).toBe(25);
    expect(p.targeting.age_max).toBe(45);
    expect(p.targeting.publisher_platforms).toEqual(["instagram"]);
    expect(p.targeting.targeting_automation.advantage_audience).toBe(0);
    expect("excluded_custom_audiences" in p.targeting).toBe(false);
  });

  it("reklam seti dışlama kitlesi ve eksik konum", () => {
    const t = buildAdsetTargeting(TEMPLATE, "777") as Any;
    expect(t.excluded_custom_audiences).toEqual([{ id: "777" }]);
    const r = buildAdsetTargeting(TEMPLATE, ref("kitle")) as Any;
    expect(r.excluded_custom_audiences).toEqual([{ id: { $ref: "kitle" } }]);
    expect(() =>
      createAdSet("act_42", {
        key: "adset",
        name: "x",
        campaign: "1",
        pixelId: "999",
        template: { ...TEMPLATE, lat: null },
        excludedAudience: null,
      }),
    ).toThrow("Okul konumu eksik");
  });

  it("Reels kreatifi", () => {
    const step = createReelCreative("act_42", {
      key: "creative",
      name: "R-2645-A · Bir günümüz",
      pageId: "P1",
      igUserId: "IG1",
      igMediaId: "M1",
      link: "https://seker.example/lp/x?utm_content=R-2645-A",
      urlTags: "utm_campaign={{campaign.id}}",
    });
    const p = step.params as Any;
    expect(step.path).toBe("act_42/adcreatives");
    expect(p.source_instagram_media_id).toBe("M1");
    expect(p.instagram_user_id).toBe("IG1");
    expect(p.object_id).toBe("P1");
    expect(p.call_to_action.type).toBe("LEARN_MORE");
    expect(p.call_to_action.value.link).toContain("utm_content=R-2645-A");
    expect(p.url_tags).toBe("utm_campaign={{campaign.id}}");
    expect("instagram_actor_id" in p).toBe(false);
  });

  it("bağlantı kreatifi: IG kimliği yoksa anahtar yok", () => {
    const base = {
      key: "creative",
      name: "S-2645-I",
      pageId: "P1",
      imageUrl: "https://seker.example/a.webp",
      message: "Mesaj",
      headline: "Başlık",
      link: "https://seker.example/lp/a",
      urlTags: "utm_campaign={{campaign.id}}",
    };
    const without = createLinkCreative("act_42", { ...base, igUserId: null }).params as Any;
    expect("instagram_user_id" in without.object_story_spec).toBe(false);
    expect(without.object_story_spec.page_id).toBe("P1");
    expect(without.object_story_spec.link_data).toMatchObject({ name: "Başlık", picture: base.imageUrl, message: "Mesaj" });
    expect(without.url_tags).toBe(base.urlTags);
    const withIg = createLinkCreative("act_42", { ...base, igUserId: "IG1" }).params as Any;
    expect(withIg.object_story_spec.instagram_user_id).toBe("IG1");
  });

  it("reklam, durum ve kopya adımları", () => {
    const ad = createAd("act_42", { key: "ad", name: "R · konu", adsetId: "444", creative: ref("creative") });
    expect(ad.path).toBe("act_42/ads");
    expect(ad.params).toEqual({
      name: "R · konu",
      adset_id: "444",
      creative: { creative_id: { $ref: "creative" } },
      status: "PAUSED",
    });
    const st = setObjectStatus({ key: "on", objectId: ref("ad"), status: "ACTIVE", label: "Reklamı aç" });
    expect(st.path).toEqual({ ref: "ad", suffix: "" });
    expect(st.result).toBe("success");
    expect(setObjectStatus({ key: "off", objectId: "555", status: "PAUSED", label: "x" }).path).toBe("555");
    const cp = copyAdToAdset({ key: "copy", adId: "555", adsetId: "666" });
    expect(cp.path).toBe("555/copies");
    expect(cp.result).toBe("copied_ad_id");
    expect(cp.params).toEqual({
      adset_id: "666",
      status_option: "PAUSED",
      rename_options: { rename_strategy: "NO_RENAME" },
    });
  });
});

describe("runSetupSteps", () => {
  const steps = () => [
    createCampaign("act_42", { key: "campaign", name: "Test · Instagram", dailyBudgetTl: 200 }),
    createAdSet("act_42", {
      key: "adset",
      name: "Test · set",
      campaign: ref("campaign"),
      pixelId: "999",
      template: TEMPLATE,
      excludedAudience: null,
    }),
    createReelCreative("act_42", {
      key: "creative",
      name: "R",
      pageId: "P1",
      igUserId: "IG1",
      igMediaId: "M1",
      link: "https://seker.example/lp/x",
      urlTags: "utm_campaign={{campaign.id}}",
    }),
    createAd("act_42", { key: "ad", name: "R · konu", adsetId: "444", creative: ref("creative") }),
    copyAdToAdset({ key: "copy", adId: "555", adsetId: "666" }),
    setObjectStatus({ key: "on", objectId: ref("ad"), status: "ACTIVE", label: "Reklamı aç" }),
  ];

  it("ref çözer", async () => {
    const fetchFn = fakeFetch([[R.campaign], [R.adset], [R.creative], [R.ad], [R.copy], [R.success]]);
    const out = await runSetupSteps(CFG, steps(), fetchFn as unknown as typeof fetch);
    expect(out).toEqual({ ok: true, ids: { campaign: "111", adset: "444", creative: "222", ad: "555", copy: "333" } });
    const calls = fetchFn.mock.calls;
    expect(calls[0][0]).toBe("https://graph.facebook.com/v26.0/act_42/campaigns");
    expect(bodyOf(calls[0][1]).get("special_ad_categories")).toBe("[]");
    expect(bodyOf(calls[0][1]).get("daily_budget")).toBe("20000");
    expect(bodyOf(calls[1][1]).get("campaign_id")).toBe("111");
    expect(JSON.parse(bodyOf(calls[1][1]).get("targeting")!).targeting_automation).toEqual({ advantage_audience: 0 });
    expect(bodyOf(calls[3][1]).get("creative")).toBe('{"creative_id":"222"}');
    expect(calls[4][0]).toBe("https://graph.facebook.com/v26.0/555/copies");
    expect(calls[5][0]).toBe("https://graph.facebook.com/v26.0/555");
    expect(bodyOf(calls[5][1]).get("status")).toBe("ACTIVE");
    for (const [, init] of calls) {
      expect(init?.method).toBe("POST");
      expect(bodyOf(init).get("appsecret_proof")).toBe(PROOF);
    }
  });

  it("ikinci adım patlarsa ilk kimlik döner", async () => {
    const fetchFn = fakeFetch([[R.campaign], [R.adsetError, 400]]);
    const out = await runSetupSteps(CFG, steps(), fetchFn as unknown as typeof fetch);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.ids).toEqual({ campaign: "111" });
    expect(out.failedKey).toBe("adset");
    expect(out.error).not.toContain(CFG.accessToken);
    expect(out.error).not.toContain(PROOF);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("ağ hatası da yakalanır, anahtar sızmaz", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error(`bağlantı koptu ${CFG.accessToken} ${PROOF}`);
    });
    const out = await runSetupSteps(CFG, steps().slice(0, 1), fetchFn as unknown as typeof fetch);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.failedKey).toBe("campaign");
    expect(out.error).not.toContain(CFG.accessToken);
    expect(out.error).not.toContain(PROOF);
  });

  it("çözülemeyen ref hata verir, istek gitmez", async () => {
    const fetchFn = fakeFetch([]);
    const out = await runSetupSteps(
      CFG,
      [createAd("act_42", { key: "ad", name: "x", adsetId: "444", creative: ref("yok") })],
      fetchFn as unknown as typeof fetch,
    );
    expect(out).toMatchObject({ ok: false, ids: {}, failedKey: "ad" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("beklenen kimlik yanıtta yoksa hata", async () => {
    const fetchFn = fakeFetch([[{}]]);
    const out = await runSetupSteps(CFG, steps().slice(0, 1), fetchFn as unknown as typeof fetch);
    expect(out).toMatchObject({ ok: false, failedKey: "campaign" });
  });

  it("anahtar URL'de değil", async () => {
    const fetchFn = fakeFetch([[R.campaign], [R.adset], [R.creative], [R.ad], [R.copy], [R.success]]);
    await runSetupSteps(CFG, steps(), fetchFn as unknown as typeof fetch);
    for (const [url, init] of fetchFn.mock.calls) {
      expect(url).not.toContain("access_token");
      expect(url).not.toContain(CFG.accessToken);
      expect(String(init?.body)).not.toContain(CFG.accessToken);
      expect((init?.headers as Record<string, string>).authorization).toBe(`Bearer ${CFG.accessToken}`);
    }
  });
});

describe("readAccountHealth", () => {
  it("aktif hesap", async () => {
    const fetchFn = fakeFetch([[R.accountActive]]);
    const h = await readAccountHealth(CFG, fetchFn as unknown as typeof fetch);
    expect(h).toEqual({ readable: true, active: true, status: 1, currency: "TRY", text: "Sağlıklı" });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toContain("/v26.0/act_42?");
    expect(url).toContain("fields=account_status%2Cdisable_reason%2Ccurrency%2Cname");
    expect(url).not.toContain("access_token");
    expect(init?.method).toBe("GET");
  });

  it("ödenmemiş bakiye", async () => {
    const fetchFn = fakeFetch([[R.accountUnsettled]]);
    const h = await readAccountHealth(CFG, fetchFn as unknown as typeof fetch);
    expect(h.readable).toBe(true);
    expect(h.active).toBe(false);
    expect(h.status).toBe(3);
    expect(h.text).toBe("Ödenmemiş bakiye");
  });

  it("ağ hatası → readable false, hata atmaz", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("ağ yok");
    });
    const h = await readAccountHealth(CFG, fetchFn as unknown as typeof fetch);
    expect(h).toEqual({ readable: false, active: false, status: null, currency: null, text: "Reklam hesabı okunamadı" });
  });

  it("HTTP hatası → readable false", async () => {
    const fetchFn = fakeFetch([[{ error: { message: "x" } }, 500]]);
    const h = await readAccountHealth(CFG, fetchFn as unknown as typeof fetch);
    expect(h.readable).toBe(false);
  });
});

describe("inceleme metni", () => {
  it("reviewLabel", () => {
    expect(reviewLabel("DISAPPROVED", "Yanıltıcı iddia")).toBe("Reddedildi: Yanıltıcı iddia");
    expect(reviewLabel("DISAPPROVED", null)).toBe("Reddedildi");
    expect(reviewLabel("PENDING_REVIEW", null)).toBe("İncelemede");
    expect(reviewLabel("IN_PROCESS", null)).toBe("İncelemede");
    expect(reviewLabel("WITH_ISSUES", null)).toBe("Sorunlu");
    expect(reviewLabel("ACTIVE", null)).toBeNull();
    expect(reviewLabel(null, null)).toBeNull();
  });

  it("reviewFeedbackText", () => {
    expect(reviewFeedbackText({ global: { A: "Bir", B: "İki" } })).toBe("Bir · İki");
    expect(reviewFeedbackText(null)).toBeNull();
    expect(reviewFeedbackText({ global: {} })).toBeNull();
    expect(reviewFeedbackText({ global: { A: "x".repeat(400) } })!.length).toBe(300);
  });
});
