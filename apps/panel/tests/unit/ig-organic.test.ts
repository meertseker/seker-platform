import { describe, expect, it, vi } from "vitest";
import fixture from "../fixtures/ig-media.json";
import { fetchReelInsights, resolveMediaId } from "@/lib/ads/meta/instagram";
import { readMetaConfig, type MetaConfig } from "@/lib/ads/meta/config";

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

describe("Instagram organik (Meta)", () => {
  it("META_INSTAGRAM_USER_ID okunur; yoksa null, yapılandırma kararı değişmez", () => {
    const base = { META_ACCESS_TOKEN: "t", META_APP_SECRET: "s", META_AD_ACCOUNT_ID: "42" };
    expect(readMetaConfig(base)?.instagramUserId).toBeNull();
    expect(readMetaConfig({ ...base, META_INSTAGRAM_USER_ID: " 1784 " })?.instagramUserId).toBe("1784");
    expect(readMetaConfig({ META_INSTAGRAM_USER_ID: "1784" })).toBeNull();
  });

  it("permalink eşleşir (sondaki / ve sorgu yok sayılır), anahtar yalnız başlıkta", async () => {
    const fetchFn = vi.fn(async () => json(fixture.media));
    const id = await resolveMediaId(cfg, "https://www.instagram.com/reel/DBcD123?igsh=abc", asFetch(fetchFn));
    expect(id).toEqual({ id: "1790002", timestamp: "2026-10-13T09:30:00+0000" });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/v26.0/17841400000000000/media?");
    expect(url).toContain("limit=50");
    expect(url).toContain("appsecret_proof=");
    expect(url).not.toContain("tok-secret");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok-secret");
  });

  it("/p/KOD ve /reel/KOD aynı gönderidir (kısa kodla eşleşir)", async () => {
    const fetchFn = vi.fn(async () => json(fixture.media));
    const id = await resolveMediaId(cfg, "https://www.instagram.com/p/DBcD123/", asFetch(fetchFn));
    expect(id?.id).toBe("1790002");
  });

  it("medya listesi hatası listeye özgü önekle gelir", async () => {
    const fetchFn = vi.fn(async () => json({ error: { message: "izin yok", code: 10 } }, 400));
    await expect(resolveMediaId(cfg, "https://www.instagram.com/reel/X/", asFetch(fetchFn))).rejects.toThrow(/Instagram medya listesi/);
  });

  it("eşleşme yoksa null döner", async () => {
    const fetchFn = vi.fn(async () => json(fixture.media));
    expect(await resolveMediaId(cfg, "https://www.instagram.com/reel/YOKYOK/", asFetch(fetchFn))).toBeNull();
  });

  it("instagramUserId yoksa istek gitmez", async () => {
    const fetchFn = vi.fn();
    const id = await resolveMediaId({ ...cfg, instagramUserId: null }, "https://www.instagram.com/reel/DBcD123/", asFetch(fetchFn));
    expect(id).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("insights metrikleri eşlenir", async () => {
    const fetchFn = vi.fn(async () => json(fixture.insights));
    const r = await fetchReelInsights(cfg, "1790002", asFetch(fetchFn));
    expect(r).toEqual({ views: 4210, reach: 3100, saved: 41, shares: 17, totalInteractions: 130, avgWatchMs: 5322 });
    const [url] = fetchFn.mock.calls[0] as unknown as [string];
    expect(url).toContain("/v26.0/1790002/insights?");
    expect(decodeURIComponent(url)).toContain("metric=views,reach,saved,shares,total_interactions,ig_reels_avg_watch_time");
  });

  it("hata gövdesindeki anahtar maskelenir", async () => {
    const fetchFn = vi.fn(async () => json({ error: { message: "bad tok-secret", code: 10 } }, 400));
    await expect(fetchReelInsights(cfg, "1", asFetch(fetchFn))).rejects.toThrow(/\[gizli\]/);
  });
});
