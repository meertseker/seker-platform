import { describe, it, expect, vi } from "vitest";
import { syncSpend, uploadPending, toIstanbulOffsetTimestamp, istanbulDaysAgo } from "@/lib/ads/sync";
import type { AdsStore, PendingConversion, SpendRow, UploadOutcome } from "@/lib/ads/types";
import type { AdsConfig } from "@/lib/ads/config";

const CFG: AdsConfig = {
  developerToken: "d", clientId: "c", clientSecret: "s", refreshToken: "r",
  customerId: "1234567890", loginCustomerId: null, conversionActionIds: { randevu: "111", kayit: "222" },
};

function fakeStore(pending: PendingConversion[] = []) {
  const spend: SpendRow[] = [];
  const outcomes: UploadOutcome[] = [];
  const store: AdsStore = {
    upsertSpend: async (rows) => { spend.push(...rows); },
    listPending: async (limit) => pending.slice(0, limit),
    saveOutcomes: async (o) => { outcomes.push(...o); },
  };
  return { store, spend, outcomes };
}

function pending(overrides: Partial<PendingConversion>): PendingConversion {
  return {
    id: "u1", leadId: "lead-1", gclid: "G1", action: "randevu",
    conversionAt: "2026-10-13T09:00:00Z", clickAt: new Date(Date.now() - 3600_000).toISOString(), value: null, adUserData: null, ...overrides,
  };
}

const ok = () => new Response(JSON.stringify({ requestId: "r" }), { status: 200 });
const bad = (msg: string) => new Response(JSON.stringify({ error: { message: msg } }), { status: 400 });

describe("toIstanbulOffsetTimestamp", () => {
  it("UTC zamanı +03:00 ofsetli yerel zamana çevirir", () => {
    expect(toIstanbulOffsetTimestamp("2026-10-13T21:30:05Z")).toBe("2026-10-14T00:30:05+03:00");
  });
});

describe("istanbulDaysAgo", () => {
  it("İstanbul takvimine göre geriye sayar", () => {
    expect(istanbulDaysAgo(1, new Date("2026-10-13T22:30:00Z"))).toBe("2026-10-13");
    expect(istanbulDaysAgo(3, new Date("2026-10-14T06:00:00+03:00"))).toBe("2026-10-11");
  });
});

describe("syncSpend", () => {
  it("çekilen satırları store'a yazar ve sayısını döner", async () => {
    const { store, spend } = fakeStore();
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ results: [{ campaign: { id: "1", name: "A" }, metrics: { costMicros: "10" }, segments: { date: "2026-10-12" } }] }]), { status: 200 }),
    );
    await expect(syncSpend({ cfg: CFG, token: "t", store, fetchFn }, "2026-10-12", "2026-10-12")).resolves.toBe(1);
    expect(spend).toEqual([{ date: "2026-10-12", campaignId: "1", campaignName: "A", costMicros: 10, clicks: 0, impressions: 0 }]);
  });
});

