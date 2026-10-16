import { describe, it, expect, vi } from "vitest";
import {
  readGa4Config,
  fetchSiteTraffic,
  describeGa4Error,
  Ga4Error,
  SITE_EVENTS,
  type Ga4Config,
} from "@/lib/analytics/ga4";

const CFG: Ga4Config = { propertyId: "123456789", clientId: "cid", clientSecret: "sec", refreshToken: "rt" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("readGa4Config", () => {
  const env = {
    GA4_PROPERTY_ID: "properties/123456789",
    GOOGLE_ADS_CLIENT_ID: "cid",
    GOOGLE_ADS_CLIENT_SECRET: "sec",
    GOOGLE_ADS_REFRESH_TOKEN: "rt",
  };

  it("mülk ID'sinden yalnız rakamları alır", () => {
    expect(readGa4Config(env)).toEqual(CFG);
  });

  it("mülk ID'si veya OAuth değeri eksikse null", () => {
    expect(readGa4Config({ ...env, GA4_PROPERTY_ID: "" })).toBeNull();
    expect(readGa4Config({ ...env, GOOGLE_ADS_REFRESH_TOKEN: "" })).toBeNull();
  });
});

describe("fetchSiteTraffic", () => {
  it("tek batchRunReports isteğiyle özet, kaynak, sayfa ve olayları döner", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json({ access_token: "acc" }))
      .mockResolvedValueOnce(
        json({
          reports: [
            { rows: [{ metricValues: [{ value: "120" }, { value: "150" }, { value: "400" }] }] },
            {
              rows: [
                { dimensionValues: [{ value: "Paid Search" }], metricValues: [{ value: "90" }, { value: "80" }] },
                { dimensionValues: [{ value: "Yeni Kanal" }], metricValues: [{ value: "5" }, { value: "4" }] },
              ],
            },
            { rows: [{ dimensionValues: [{ value: "/" }], metricValues: [{ value: "200" }, { value: "100" }] }] },
            { rows: [{ dimensionValues: [{ value: "lead_submit" }], metricValues: [{ value: "7" }] }] },
          ],
        }),
      );

    const traffic = await fetchSiteTraffic(CFG, "2026-10-01", "2026-10-15", fetchFn);

    expect(traffic.totals).toEqual({ users: 120, sessions: 150, pageViews: 400 });
    expect(traffic.channels).toEqual([
      { label: "Google Ads (arama reklamı)", sessions: 90, users: 80 },
      { label: "Yeni Kanal", sessions: 5, users: 4 },
    ]);
    expect(traffic.pages).toEqual([{ path: "/", views: 200, users: 100 }]);
    expect(traffic.events).toHaveLength(Object.keys(SITE_EVENTS).length);
    expect(traffic.events.find((e) => e.name === "lead_submit")?.count).toBe(7);
    expect(traffic.events.find((e) => e.name === "tel_click")?.count).toBe(0);

    const [url, init] = fetchFn.mock.calls[1];
    expect(url).toBe("https://analyticsdata.googleapis.com/v1beta/properties/123456789:batchRunReports");
    expect(init.headers).toMatchObject({ authorization: "Bearer acc" });
    const body = JSON.parse(init.body);
    expect(body.requests).toHaveLength(4);
    expect(body.requests[0].dateRanges).toEqual([{ startDate: "2026-10-01", endDate: "2026-10-15" }]);
  });

  it("boş rapor sıfırlarla döner", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json({ access_token: "acc" }))
      .mockResolvedValueOnce(json({ reports: [{}, {}, {}, {}] }));
    const traffic = await fetchSiteTraffic(CFG, "2026-10-01", "2026-10-15", fetchFn);
    expect(traffic.totals).toEqual({ users: 0, sessions: 0, pageViews: 0 });
    expect(traffic.channels).toEqual([]);
    expect(traffic.events.every((e) => e.count === 0)).toBe(true);
  });

  it("bozuk tarihte istek atmaz", async () => {
    const fetchFn = vi.fn();
    await expect(fetchSiteTraffic(CFG, "2026-10-01' OR", "2026-10-15", fetchFn)).rejects.toThrow("Geçersiz tarih");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("403'te Ga4Error ve Türkçe açıklama", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json({ access_token: "acc" }))
      .mockResolvedValueOnce(json({ error: { message: "insufficient authentication scopes" } }, 403));
    const error = await fetchSiteTraffic(CFG, "2026-10-01", "2026-10-15", fetchFn).catch((e) => e);
    expect(error).toBeInstanceOf(Ga4Error);
    expect(describeGa4Error(error)).toContain("analytics.readonly");
  });

  it("refresh token geçersizse açıklama token yenilemeyi söyler", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(json({ error: "invalid_grant" }, 400));
    const error = await fetchSiteTraffic(CFG, "2026-10-01", "2026-10-15", fetchFn).catch((e) => e);
    expect(describeGa4Error(error)).toContain("refresh token");
  });
});
