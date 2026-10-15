import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readAdsConfig, type AdsConfig } from "@/lib/ads/config";
import {
  getAccessToken,
  searchStream,
  fetchCampaignSpend,
  ingestConversion,
  GoogleApiError,
} from "@/lib/ads/googleAds";

const FULL_ENV = {
  GOOGLE_ADS_DEVELOPER_TOKEN: "dev-token",
  GOOGLE_ADS_CLIENT_ID: "client-id",
  GOOGLE_ADS_CLIENT_SECRET: "client-secret",
  GOOGLE_ADS_REFRESH_TOKEN: "refresh",
  GOOGLE_ADS_CUSTOMER_ID: "123-456-7890",
  GOOGLE_ADS_LOGIN_CUSTOMER_ID: "",
  GOOGLE_ADS_CONVERSION_ACTION_RANDEVU: "111",
  GOOGLE_ADS_CONVERSION_ACTION_KAYIT: "222",
};

describe("readAdsConfig", () => {
  it("tüm değerler varsa yapılandırmayı tiresiz müşteri ID'siyle döner", () => {
    expect(readAdsConfig(FULL_ENV)).toEqual({
      developerToken: "dev-token",
      clientId: "client-id",
      clientSecret: "client-secret",
      refreshToken: "refresh",
      customerId: "1234567890",
      loginCustomerId: null,
      conversionActionIds: { randevu: "111", kayit: "222" },
    });
  });

  it("tek bir zorunlu değer eksikse null döner", () => {
    expect(readAdsConfig({ ...FULL_ENV, GOOGLE_ADS_REFRESH_TOKEN: "" })).toBeNull();
  });

  it("MCC ID'si verilirse tiresiz saklanır", () => {
    expect(readAdsConfig({ ...FULL_ENV, GOOGLE_ADS_LOGIN_CUSTOMER_ID: "999-888-7777" })?.loginCustomerId).toBe("9998887777");
  });

  it("developer token yoksa yapılandırma döner, developerToken null", () => {
    const cfg = readAdsConfig({ ...FULL_ENV, GOOGLE_ADS_DEVELOPER_TOKEN: "" });
    expect(cfg).not.toBeNull();
    expect(cfg?.developerToken).toBeNull();
    expect(cfg?.clientId).toBe("client-id");
    expect(cfg?.conversionActionIds).toEqual({ randevu: "111", kayit: "222" });
  });

  it("dönüşüm aksiyonu ID'si eksikse null döner", () => {
    expect(readAdsConfig({ ...FULL_ENV, GOOGLE_ADS_CONVERSION_ACTION_KAYIT: "" })).toBeNull();
  });
});

const CFG: AdsConfig = {
  developerToken: "dev-token",
  clientId: "cid",
  clientSecret: "csecret",
  refreshToken: "rtok",
  customerId: "1234567890",
  loginCustomerId: "9998887777",
  conversionActionIds: { randevu: "111", kayit: "222" },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// Ağ güvencesi: bu dosyadaki hiçbir test gerçek fetch'e düşmemeli. Enjekte edilmeyen her çağrı burada patlar.
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => {
    throw new Error("gerçek ağ çağrısı yasak");
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getAccessToken", () => {
  it("refresh token'ı form gövdesiyle değiştirir", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ access_token: "acc-1", expires_in: 3599 }));
    await expect(getAccessToken(CFG, fetchFn)).resolves.toBe("acc-1");
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(init.method).toBe("POST");
    const body = new URLSearchParams(init.body as string);
    expect(Object.fromEntries(body)).toEqual({
      client_id: "cid", client_secret: "csecret", refresh_token: "rtok", grant_type: "refresh_token",
    });
  });

  it("Google hata dönerse GoogleApiError fırlatır (token metne yazılmaz)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ error: "invalid_grant" }, 400));
    const err = await getAccessToken(CFG, fetchFn).catch((e) => e);
    expect(err).toBeInstanceOf(GoogleApiError);
    expect(err.status).toBe(400);
    expect(String(err.message)).not.toContain("rtok");
  });
});

