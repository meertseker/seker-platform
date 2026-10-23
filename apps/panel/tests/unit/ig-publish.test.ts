import { describe, expect, it, vi } from "vitest";
import fx from "../fixtures/ig-publish.json";
import {
  createReelContainer,
  fetchPublishedMedia,
  getContainerStatus,
  getPublishingLimit,
  publishContainer,
} from "@/lib/ads/meta/publish";
import { igPublishEnabled, readMetaConfig, type MetaConfig } from "@/lib/ads/meta/config";
import { MetaApiError } from "@/lib/ads/meta/insights";

const cfg: MetaConfig = {
  accessToken: "tok-secret",
  appSecret: "app-secret",
  adAccountId: "act_42",
  pixelId: null,
  testEventCode: null,
  capiEnabled: false,
  instagramUserId: "17841400000000000",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const asFetch = (fn: unknown) => fn as unknown as typeof fetch;
type Call = [string, RequestInit];

describe("Instagram Reels yayın istemcisi", () => {
  it("konteyner REELS, ms kapak ve share_to_feed=true ile açılır; anahtar yalnız başlıkta", async () => {
    const fetchFn = vi.fn(async () => json(fx.container));
    const id = await createReelContainer(
      cfg,
      { videoUrl: "https://x.supabase.co/storage/v1/object/sign/icerik/a.mp4?token=abc", caption: "Bahçede ilk gün", thumbOffsetMs: 1000 },
      asFetch(fetchFn),
    );
    expect(id).toBe("1799000000000001");
    const [url, init] = fetchFn.mock.calls[0] as unknown as Call;
    expect(url).toBe("https://graph.facebook.com/v26.0/17841400000000000/media");
    expect(init.method).toBe("POST");
    const body = String(init.body);
    expect(body).toContain("media_type=REELS");
    expect(body).toContain("thumb_offset=1000");
    expect(body).toContain("share_to_feed=true");
    expect(body).toContain("video_url=https%3A%2F%2Fx.supabase.co");
    expect(body).toContain("appsecret_proof=");
    expect(url + body).not.toContain("tok-secret");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok-secret");
  });

  it("durum FINISHED okunur", async () => {
    const fetchFn = vi.fn(async () => json(fx.statusFinished));
    const s = await getContainerStatus(cfg, "1799000000000001", asFetch(fetchFn));
    expect(s).toEqual({ statusCode: "FINISHED", status: fx.statusFinished.status, errorSubcode: null });
    const [url] = fetchFn.mock.calls[0] as unknown as Call;
    expect(url).toContain("/v26.0/1799000000000001?");
    expect(url).toContain("fields=status_code%2Cstatus");
  });

  it("ERROR durumunda alt kod 2207026 ayıklanır", async () => {
    const s = await getContainerStatus(cfg, "1799000000000001", asFetch(vi.fn(async () => json(fx.statusError))));
    expect(s.statusCode).toBe("ERROR");
    expect(s.errorSubcode).toBe(2207026);
  });

  it("bilinmeyen durum UNKNOWN olur", async () => {
    const s = await getContainerStatus(cfg, "1799000000000001", asFetch(vi.fn(async () => json(fx.statusWeird))));
    expect(s.statusCode).toBe("UNKNOWN");
    expect(s.status).toBeNull();
  });

  it("media_publish creation_id ile çağrılır ve medya kimliğini döner", async () => {
    const fetchFn = vi.fn(async () => json(fx.publish));
    expect(await publishContainer(cfg, "1799000000000001", asFetch(fetchFn))).toBe("17900000000000077");
    const [url, init] = fetchFn.mock.calls[0] as unknown as Call;
    expect(url).toBe("https://graph.facebook.com/v26.0/17841400000000000/media_publish");
    expect(String(init.body)).toContain("creation_id=1799000000000001");
  });

  it("yayınlanan medyanın permalink ve timestamp alanları okunur", async () => {
    const fetchFn = vi.fn(async () => json(fx.media));
    const m = await fetchPublishedMedia(cfg, "17900000000000077", asFetch(fetchFn));
    expect(m).toEqual({ id: "17900000000000077", permalink: fx.media.permalink, timestamp: fx.media.timestamp });
    const [url] = fetchFn.mock.calls[0] as unknown as Call;
    expect(url).toContain("fields=id%2Cpermalink%2Ctimestamp");
  });

  it("günlük sınır 50 içinden 3 kullanılmış → kalan 47", async () => {
    const fetchFn = vi.fn(async () => json(fx.limit));
    expect(await getPublishingLimit(cfg, asFetch(fetchFn))).toEqual({ used: 3, total: 50, remaining: 47 });
    const [url] = fetchFn.mock.calls[0] as unknown as Call;
    expect(url).toContain("/17841400000000000/content_publishing_limit?");
  });

  it("Meta hatası kod ve alt kodla MetaApiError olur", async () => {
    const fetchFn = vi.fn(async () => json(fx.errorLimit, 400));
    const err = await publishContainer(cfg, "1799000000000001", asFetch(fetchFn)).catch((e) => e);
    expect(err).toBeInstanceOf(MetaApiError);
    expect(err).toMatchObject({ code: 9, subcode: 2207042 });
    expect(String(err.message)).not.toContain("tok-secret");
  });

  it("beklenmeyen yanıt 502 olur", async () => {
    const err = await createReelContainer(cfg, { videoUrl: "https://x", caption: "a", thumbOffsetMs: 0 }, asFetch(vi.fn(async () => json({})))).catch((e) => e);
    expect(err).toMatchObject({ status: 502 });
  });

  it("instagramUserId yoksa istek gitmez", async () => {
    const fetchFn = vi.fn();
    const err = await getPublishingLimit({ ...cfg, instagramUserId: null }, asFetch(fetchFn)).catch((e) => e);
    expect(err).toBeInstanceOf(MetaApiError);
    expect(err.status).toBe(400);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("kimlik rakam değilse istek gitmez", async () => {
    const fetchFn = vi.fn();
    await expect(getContainerStatus(cfg, "../me", asFetch(fetchFn))).rejects.toMatchObject({ status: 400 });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("IG_PUBLISH_ENABLED yalnız \"true\" iken açık; sayfa kimliği okunur", () => {
    expect(igPublishEnabled({ IG_PUBLISH_ENABLED: "1" })).toBe(false);
    expect(igPublishEnabled({})).toBe(false);
    expect(igPublishEnabled({ IG_PUBLISH_ENABLED: "true" })).toBe(true);
    const base = { META_ACCESS_TOKEN: "t", META_APP_SECRET: "s", META_AD_ACCOUNT_ID: "42" };
    expect(readMetaConfig({ ...base, META_FACEBOOK_PAGE_ID: " 123 " })?.facebookPageId).toBe("123");
    expect(readMetaConfig(base)?.facebookPageId).toBeNull();
  });
});
