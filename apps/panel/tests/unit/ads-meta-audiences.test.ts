import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdSetup } from "@/lib/ads/ad-setup";
import { DEFAULT_AD_TEMPLATE, type AdTemplate } from "@/lib/ads/ad-template";
import type { MetaConfig } from "@/lib/ads/meta/config";
import type { AdChangeLogRow } from "@/lib/ads/writes";

const logs: (AdChangeLogRow & { id: string })[] = [];
const changeStore = {
  loadObject: vi.fn(async () => null),
  weekBudgetBaselineTl: vi.fn(async () => null),
  insertLog: vi.fn(async (row: AdChangeLogRow) => {
    const id = `log-${logs.length + 1}`;
    logs.push(structuredClone({ ...row, id }));
    return id;
  }),
  updateLog: vi.fn(
    async (id: string, patch: { status: AdChangeLogRow["status"]; error: string | null; newValue?: Record<string, unknown> }) => {
      const row = logs.find((l) => l.id === id);
      if (!row) return;
      row.status = patch.status;
      row.error = patch.error;
      if (patch.newValue) row.newValue = structuredClone(patch.newValue);
    },
  ),
  updateObject: vi.fn(),
  updateBudgetRows: vi.fn(),
  linkContent: vi.fn(),
};

const setupStore = {
  template: vi.fn(async (): Promise<AdTemplate> => FILLED),
  setup: vi.fn(async (): Promise<AdSetup | null> => SETUP),
  saveSetup: vi.fn(async (s: AdSetup) => {
    void s;
  }),
};

vi.mock("@/lib/ads/setup-store", () => ({ supabaseSetupStore: () => setupStore }));
vi.mock("@/lib/ads/writes", async (orig) => {
  const actual = await orig<typeof import("@/lib/ads/writes")>();
  return { ...actual, supabaseAdChangeStore: () => changeStore };
});

import { hashPhone } from "@/lib/ads/meta/capi";
import {
  createExclusionAudience,
  hashParentPhones,
  replaceAudienceUsers,
  updateAdsetExclusion,
} from "@/lib/ads/meta/audiences";
import { MetaApiError } from "@/lib/ads/meta/insights";
import { ref } from "@/lib/ads/meta/setup";
import { refreshExclusionAudience } from "@/lib/ads/audience-refresh";
import { planCampaignSetup } from "@/lib/ads/setup-plans";

const FILLED: AdTemplate = {
  ...DEFAULT_AD_TEMPLATE,
  okulAdres: "Bahçelievler Mah. 1. Sokak No 5, Ankara",
  lat: 39.92,
  lng: 32.85,
  updatedBy: "yon-1",
  updatedAt: "2026-10-20T09:00:00.000Z",
};

const SETUP: AdSetup = {
  testCampaignId: "101",
  testAdsetId: "102",
  scaleCampaignId: "103",
  scaleAdsetId: "104",
  exclusionAudienceId: null,
  createdAt: "2026-10-01T00:00:00Z",
  createdBy: "yon-1",
};

const CFG: MetaConfig = {
  accessToken: "EAAgizlianahtar",
  appSecret: "appsecret123",
  adAccountId: "act_42",
  pixelId: "777",
  testEventCode: null,
  capiEnabled: false,
};

const PHONE = "0532 555 41 20";
const PHONE_DIGITS = "5325554120";
const HEX64 = /[0-9a-f]{64}/;