describe("uploadPending", () => {
  it("başarılıları gönderildi, hatalıyı hata yapar; bir hata diğerini engellemez", async () => {
    const { store, outcomes } = fakeStore([
      pending({ id: "u1", gclid: "G1" }),
      pending({ id: "u2", gclid: "BAD", leadId: "lead-2" }),
      pending({ id: "u3", gclid: "G3", leadId: "lead-3" }),
    ]);
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(bad("Invalid gclid"))
      .mockResolvedValueOnce(ok());

    const result = await uploadPending({ cfg: CFG, token: "t", store, fetchFn });

    expect(result).toEqual({ sent: 2, failed: 1, skipped: 0 });
    expect(outcomes).toEqual([
      { id: "u1", status: "gonderildi", error: "requestId: r" },
      { id: "u2", status: "hata", error: "Invalid gclid" },
      { id: "u3", status: "gonderildi", error: "requestId: r" },
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("reklam verisi onayı reddedilmişse göndermeden atlar", async () => {
    const { store, outcomes } = fakeStore([pending({ adUserData: "denied" })]);
    const fetchFn = vi.fn();
    const result = await uploadPending({ cfg: CFG, token: "t", store, fetchFn });
    expect(result).toEqual({ sent: 0, failed: 0, skipped: 1 });
    expect(outcomes).toEqual([{ id: "u1", status: "atlandi", error: "reklam verisi onayı yok" }]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("olay zamanını İstanbul ofsetiyle gönderir ve transactionId kullanır", async () => {
    const { store } = fakeStore([pending({ conversionAt: "2026-10-13T09:00:00Z" })]);
    const fetchFn = vi.fn().mockResolvedValue(ok());
    await uploadPending({ cfg: CFG, token: "t", store, fetchFn });
    const event = JSON.parse(fetchFn.mock.calls[0][1].body).events[0];
    expect(event.eventTimestamp).toBe("2026-10-13T12:00:00+03:00");
    expect(event.transactionId).toBe("lead-1:randevu");
  });

  it("ağ hatası (fetch reddi) o satırı hata yapar, döngü devam eder", async () => {
    const { store, outcomes } = fakeStore([pending({ id: "u1" }), pending({ id: "u2", leadId: "lead-2" })]);
    const fetchFn = vi.fn().mockRejectedValueOnce(new Error("ECONNRESET")).mockResolvedValueOnce(ok());
    const result = await uploadPending({ cfg: CFG, token: "t", store, fetchFn });
    expect(result).toEqual({ sent: 1, failed: 1, skipped: 0 });
    expect(outcomes[0].id).toBe("u1");
    expect(outcomes[0].status).toBe("hata");
    expect(outcomes[0].error).toContain("başarısız");
  });
});

describe("uploadPending - tıklama yaşı ve onay", () => {
  const DAY = 86400000;
  it("tıklama 89 günden eskiyse ağa gitmeden atlar", async () => {
    const { store, outcomes } = fakeStore([pending({ clickAt: new Date(Date.now() - 90 * DAY).toISOString() })]);
    const fetchFn = vi.fn();
    const result = await uploadPending({ cfg: CFG, token: "t", store, fetchFn });
    expect(result).toEqual({ sent: 0, failed: 0, skipped: 1 });
    expect(outcomes).toEqual([{ id: "u1", status: "atlandi", error: "tıklama 90 günden eski" }]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("yaş conversionAt'e değil clickAt'e bakar", async () => {
    const { store } = fakeStore([pending({
      conversionAt: new Date(Date.now() - 1 * DAY).toISOString(),
      clickAt: new Date(Date.now() - 100 * DAY).toISOString(),
    })]);
    const fetchFn = vi.fn();
    const result = await uploadPending({ cfg: CFG, token: "t", store, fetchFn });
    expect(result.skipped).toBe(1);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("88 günlük tıklama gönderilir", async () => {
    const { store } = fakeStore([pending({ clickAt: new Date(Date.now() - 88 * DAY).toISOString() })]);
    const fetchFn = vi.fn().mockResolvedValue(ok());
    expect((await uploadPending({ cfg: CFG, token: "t", store, fetchFn })).sent).toBe(1);
  });

  it("onay yalnızca granted iken gövdeye girer; null'da girmez", async () => {
    const { store } = fakeStore([
      pending({ id: "a", adUserData: "granted" }),
      pending({ id: "b", leadId: "l2", adUserData: null }),
    ]);
    const fetchFn = vi.fn().mockResolvedValue(ok());
    await uploadPending({ cfg: CFG, token: "t", store, fetchFn });
    expect(JSON.parse(fetchFn.mock.calls[0][1].body).consent).toEqual({ adUserData: "CONSENT_GRANTED" });
    expect(JSON.parse(fetchFn.mock.calls[1][1].body).consent).toBeUndefined();
  });

  it("değer TL olarak olduğu gibi gider", async () => {
    const { store } = fakeStore([pending({ action: "kayit", value: 12500.5 })]);
    const fetchFn = vi.fn().mockResolvedValue(ok());
    await uploadPending({ cfg: CFG, token: "t", store, fetchFn });
    const event = JSON.parse(fetchFn.mock.calls[0][1].body).events[0];
    expect(event.conversionValue).toBe(12500.5);
    expect(event.currency).toBe("TRY");
  });

  it("fetch dışında fırlatan bir hata (store dışı) satırı hata yapar, döngü sürer", async () => {
    const { store, outcomes } = fakeStore([pending({ id: "u1" }), pending({ id: "u2", leadId: "l2" })]);
    const fetchFn = vi.fn().mockImplementationOnce(() => { throw new Error("boom"); }).mockResolvedValueOnce(ok());
    const result = await uploadPending({ cfg: CFG, token: "t", store, fetchFn });
    expect(result).toEqual({ sent: 1, failed: 1, skipped: 0 });
    expect(outcomes.map((o) => o.id)).toEqual(["u1", "u2"]);
  });
});