describe("fetchCampaignSpend", () => {
  it("searchStream yanıtını SpendRow listesine çevirir, eksik metrikleri 0 sayar", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          results: [
            { campaign: { id: "555", name: "Beylikdüzü" }, metrics: { costMicros: "12500000", clicks: "7", impressions: "300" }, segments: { date: "2026-10-12" } },
            { campaign: { id: "556", name: "Kreş 2 yaş" }, metrics: {}, segments: { date: "2026-10-12" } },
          ],
          fieldMask: "segments.date,campaign.id,campaign.name,metrics.costMicros,metrics.clicks,metrics.impressions",
        },
      ]),
    );

    const rows = await fetchCampaignSpend(CFG, "acc", "2026-10-12", "2026-10-12", fetchFn);

    expect(rows).toEqual([
      { date: "2026-10-12", campaignId: "555", campaignName: "Beylikdüzü", costMicros: 12500000, clicks: 7, impressions: 300 },
      { date: "2026-10-12", campaignId: "556", campaignName: "Kreş 2 yaş", costMicros: 0, clicks: 0, impressions: 0 },
    ]);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://googleads.googleapis.com/v25/customers/1234567890/googleAds:searchStream");
    expect(init.headers).toMatchObject({
      authorization: "Bearer acc",
      "developer-token": "dev-token",
      "login-customer-id": "9998887777",
    });
    expect(JSON.parse(init.body).query).toContain("segments.date BETWEEN '2026-10-12' AND '2026-10-12'");
  });

  it("tarih biçimi bozuksa istek atmadan hata verir", async () => {
    const fetchFn = vi.fn();
    await expect(fetchCampaignSpend(CFG, "acc", "2026-10-12' OR 1=1", "2026-10-12", fetchFn)).rejects.toThrow("Geçersiz tarih");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("developer token yoksa istek atmadan 'developer token yok' hatası verir", async () => {
    const fetchFn = vi.fn();
    const cfg = { ...CFG, developerToken: null };
    await expect(fetchCampaignSpend(cfg, "acc", "2026-10-12", "2026-10-12", fetchFn)).rejects.toThrow("developer token yok");
    await expect(searchStream(cfg, "acc", "SELECT campaign.id FROM campaign", fetchFn)).rejects.toThrow("developer token yok");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("MCC ID'si yoksa login-customer-id başlığı gönderilmez", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse([{ results: [] }]));
    await searchStream({ ...CFG, loginCustomerId: null }, "acc", "SELECT campaign.id FROM campaign", fetchFn);
    const [, init] = fetchFn.mock.calls[0];
    expect(init.headers).not.toHaveProperty("login-customer-id");
  });
});

describe("ingestConversion", () => {
  const conv = {
    id: "u1", leadId: "lead-1", gclid: "GCLID-X", action: "kayit" as const,
    conversionAt: "2026-10-13T09:00:00Z", value: 19500, adUserData: "granted" as const,
  };

  it("Data Manager'a doğru hedef, transactionId ve değerle gönderir", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ requestId: "req-9" }));
    const result = await ingestConversion(CFG, "acc", conv, "2026-10-13T12:00:00+03:00", fetchFn);
    expect(result).toEqual({ ok: true, requestId: "req-9" });

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://datamanager.googleapis.com/v1/events:ingest");
    expect(init.headers).toMatchObject({ authorization: "Bearer acc" });
    expect(JSON.parse(init.body)).toEqual({
      destinations: [
        {
          operatingAccount: { accountType: "GOOGLE_ADS", accountId: "1234567890" },
          loginAccount: { accountType: "GOOGLE_ADS", accountId: "9998887777" },
          productDestinationId: "222",
        },
      ],
      consent: { adUserData: "CONSENT_GRANTED" },
      events: [
        {
          adIdentifiers: { gclid: "GCLID-X" },
          eventTimestamp: "2026-10-13T12:00:00+03:00",
          transactionId: "lead-1:kayit",
          eventSource: "WEB",
          conversionValue: 19500,
          currency: "TRY",
        },
      ],
      validateOnly: false,
    });
  });

  it("gövde yalnızca tanımlayıcı taşır; kullanıcı verisi, şifreleme veya e-posta/telefon göndermez", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ requestId: "req-11" }));
    await ingestConversion(CFG, "acc", conv, "2026-10-13T12:00:00+03:00", fetchFn);
    const raw = fetchFn.mock.calls[0][1].body as string;
    expect(raw).not.toMatch(/userData|phone|email|hashed|encoding/);
    expect(JSON.parse(raw).events[0]).not.toHaveProperty("userData");
  });

  it("onay bilinmiyorsa consent alanını göndermez, değer yoksa conversionValue göndermez", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ requestId: "req-10" }));
    await ingestConversion(CFG, "acc", { ...conv, action: "randevu", value: null, adUserData: null }, "2026-10-13T12:00:00+03:00", fetchFn);
    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body.consent).toBeUndefined();
    expect(body.events[0].conversionValue).toBeUndefined();
    expect(body.events[0].currency).toBeUndefined();
    expect(body.destinations[0].productDestinationId).toBe("111");
  });

  it("onay reddedilmişse (denied) asla granted olarak gönderilmez; consent alanı yok", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ requestId: "req-12" }));
    await ingestConversion(CFG, "acc", { ...conv, adUserData: "denied" }, "2026-10-13T12:00:00+03:00", fetchFn);
    const raw = fetchFn.mock.calls[0][1].body as string;
    expect(JSON.parse(raw).consent).toBeUndefined();
    expect(raw).not.toContain("CONSENT_GRANTED");
  });

  it("MCC ID'si yoksa loginAccount alanı tamamen atlanır", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ requestId: "req-13" }));
    await ingestConversion({ ...CFG, loginCustomerId: null }, "acc", conv, "2026-10-13T12:00:00+03:00", fetchFn);
    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body.destinations[0]).not.toHaveProperty("loginAccount");
    expect(body.destinations[0].operatingAccount).toEqual({ accountType: "GOOGLE_ADS", accountId: "1234567890" });
  });

  it("4xx yanıtında Google'ın mesajını 500 karakterle döner", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ error: { message: "x".repeat(800) } }, 400));
    const result = await ingestConversion(CFG, "acc", conv, "2026-10-13T12:00:00+03:00", fetchFn);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toHaveLength(500);
  });
});