function okJson(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

function errJson(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** students sorgusu: select → eq → order → range; filtreler kaydedilir. */
function fakeDb(phones: (string | null)[]) {
  const filters: Array<[string, unknown]> = [];
  const tables: string[] = [];
  const db = {
    from(table: string) {
      tables.push(table);
      const q = {
        select: () => q,
        eq: (c: string, v: unknown) => {
          filters.push([c, v]);
          return q;
        },
        order: () => q,
        range: async (f: number, t: number) => ({ data: phones.slice(f, t + 1).map((phone) => ({ phone })), error: null }),
      };
      return q;
    },
  };
  return { db: db as unknown as SupabaseClient, filters, tables };
}

function bodyOf(call: unknown[]): URLSearchParams {
  return new URLSearchParams(String((call[1] as RequestInit).body));
}

const fetchFn = vi.fn();
const NOW = new Date("2026-10-19T06:00:00Z"); // Pazartesi 09:00 İstanbul

beforeEach(() => {
  vi.clearAllMocks();
  logs.length = 0;
  setupStore.template.mockResolvedValue(FILLED);
  setupStore.setup.mockResolvedValue(SETUP);
  fetchFn.mockReset();
  fetchFn.mockRejectedValue(new Error("beklenmeyen istek"));
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("hashParentPhones", () => {
  it("0532 555 41 20 ve +90 532 555 4120 aynı hash'e iner ve tek kalır; 123 skipped", () => {
    const out = hashParentPhones([PHONE, "+90 532 555 4120", "123"]);
    expect(out.hashes).toEqual([hashPhone("+905325554120")]);
    expect(out.hashes[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(out.skipped).toBe(1);
  });

  it("boş ve sabit hat numarası skipped", () => {
    expect(hashParentPhones(["", "0312 555 41 20"])).toEqual({ hashes: [], skipped: 2 });
  });
});

describe("Meta kitle adımları", () => {
  it("createExclusionAudience yükü", () => {
    expect(createExclusionAudience("act_42", "audience")).toEqual({
      key: "audience",
      label: expect.any(String),
      path: "act_42/customaudiences",
      params: {
        name: "Mevcut veliler (panel)",
        subtype: "CUSTOM",
        customer_file_source: "USER_PROVIDED_ONLY",
        description: "Yazılı onaylı mevcut velilerin SHA-256 telefonları; dışlama için.",
      },
      result: "id",
    });
  });

  it("updateAdsetExclusion seti targeting ile günceller", () => {
    const targeting = { age_min: 25, excluded_custom_audiences: [{ id: "900" }] };
    expect(updateAdsetExclusion("102", targeting, "testAdsetExclusion")).toMatchObject({
      key: "testAdsetExclusion",
      path: "102",
      params: { targeting },
      result: "success",
    });
  });

  it("usersreplace gövdesi şema PHONE ve hash'ler; 10.001 telefon iki parti, ikincisinde last_batch_flag true", async () => {
    const hashes = Array.from({ length: 10_001 }, (_, i) => hashPhone(`+90532${String(i).padStart(7, "0")}`));
    fetchFn.mockImplementation(async (_url: string, init: RequestInit) => {
      const payload = JSON.parse(new URLSearchParams(String(init.body)).get("payload")!) as { data: unknown[] };
      return okJson({ session_id: 77, num_received: payload.data.length, num_invalid_entries: 0 });
    });
    const res = await replaceAudienceUsers(CFG, "900", hashes, 77, fetchFn);
    expect(res).toEqual({ received: 10_001, invalid: 0 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    for (const call of fetchFn.mock.calls) {
      expect(String(call[0])).toMatch(/\/v\d+\.\d+\/900\/usersreplace$/);
      expect(String(call[0])).not.toContain("EAAgizlianahtar");
      expect((call[1] as RequestInit).method).toBe("POST");
      expect(bodyOf(call).get("appsecret_proof")).toMatch(/^[0-9a-f]{64}$/);
    }
    const [b1, b2] = fetchFn.mock.calls.map(bodyOf);
    const p1 = JSON.parse(b1.get("payload")!);
    const p2 = JSON.parse(b2.get("payload")!);
    expect(p1.schema).toEqual(["PHONE"]);
    expect(p1.data).toHaveLength(10_000);
    expect(p1.data[0]).toEqual([hashes[0]]);
    expect(p2.data).toEqual([[hashes[10_000]]]);
    expect(JSON.parse(b1.get("session")!)).toEqual({
      session_id: 77,
      batch_seq: 1,
      last_batch_flag: false,
      estimated_num_total: 10_001,
    });
    expect(JSON.parse(b2.get("session")!)).toEqual({
      session_id: 77,
      batch_seq: 2,
      last_batch_flag: true,
      estimated_num_total: 10_001,
    });
  });

  it("şart kabul edilmemiş hatası Türkçe mesaja döner", async () => {
    fetchFn.mockResolvedValue(
      errJson(400, { error: { message: "Custom Audience terms not accepted", code: 200, error_subcode: 1870090 } }),
    );
    const err = await replaceAudienceUsers(CFG, "900", [hashPhone("+905325554120")], 1, fetchFn).catch((e) => e);
    expect(err).toBeInstanceOf(MetaApiError);
    expect((err as Error).message).toBe("Meta'da Özel Hedef Kitle şartları kabul edilmemiş · Mert kabul eder");
  });

  it("başka hata metnindeki hash ve anahtar silinir", async () => {
    const h = hashPhone("+905325554120");
    fetchFn.mockResolvedValue(errJson(400, { error: { message: `Invalid entry ${h} for EAAgizlianahtar`, code: 100 } }));
    const err = (await replaceAudienceUsers(CFG, "900", [h], 1, fetchFn).catch((e) => e)) as Error;
    expect(err).toBeInstanceOf(MetaApiError);
    expect(err.message).not.toMatch(HEX64);
    expect(err.message).not.toContain("EAAgizlianahtar");
  });
});

describe("planCampaignSetup · kitle", () => {
  it("kurulumda kitle açıksa adım sırası customaudiences, campaigns, adsets(excluded_custom_audiences=[{id:ref}]), …", () => {
    const p = planCampaignSetup({
      adAccountId: "act_42",
      pixelId: "777",
      template: FILLED,
      excludedAudienceId: null,
      createAudience: true,
    });
    expect(p.steps.map((s) => s.key)).toEqual(["audience", "testCampaign", "testAdset", "scaleCampaign", "scaleAdset"]);
    expect(p.steps.map((s) => String(s.path).replace("act_42/", ""))).toEqual([
      "customaudiences",
      "campaigns",
      "adsets",
      "campaigns",
      "adsets",
    ]);
    for (const s of [p.steps[2], p.steps[4]]) {
      expect((s.params.targeting as Record<string, unknown>).excluded_custom_audiences).toEqual([{ id: ref("audience") }]);
    }
    expect(p.summary.join("\n")).toContain("Mevcut veliler hariç");
  });

  it("kitle kapalıysa kitle adımı yok", () => {
    const p = planCampaignSetup({ adAccountId: "act_42", pixelId: "777", template: FILLED, excludedAudienceId: null });
    expect(p.steps.map((s) => s.key)).toEqual(["testCampaign", "testAdset", "scaleCampaign", "scaleAdset"]);
  });
});

describe("refreshExclusionAudience", () => {
  const env = (enabled: boolean) => ({
    ADS_WRITE_ENABLED: enabled ? "true" : "",
    META_ACCESS_TOKEN: CFG.accessToken,
    META_APP_SECRET: CFG.appSecret,
  });

  it("mevcutVelileriHaricTut false → istek yok, atlandi", async () => {
    setupStore.template.mockResolvedValue({ ...FILLED, mevcutVelileriHaricTut: false });
    const { db } = fakeDb([PHONE]);
    const res = await refreshExclusionAudience({ db, cfg: CFG, env: env(true), fetchFn, now: NOW });
    expect(res.status).toBe("atlandi");
    expect(res.count).toBe(0);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(changeStore.insertLog).not.toHaveBeenCalled();
  });

  it("kurulum yoksa atlandi", async () => {
    setupStore.setup.mockResolvedValue(null);
    const { db } = fakeDb([PHONE]);
    const res = await refreshExclusionAudience({ db, cfg: CFG, env: env(true), fetchFn, now: NOW });
    expect(res.status).toBe("atlandi");
    expect(fetchFn).not.toHaveBeenCalled();
    expect(changeStore.insertLog).not.toHaveBeenCalled();
  });

  it("şablonu kaydeden yoksa atlandi", async () => {
    setupStore.template.mockResolvedValue({ ...FILLED, updatedBy: null });
    const { db } = fakeDb([PHONE]);
    const res = await refreshExclusionAudience({ db, cfg: CFG, env: env(true), fetchFn, now: NOW });
    expect(res).toMatchObject({ status: "atlandi", count: 0 });
    expect(res.message).toContain("Şablonu kaydeden yok");
    expect(changeStore.insertLog).not.toHaveBeenCalled();
  });

  it("bayrak kapalı → kayıt uygulanmadi_kapali, POST yok", async () => {
    const { db, filters, tables } = fakeDb([PHONE, "+90 532 555 4120", "0533 111 22 33", "123", null]);
    const res = await refreshExclusionAudience({ db, cfg: CFG, env: env(false), fetchFn, now: NOW });
    expect(res).toMatchObject({ status: "uygulanmadi_kapali", count: 2 });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(setupStore.saveSetup).not.toHaveBeenCalled();
    expect(tables).toEqual(["students"]);
    expect(filters).toContainEqual(["status", "aktif"]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      platform: "meta",
      action: "kitle_guncelle",
      level: "audience",
      objectId: "kitle",
      source: "cron",
      status: "uygulanmadi_kapali",
      actorId: "yon-1",
      gateRed: false,
    });
    const nv = logs[0].newValue as Record<string, unknown>;
    expect(nv.count).toBe(2);
    expect(nv.skipped).toBe(1); // "123"; telefonu boş öğrenci sayılmaz
    expect(nv).not.toHaveProperty("steps");
  });

  it("bayrak açık, kitle yok: kitle kurulur, telefonlar yüklenir, iki set güncellenir, kurulum kimliği yazılır", async () => {
    const { db } = fakeDb([PHONE, "0533 111 22 33"]);
    fetchFn.mockImplementation(async (url: string) => {
      if (url.endsWith("/act_42/customaudiences")) return okJson({ id: "900" });
      if (url.endsWith("/900/usersreplace")) return okJson({ session_id: 1, num_received: 2, num_invalid_entries: 0 });
      return okJson({ success: true });
    });
    const res = await refreshExclusionAudience({ db, cfg: CFG, env: env(true), fetchFn, now: NOW });
    expect(res).toMatchObject({ status: "uygulandi", count: 2 });
    const urls = fetchFn.mock.calls.map((c) => String(c[0]).replace(/^.*\/v\d+\.\d+\//, ""));
    expect(urls).toEqual(["act_42/customaudiences", "900/usersreplace", "102", "104"]);
    for (const call of fetchFn.mock.calls.slice(2)) {
      const targeting = JSON.parse(bodyOf(call).get("targeting")!);
      expect(targeting.excluded_custom_audiences).toEqual([{ id: "900" }]);
      expect(targeting.geo_locations.custom_locations[0]).toMatchObject({ latitude: 39.92, longitude: 32.85, radius: 8 });
      expect(targeting.age_min).toBe(25);
    }
    expect(setupStore.saveSetup).toHaveBeenCalledWith({ ...SETUP, exclusionAudienceId: "900" });
    expect(logs[0]).toMatchObject({ action: "kitle_guncelle", status: "uygulandi", objectId: "kitle" });
    expect((logs[0].newValue as Record<string, unknown>).ids).toEqual({ audience: "900" });
  });

  it("bayrak açık, kitle var: yalnız usersreplace, kayıt kitle kimliğiyle", async () => {
    setupStore.setup.mockResolvedValue({ ...SETUP, exclusionAudienceId: "900" });
    const { db } = fakeDb([PHONE]);
    fetchFn.mockResolvedValue(okJson({ session_id: 1, num_received: 1, num_invalid_entries: 0 }));
    const res = await refreshExclusionAudience({ db, cfg: CFG, env: env(true), fetchFn, now: NOW });
    expect(res).toMatchObject({ status: "uygulandi", count: 1 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(String(fetchFn.mock.calls[0][0])).toMatch(/\/900\/usersreplace$/);
    expect(JSON.parse(bodyOf(fetchFn.mock.calls[0]).get("session")!).session_id).toBe(NOW.getTime());
    expect(setupStore.saveSetup).not.toHaveBeenCalled();
    expect(logs[0]).toMatchObject({ objectId: "900", status: "uygulandi" });
  });

  it("kayıtta telefon ve hash yok", async () => {
    const { db } = fakeDb([PHONE, "0533 111 22 33"]);
    fetchFn.mockImplementation(async (url: string) => {
      if (url.endsWith("/customaudiences")) return okJson({ id: "900" });
      if (url.endsWith("/usersreplace")) return okJson({ session_id: 1, num_received: 2, num_invalid_entries: 0 });
      return okJson({ success: true });
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await refreshExclusionAudience({ db, cfg: CFG, env: env(true), fetchFn, now: NOW });
    const all = JSON.stringify([
      changeStore.insertLog.mock.calls,
      changeStore.updateLog.mock.calls,
      res,
      vi.mocked(console.error).mock.calls,
      logSpy.mock.calls,
    ]);
    expect(all).not.toMatch(HEX64);
    expect(all).not.toContain(PHONE_DIGITS);
    expect(all).not.toContain("5331112233");
    expect(all).not.toContain("EAAgizlianahtar");
  });

  it("şart kabul edilmemişse hata, kayıt hata ve Türkçe mesaj, kurulum kimliği yazılmaz", async () => {
    const { db } = fakeDb([PHONE]);
    fetchFn.mockImplementation(async (url: string) => {
      if (url.endsWith("/customaudiences")) return okJson({ id: "900" });
      return errJson(400, { error: { message: "terms", code: 200, error_subcode: 1870090 } });
    });
    const res = await refreshExclusionAudience({ db, cfg: CFG, env: env(true), fetchFn, now: NOW });
    expect(res.status).toBe("hata");
    expect(res.message).toContain("Meta'da Özel Hedef Kitle şartları kabul edilmemiş · Mert kabul eder");
    expect(logs[0].status).toBe("hata");
    expect(setupStore.saveSetup).not.toHaveBeenCalled();
    // Setler güncellenmedi.
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("aktif öğrenci telefonu yoksa atlandi, istek yok", async () => {
    const { db } = fakeDb(["123", null]);
    const res = await refreshExclusionAudience({ db, cfg: CFG, env: env(true), fetchFn, now: NOW });
    expect(res).toMatchObject({ status: "atlandi", count: 0 });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(changeStore.insertLog).not.toHaveBeenCalled();
  });

  it("okuma hatası hata döner", async () => {
    setupStore.template.mockRejectedValue(new Error("db"));
    const { db } = fakeDb([PHONE]);
    const res = await refreshExclusionAudience({ db, cfg: CFG, env: env(true), fetchFn, now: NOW });
    expect(res.status).toBe("hata");
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
