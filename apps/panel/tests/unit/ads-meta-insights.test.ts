import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fetchMetaAdSpend, MetaApiError } from "@/lib/ads/meta/insights";
import { appSecretProof, type MetaConfig } from "@/lib/ads/meta/config";

const CFG: MetaConfig = {
  accessToken: "TOKEN-GIZLI-123",
  appSecret: "secret",
  adAccountId: "act_123",
  pixelId: null,
  testEventCode: null,
  capiEnabled: false,
};

const fixture = JSON.parse(
  readFileSync(join(__dirname, "../fixtures/meta-insights.json"), "utf8"),
) as { pages: unknown[] };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function twoPageFetch() {
  return vi
    .fn()
    .mockResolvedValueOnce(jsonResponse(fixture.pages[0]))
    .mockResolvedValueOnce(jsonResponse(fixture.pages[1]));
}

describe("fetchMetaAdSpend", () => {
  it("reklam satırlarını platformlu satıra çevirir", async () => {
    const rows = await fetchMetaAdSpend(CFG, "2026-10-18", "2026-10-18", twoPageFetch());
    expect(rows[0]).toEqual({
      date: "2026-10-18",
      campaignId: "6001",
      campaignName: "Kayıt dönemi",
      costMicros: 123450000,
      clicks: 90,
      impressions: 5400,
      platform: "meta",
      level: "ad",
      objectId: "8001",
      adsetId: "7001",
      adsetName: "Beylikdüzü 25-45",
      adId: "8001",
      adName: "R-2645-A · Bir günümüz",
      contentCode: "R-2645-A",
      reach: 4100,
      frequency: 1.42,
      platformResults: 3,
    });
  });

  it("sonraki sayfayı izler", async () => {
    const fetchFn = twoPageFetch();
    const rows = await fetchMetaAdSpend(CFG, "2026-10-18", "2026-10-18", fetchFn);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.adId)).toEqual(["8001", "8002"]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(String(fetchFn.mock.calls[1][0])).toContain("after=A1");
  });

  it("kodsuz reklam adında contentCode null, eksik alanlar null/0", async () => {
    const rows = await fetchMetaAdSpend(CFG, "2026-10-18", "2026-10-18", twoPageFetch());
    expect(rows[1].contentCode).toBeNull();
    expect(rows[1].costMicros).toBe(10500000);
    expect(rows[1].platformResults).toBe(0);
    expect(rows[1].reach).toBeNull();
    expect(rows[1].frequency).toBeNull();
  });

  it("fb_pixel_lead yoksa lead değerini kullanır", async () => {
    const page = {
      data: [{ date_start: "2026-10-18", campaign_id: "1", ad_id: "2", ad_name: "x", spend: "1", actions: [{ action_type: "lead", value: "4" }] }],
    };
    const rows = await fetchMetaAdSpend(CFG, "2026-10-18", "2026-10-18", vi.fn().mockResolvedValue(jsonResponse(page)));
    expect(rows[0].platformResults).toBe(4);
  });

  it("istekte appsecret_proof ve tarih aralığı var, token URL'de yok", async () => {
    const fetchFn = twoPageFetch();
    await fetchMetaAdSpend(CFG, "2026-10-12", "2026-10-18", fetchFn);
    for (const call of fetchFn.mock.calls) {
      const [url, init] = call;
      expect(String(url)).not.toContain("TOKEN-GIZLI-123");
      expect(String(url)).not.toContain("access_token");
      expect(String(url)).toContain(`appsecret_proof=${appSecretProof(CFG.accessToken, CFG.appSecret)}`);
      expect(init.headers).toMatchObject({ authorization: "Bearer TOKEN-GIZLI-123" });
      expect(init.signal).toBeInstanceOf(AbortSignal);
    }
    const first = new URL(String(fetchFn.mock.calls[0][0]));
    expect(first.origin + first.pathname).toBe("https://graph.facebook.com/v26.0/act_123/insights");
    expect(first.searchParams.get("level")).toBe("ad");
    expect(first.searchParams.get("time_increment")).toBe("1");
    expect(JSON.parse(first.searchParams.get("time_range")!)).toEqual({ since: "2026-10-12", until: "2026-10-18" });
    expect(JSON.parse(first.searchParams.get("action_attribution_windows")!)).toEqual(["7d_click", "1d_view"]);
    expect(first.searchParams.get("fields")).toBe(
      "date_start,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,reach,frequency,clicks,inline_link_clicks,actions",
    );
  });

  it("paging.next başka bir sunucuya işaret ederse izlemez", async () => {
    const page = { data: [], paging: { next: "https://evil.example/steal?x=1" } };
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(page));
    await expect(fetchMetaAdSpend(CFG, "2026-10-18", "2026-10-18", fetchFn)).rejects.toBeInstanceOf(MetaApiError);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("hata yanıtı MetaApiError fırlatır ve mesajda token geçmez", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ error: { message: "Invalid token TOKEN-GIZLI-123 " + "x".repeat(600), code: 190 } }, 400),
    );
    const err = await fetchMetaAdSpend(CFG, "2026-10-18", "2026-10-18", fetchFn).catch((e) => e);
    expect(err).toBeInstanceOf(MetaApiError);
    expect(err.status).toBe(400);
    expect(err.code).toBe(190);
    expect(err.message).not.toContain("TOKEN-GIZLI-123");
    expect(err.message.length).toBeLessThanOrEqual(600);
  });

  it("geçersiz tarihte istek atmadan hata verir", async () => {
    const fetchFn = vi.fn();
    await expect(fetchMetaAdSpend(CFG, "bozuk", "2026-10-18", fetchFn)).rejects.toThrow("Geçersiz tarih");
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
