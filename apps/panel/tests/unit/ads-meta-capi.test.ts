import { describe, it, expect, vi } from "vitest";
import { createHash } from "node:crypto";
import {
  buildCapiEvent,
  hashExternalId,
  hashPhone,
  META_EVENT_NAMES,
  metaEligibility,
  sendCapiBatch,
  uploadMetaPending,
} from "@/lib/ads/meta/capi";
import { appSecretProof, type MetaConfig } from "@/lib/ads/meta/config";
import type { MetaPendingEvent, MetaStore } from "@/lib/ads/store";
import type { UploadOutcome } from "@/lib/ads/types";

const NOW = new Date("2026-10-20T12:00:00Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const CFG: MetaConfig = {
  accessToken: "TOKEN-GIZLI-123",
  appSecret: "secret",
  adAccountId: "act_123",
  pixelId: "999",
  testEventCode: null,
  capiEnabled: true,
};

function sha(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function iso(msAgo: number): string {
  return new Date(NOW.getTime() - msAgo).toISOString();
}

function makeEvent(over: Partial<Omit<MetaPendingEvent, "lead">> = {}, lead: Partial<MetaPendingEvent["lead"]> = {}): MetaPendingEvent {
  return {
    id: "row-1",
    leadId: "LEAD-ABC",
    action: "lead",
    eventId: "ev-1",
    conversionAt: iso(HOUR),
    value: null,
    ...over,
    lead: {
      phone: "+905321234567",
      createdAt: iso(2 * HOUR),
      fbc: "fb.1.1700000000000.AbC",
      fbp: "fb.1.1700000000000.123",
      consentVersion: 2,
      adCookieConsent: true,
      consentAt: iso(2 * HOUR),
      adConsentRevokedAt: null,
      webPayload: { child_name: "Ali", child_birth_year: 2022, district: "Beylikdüzü" },
      landingPath: "/kayit",
      clientUserAgent: "Mozilla/5.0 (iPhone) Test",
      ...lead,
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function fakeStore(events: MetaPendingEvent[]) {
  const saved: UploadOutcome[] = [];
  const store: MetaStore = {
    upsertSpend: vi.fn(async () => {}),
    listPending: vi.fn(async (limit: number) => events.slice(0, limit)),
    saveOutcomes: vi.fn(async (outcomes: UploadOutcome[]) => {
      saved.push(...outcomes);
    }),
  };
  return { store, saved };
}

describe("META_EVENT_NAMES", () => {
  it("aşamaları Meta olay adlarına eşler", () => {
    expect(META_EVENT_NAMES).toEqual({ lead: "Lead", randevu: "Schedule", kayit: "Enrolled" });
  });
});

describe("metaEligibility (K9)", () => {
  it("uygun olay geçer", () => {
    expect(metaEligibility(makeEvent(), NOW)).toEqual({ ok: true });
  });

  it("v1 onaylı velinin olayı atlanır", () => {
    expect(metaEligibility(makeEvent({}, { consentVersion: 1 }), NOW)).toEqual({ ok: false, reason: "onay sürümü eski (Meta yok)" });
    expect(metaEligibility(makeEvent({ action: "randevu" }, { consentVersion: null }), NOW)).toEqual({
      ok: false,
      reason: "onay sürümü eski (Meta yok)",
    });
  });

  it("çerez onayı olmayan Lead atlanır ama Schedule gider", () => {
    expect(metaEligibility(makeEvent({}, { adCookieConsent: false }), NOW)).toEqual({ ok: false, reason: "çerez onayı yok" });
    expect(metaEligibility(makeEvent({}, { adCookieConsent: null }), NOW)).toEqual({ ok: false, reason: "çerez onayı yok" });
    expect(metaEligibility(makeEvent({ action: "randevu", eventId: "LEAD-ABC:schedule" }, { adCookieConsent: false }), NOW)).toEqual({
      ok: true,
    });
  });

  it("iptal edilmiş onay atlanır", () => {
    expect(metaEligibility(makeEvent({ action: "kayit" }, { adConsentRevokedAt: iso(HOUR) }), NOW)).toEqual({
      ok: false,
      reason: "reklam verisi onayı yok",
    });
  });

  it("içe aktarılmış veli (old_web_lead_id) atlanır", () => {
    expect(metaEligibility(makeEvent({}, { webPayload: { old_web_lead_id: "x" } }), NOW)).toEqual({
      ok: false,
      reason: "reklam verisi onayı yok",
    });
    expect(metaEligibility(makeEvent({ action: "randevu" }, { webPayload: { consent_scope: "arama" } }), NOW)).toEqual({
      ok: false,
      reason: "reklam verisi onayı yok",
    });
  });

  it("onay kaydı olmayan veli atlanır", () => {
    expect(metaEligibility(makeEvent({ action: "randevu" }, { consentAt: null }), NOW)).toEqual({
      ok: false,
      reason: "reklam verisi onayı yok",
    });
  });

  it("8 günlük olay atlanır", () => {
    expect(metaEligibility(makeEvent({ action: "randevu", conversionAt: iso(8 * DAY) }), NOW)).toEqual({
      ok: false,
      reason: "olay 7 günden eski",
    });
    // Lead için başvuru zamanı esas alınır.
    expect(metaEligibility(makeEvent({ conversionAt: iso(HOUR) }, { createdAt: iso(8 * DAY) }), NOW)).toEqual({
      ok: false,
      reason: "olay 7 günden eski",
    });
  });

  it("6 gün 20 saat sınırı güvenlik payıyla uygulanır", () => {
    expect(metaEligibility(makeEvent({ action: "randevu", conversionAt: iso(6 * DAY + 19 * HOUR) }), NOW).ok).toBe(true);
    expect(metaEligibility(makeEvent({ action: "randevu", conversionAt: iso(6 * DAY + 21 * HOUR) }), NOW)).toEqual({
      ok: false,
      reason: "olay 7 günden eski",
    });
  });
});

describe("hash", () => {
  it("telefon + atılmış rakamların SHA-256 hex'i", () => {
    expect(hashPhone("+905321234567")).toBe(sha("905321234567"));
    expect(hashPhone("+90 532 123 45 67")).toBe(sha("905321234567"));
  });

  it("external_id küçük harf lead id'nin SHA-256 hex'i", () => {
    expect(hashExternalId("LEAD-ABC")).toBe(sha("lead-abc"));
  });
});

describe("buildCapiEvent", () => {
  it("yükte çocuk verisi ve düz telefon yok", () => {
    for (const action of ["lead", "randevu", "kayit"] as const) {
      const payload = buildCapiEvent(makeEvent({ action, value: 45000 }), "https://x");
      const text = JSON.stringify(payload);
      expect(text).not.toContain("+90");
      expect(text).not.toContain("5321234567");
      expect(text).not.toContain("child");
      expect(text).not.toContain("birth");
      expect(text).not.toContain("district");
      expect(text).not.toContain("Ali");
      expect(text).not.toContain("Beylikdüzü");
      const userData = payload.user_data as { ph: string[]; external_id: string[] };
      expect(userData.ph[0]).toMatch(/^[0-9a-f]{64}$/);
      expect(userData.external_id[0]).toMatch(/^[0-9a-f]{64}$/);
      const keys = action === "lead" ? ["client_user_agent", "external_id", "fbc", "fbp", "ph"] : ["external_id", "fbc", "fbp", "ph"];
      expect(Object.keys(userData).sort()).toEqual(keys);
    }
  });

  it("Lead website kaynağı ve event_source_url taşır", () => {
    const payload = buildCapiEvent(makeEvent(), "https://x");
    expect(payload).toEqual({
      event_name: "Lead",
      event_time: Math.floor(new Date(iso(2 * HOUR)).getTime() / 1000),
      event_id: "ev-1",
      action_source: "website",
      event_source_url: "https://x/kayit",
      user_data: {
        ph: [sha("905321234567")],
        external_id: [sha("lead-abc")],
        fbc: "fb.1.1700000000000.AbC",
        fbp: "fb.1.1700000000000.123",
        client_user_agent: "Mozilla/5.0 (iPhone) Test",
      },
    });
    expect(payload).not.toHaveProperty("custom_data");
  });

  it("boş event_id yerine lead id ile kararlı kimlik kullanılır", () => {
    expect(buildCapiEvent(makeEvent({ eventId: "" }), "https://x").event_id).toBe("LEAD-ABC:lead");
  });

  it("Schedule system_generated", () => {
    const payload = buildCapiEvent(makeEvent({ action: "randevu", eventId: "LEAD-ABC:schedule" }), "https://x");
    expect(payload.event_name).toBe("Schedule");
    expect(payload.action_source).toBe("system_generated");
    expect(payload.event_id).toBe("LEAD-ABC:schedule");
    expect(payload.event_time).toBe(Math.floor(new Date(iso(HOUR)).getTime() / 1000));
    expect(payload).not.toHaveProperty("event_source_url");
    expect(payload.custom_data).toEqual({ event_source: "crm", lead_event_source: "Seker Panel" });
  });

  it("çerez onayı yokken Schedule yükünde fbc/fbp yok", () => {
    for (const adCookieConsent of [false, null]) {
      const payload = buildCapiEvent(makeEvent({ action: "randevu" }, { adCookieConsent }), "https://x");
      const userData = payload.user_data as Record<string, unknown>;
      expect(userData).not.toHaveProperty("fbc");
      expect(userData).not.toHaveProperty("fbp");
      expect(JSON.stringify(payload)).not.toContain("fb.1.");
    }
  });

  it("çerez onayı varken boş fbc/fbp eklenmez", () => {
    const payload = buildCapiEvent(makeEvent({ action: "randevu" }, { fbc: null, fbp: null }), "https://x");
    expect(Object.keys(payload.user_data as object).sort()).toEqual(["external_id", "ph"]);
  });

  it("Enrolled değer ve TRY taşır", () => {
    const payload = buildCapiEvent(makeEvent({ action: "kayit", eventId: "LEAD-ABC:enrolled", value: 45000 }), null);
    expect(payload.event_name).toBe("Enrolled");
    expect(payload.action_source).toBe("system_generated");
    expect(payload.custom_data).toEqual({ event_source: "crm", lead_event_source: "Seker Panel", value: 45000, currency: "TRY" });
  });

  it("değersiz Enrolled value/currency taşımaz", () => {
    for (const value of [null, 0]) {
      const payload = buildCapiEvent(makeEvent({ action: "kayit", value }), null);
      expect(payload.custom_data).toEqual({ event_source: "crm", lead_event_source: "Seker Panel" });
    }
  });
});

describe("sendCapiBatch", () => {
  it("piksel uç noktasına Bearer ve appsecret_proof ile gönderir, anahtar URL'de yok", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ events_received: 1, fbtrace_id: "t" }));
    const result = await sendCapiBatch({ ...CFG, testEventCode: "TEST123" }, [{ event_name: "Lead" }], fetchFn);
    expect(result).toEqual({ ok: true, received: 1 });
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://graph.facebook.com/v26.0/999/events");
    expect(parsed.searchParams.get("appsecret_proof")).toBe(appSecretProof(CFG.accessToken, CFG.appSecret));
    expect(url).not.toContain(CFG.accessToken);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${CFG.accessToken}`);
    expect(JSON.parse(String(init.body))).toEqual({ data: [{ event_name: "Lead" }], test_event_code: "TEST123" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("piksel yoksa istek atmaz", async () => {
    const fetchFn = vi.fn();
    const result = await sendCapiBatch({ ...CFG, pixelId: null }, [{ event_name: "Lead" }], fetchFn);
    expect(result.ok).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("hata mesajından anahtar silinir", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: { message: `Invalid token ${CFG.accessToken}`, code: 190 } }, 400));
    const result = await sendCapiBatch(CFG, [{ event_name: "Lead" }], fetchFn);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Invalid token");
    expect(result.error).not.toContain(CFG.accessToken);
  });

  it("ağ hatasında ok:false döner", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("ağ yok"));
    const result = await sendCapiBatch(CFG, [{ event_name: "Lead" }], fetchFn);
    expect(result).toEqual({ ok: false, error: expect.stringContaining("ağ yok") });
  });
});

describe("uploadMetaPending", () => {
  it("capiEnabled kapalıyken store hiç çağrılmaz", async () => {
    const { store } = fakeStore([makeEvent()]);
    const fetchFn = vi.fn();
    const result = await uploadMetaPending({ cfg: { ...CFG, capiEnabled: false }, store, siteUrl: "https://x", fetchFn, now: NOW });
    expect(result).toEqual({ sent: 0, failed: 0, skipped: 0 });
    expect(store.listPending).not.toHaveBeenCalled();
    expect(store.saveOutcomes).not.toHaveBeenCalled();
    expect(store.upsertSpend).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("toplu gönderim başarılıysa satırlar gonderildi, test kodu varsa gövdede", async () => {
    const events = [
      makeEvent({ id: "a" }),
      makeEvent({ id: "b", action: "randevu", eventId: "LEAD-ABC:schedule" }),
      makeEvent({ id: "c" }, { consentVersion: 1 }),
      makeEvent({ id: "d", action: "randevu", conversionAt: iso(8 * DAY) }),
    ];
    const { store, saved } = fakeStore(events);
    const fetchFn = vi.fn().mockImplementation(async () => jsonResponse({ events_received: 2 }));
    const result = await uploadMetaPending(
      { cfg: { ...CFG, testEventCode: "TEST123" }, store, siteUrl: "https://x", fetchFn, now: NOW },
      10,
    );
    expect(result).toEqual({ sent: 2, failed: 0, skipped: 2 });
    expect(store.listPending).toHaveBeenCalledWith(10);
    // Lead ve aşama olayları ayrı isteklerde gider (I-2).
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const bodies = fetchFn.mock.calls.map(
      (call) => JSON.parse(String((call as [string, RequestInit])[1].body)) as { data: { event_id: string }[]; test_event_code: string },
    );
    for (const body of bodies) expect(body.test_event_code).toBe("TEST123");
    expect(bodies.map((b) => b.data.map((e) => e.event_id))).toEqual([["ev-1"], ["LEAD-ABC:schedule"]]);
    expect(saved).toEqual(
      expect.arrayContaining([
        { id: "a", status: "gonderildi", error: null },
        { id: "b", status: "gonderildi", error: null },
        { id: "c", status: "atlandi", error: "onay sürümü eski (Meta yok)" },
        { id: "d", status: "atlandi", error: "olay 7 günden eski" },
      ]),
    );
    expect(saved).toHaveLength(4);
  });

  it("test kodu yoksa gövdede yok", async () => {
    const { store } = fakeStore([makeEvent()]);
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ events_received: 1 }));
    await uploadMetaPending({ cfg: CFG, store, siteUrl: "https://x", fetchFn, now: NOW });
    const body = JSON.parse(String((fetchFn.mock.calls[0] as [string, RequestInit])[1].body)) as Record<string, unknown>;
    expect(body).not.toHaveProperty("test_event_code");
  });

  it("Meta hata verirse satırlar hata olur ve mesaj kaydedilir", async () => {
    const { store, saved } = fakeStore([makeEvent({ id: "a" }), makeEvent({ id: "b", action: "kayit", value: 100 })]);
    const fetchFn = vi.fn().mockImplementation(async () => jsonResponse({ error: { message: "Invalid parameter", code: 100 } }, 400));
    const result = await uploadMetaPending({ cfg: CFG, store, siteUrl: "https://x", fetchFn, now: NOW });
    expect(result).toEqual({ sent: 0, failed: 2, skipped: 0 });
    expect(saved).toHaveLength(2);
    for (const outcome of saved) {
      expect(outcome.status).toBe("hata");
      expect(outcome.error).toContain("Invalid parameter");
    }
  });

  it("hiç uygun olay yoksa istek atılmaz", async () => {
    const { store, saved } = fakeStore([makeEvent({ id: "a" }, { adCookieConsent: false })]);
    const fetchFn = vi.fn();
    const result = await uploadMetaPending({ cfg: CFG, store, siteUrl: "https://x", fetchFn, now: NOW });
    expect(result).toEqual({ sent: 0, failed: 0, skipped: 1 });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(saved).toEqual([{ id: "a", status: "atlandi", error: "çerez onayı yok" }]);
  });

  it("site adresi yoksa Lead atlanır, Schedule gider", async () => {
    const { store, saved } = fakeStore([makeEvent({ id: "a" }), makeEvent({ id: "b", action: "randevu" })]);
    const fetchFn = vi.fn().mockImplementation(async () => jsonResponse({ events_received: 1 }));
    const result = await uploadMetaPending({ cfg: CFG, store, siteUrl: null, fetchFn, now: NOW });
    expect(result).toEqual({ sent: 1, failed: 0, skipped: 1 });
    expect(saved).toEqual(
      expect.arrayContaining([
        { id: "a", status: "atlandi", error: "site adresi yok" },
        { id: "b", status: "gonderildi", error: null },
      ]),
    );
  });

  it("tarayıcı bilgisi olmayan Lead atlanır, aşama olayı gider (I-2)", async () => {
    const { store, saved } = fakeStore([
      makeEvent({ id: "a" }, { clientUserAgent: null }),
      makeEvent({ id: "b" }, { clientUserAgent: "   " }),
      makeEvent({ id: "c", action: "randevu" }, { clientUserAgent: null }),
    ]);
    const fetchFn = vi.fn().mockImplementation(async () => jsonResponse({ events_received: 1 }));
    const result = await uploadMetaPending({ cfg: CFG, store, siteUrl: "https://x", fetchFn, now: NOW });
    expect(result).toEqual({ sent: 1, failed: 0, skipped: 2 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(saved).toEqual(
      expect.arrayContaining([
        { id: "a", status: "atlandi", error: "tarayıcı bilgisi yok" },
        { id: "b", status: "atlandi", error: "tarayıcı bilgisi yok" },
        { id: "c", status: "gonderildi", error: null },
      ]),
    );
  });

  it("bozuk Lead isteği aşama olaylarını düşürmez: ayrı istek, ayrı sonuç (I-2)", async () => {
    const { store, saved } = fakeStore([
      makeEvent({ id: "a" }),
      makeEvent({ id: "b", action: "randevu", eventId: "LEAD-ABC:schedule" }),
      makeEvent({ id: "c", action: "kayit", eventId: "LEAD-ABC:enrolled", value: 100 }),
    ]);
    const fetchFn = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { data: { event_name: string }[] };
      return body.data.some((e) => e.event_name === "Lead")
        ? jsonResponse({ error: { message: "Invalid parameter", code: 100 } }, 400)
        : jsonResponse({ events_received: body.data.length });
    });
    const result = await uploadMetaPending({ cfg: CFG, store, siteUrl: "https://x", fetchFn, now: NOW });
    expect(result).toEqual({ sent: 2, failed: 1, skipped: 0 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(saved).toEqual(
      expect.arrayContaining([
        { id: "a", status: "hata", error: expect.stringContaining("Invalid parameter") },
        { id: "b", status: "gonderildi", error: null },
        { id: "c", status: "gonderildi", error: null },
      ]),
    );
  });
});

describe("buildCapiEvent client_user_agent (I-2)", () => {
  it("Lead'de çerez onayı varsa hash'lenmeden eklenir", () => {
    const payload = buildCapiEvent(makeEvent({}, { clientUserAgent: "UA/1.0" }), "https://x");
    expect((payload.user_data as Record<string, unknown>).client_user_agent).toBe("UA/1.0");
  });

  it("çerez onayı yoksa ya da aşama olayıysa eklenmez", () => {
    for (const ev of [
      makeEvent({}, { adCookieConsent: false }),
      makeEvent({}, { adCookieConsent: null }),
      makeEvent({ action: "randevu" }),
      makeEvent({ action: "kayit" }),
    ]) {
      expect(buildCapiEvent(ev, "https://x").user_data).not.toHaveProperty("client_user_agent");
    }
  });
});

describe("uploadMetaPending hata ayrımı (C-2)", () => {
  type Reply = Response | Error;
  /** Her olay kimliği için yanıt üretir; toplu istekte herhangi biri kötüyse toplu yanıt `batch` olur. */
  function fetchBy(batch: () => Reply, single: (eventId: string) => Reply) {
    return vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { data: { event_id: string }[] };
      const reply = body.data.length > 1 ? batch() : single(body.data[0].event_id);
      if (reply instanceof Error) throw reply;
      return reply;
    });
  }
  const ok = () => jsonResponse({ events_received: 1 });
  const bad = () => jsonResponse({ error: { message: "Invalid fbc", code: 100 } }, 400);

  const stages = () => [
    makeEvent({ id: "a", action: "randevu", eventId: "A:schedule" }),
    makeEvent({ id: "b", action: "randevu", eventId: "B:schedule" }),
    makeEvent({ id: "c", action: "kayit", eventId: "C:enrolled", value: 10 }),
  ];

  it("toplu 4xx'te olaylar tek tek denenir; yalnız bozuk olan hata olur", async () => {
    const { store, saved } = fakeStore(stages());
    const fetchFn = fetchBy(bad, (id) => (id === "B:schedule" ? bad() : ok()));
    const result = await uploadMetaPending({ cfg: CFG, store, siteUrl: "https://x", fetchFn, now: NOW });
    expect(fetchFn).toHaveBeenCalledTimes(4);
    expect(result).toEqual({ sent: 2, failed: 1, skipped: 0 });
    expect(saved).toEqual(
      expect.arrayContaining([
        { id: "a", status: "gonderildi", error: null },
        { id: "b", status: "hata", error: expect.stringContaining("Invalid fbc") },
        { id: "c", status: "gonderildi", error: null },
      ]),
    );
    expect(saved).toHaveLength(3);
  });

  it.each([
    ["ağ hatası", () => new Error("ECONNRESET")],
    ["HTTP 500", () => jsonResponse({ error: { message: "Service down" } }, 500)],
    ["HTTP 503", () => new Response("bakım", { status: 503 })],
    ["HTTP 429", () => jsonResponse({ error: { message: "Too many calls" } }, 429)],
  ])("geçici hata (%s) satırları bekliyor bırakır, hata metni yazılır, tek tek denenmez", async (_name, reply) => {
    const { store, saved } = fakeStore(stages());
    const fetchFn = fetchBy(reply as () => Reply, () => ok());
    const result = await uploadMetaPending({ cfg: CFG, store, siteUrl: "https://x", fetchFn, now: NOW });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ sent: 0, failed: 3, skipped: 0 });
    expect(saved).toHaveLength(3);
    for (const outcome of saved) {
      expect(outcome.status).toBe("bekliyor");
      expect(outcome.error).toMatch(/^Meta CAPI isteği başarısız: /);
    }
  });

  it("tek tek denemede geçici hata alan olay bekliyor kalır", async () => {
    const { store, saved } = fakeStore(stages());
    const fetchFn = fetchBy(bad, (id) => (id === "A:schedule" ? new Error("timeout") : id === "B:schedule" ? bad() : ok()));
    const result = await uploadMetaPending({ cfg: CFG, store, siteUrl: "https://x", fetchFn, now: NOW });
    expect(result).toEqual({ sent: 1, failed: 2, skipped: 0 });
    expect(saved).toEqual(
      expect.arrayContaining([
        { id: "a", status: "bekliyor", error: expect.stringContaining("timeout") },
        { id: "b", status: "hata", error: expect.stringContaining("Invalid fbc") },
        { id: "c", status: "gonderildi", error: null },
      ]),
    );
  });

  it("tek olaylık grupta 4xx doğrudan hata olur (yeniden denenmez)", async () => {
    const { store, saved } = fakeStore([makeEvent({ id: "a", action: "randevu" })]);
    const fetchFn = fetchBy(bad, () => bad());
    await uploadMetaPending({ cfg: CFG, store, siteUrl: "https://x", fetchFn, now: NOW });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(saved).toEqual([{ id: "a", status: "hata", error: expect.stringContaining("Invalid fbc") }]);
  });
});
