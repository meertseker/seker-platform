import { describe, expect, it, vi } from "vitest";
import { checkConnections, type ConnectionRow } from "@/lib/ads/connections";

const NOW = new Date("2026-10-24T07:00:00Z");
const META = {
  META_ACCESS_TOKEN: "tok-secret",
  META_APP_SECRET: "sec",
  META_AD_ACCOUNT_ID: "42",
  META_INSTAGRAM_USER_ID: "17841400000000000",
  META_FACEBOOK_PAGE_ID: "1050000000000",
  META_PIXEL_ID: "999000",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

type Over = Partial<Record<"user" | "limit" | "page" | "account" | "pixel", unknown>>;
function fakeFetch(over: Over = {}) {
  return vi.fn(async (input: string | URL) => {
    const url = String(input);
    const pick = (k: keyof Over, def: unknown) => {
      const v = k in over ? over[k] : def;
      return v instanceof Response ? v : json(v);
    };
    if (url.includes("/content_publishing_limit")) return pick("limit", { data: [{ quota_usage: 3, config: { quota_total: 50 } }] });
    if (url.includes("/17841400000000000?")) return pick("user", { id: "17841400000000000", username: "sekeranaokulu" });
    if (url.includes("/1050000000000?")) return pick("page", { id: "1050000000000", name: "Şeker Anaokulu", instagram_business_account: { id: "17841400000000000" } });
    if (url.includes("/act_42?")) return pick("account", { id: "act_42", name: "Şeker", currency: "TRY", account_status: 1 });
    if (url.includes("/999000?")) return pick("pixel", { id: "999000", name: "Şeker piksel" });
    return json({ error: { message: "?", code: 1 } }, 500);
  });
}
const asFetch = (f: unknown) => f as typeof fetch;
const row = (rows: ConnectionRow[], key: string) => rows.find((r) => r.key === key)!;

describe("checkConnections", () => {
  it("Meta yapılandırması yokken istek gitmez, Meta satırları Kurulmadı", async () => {
    const f = fakeFetch();
    const snap = await checkConnections({ env: {}, fetchFn: asFetch(f), now: NOW });
    expect(f).not.toHaveBeenCalled();
    for (const k of ["instagram", "facebook", "reklam_hesabi", "piksel", "capi"]) expect(row(snap.rows, k).state).toBe("off");
    expect(row(snap.rows, "instagram")).toMatchObject({ detail: "Kurulmadı · META_INSTAGRAM_USER_ID", label: "Kurulmadı" });
    expect(snap.igReady).toBe(false);
    expect(snap.checkedAt).toBe(NOW.toISOString());
  });

  it("kullanıcı adı ve hak okunursa Instagram yeşil, detayda @ad ve kalan hak", async () => {
    const snap = await checkConnections({ env: META, fetchFn: asFetch(fakeFetch()), now: NOW });
    expect(row(snap.rows, "instagram")).toEqual({
      key: "instagram",
      title: "Instagram hesabı",
      detail: "@sekeranaokulu · içerik yayınlama izni · bugün kalan hak 47/50",
      state: "ok",
      label: "Bağlı",
    });
    expect(snap.igUsername).toBe("sekeranaokulu");
    expect(snap.publishLimit).toEqual({ used: 3, total: 50, remaining: 47 });
    expect(row(snap.rows, "facebook")).toMatchObject({ state: "ok", detail: "Şeker Anaokulu · Instagram'a bağlı" });
    expect(row(snap.rows, "reklam_hesabi")).toMatchObject({ state: "ok", detail: "act_42 · TRY", label: "Sağlıklı" });
    expect(row(snap.rows, "piksel")).toMatchObject({ state: "ok" });
    expect(snap.igReady).toBe(true);
  });

  it("hak okunamazsa (kod 10) İzin yok kırmızı", async () => {
    const f = fakeFetch({ limit: json({ error: { message: "perm", code: 10 } }, 403) });
    const snap = await checkConnections({ env: META, fetchFn: asFetch(f), now: NOW });
    expect(row(snap.rows, "instagram")).toMatchObject({
      state: "bad",
      label: "İzin yok",
      detail: "@sekeranaokulu · içerik yayınlama izni yok (instagram_content_publish)",
    });
    expect(snap.igReady).toBe(false);
    expect(snap.publishLimit).toBeNull();
  });

  it("sayfa başka Instagram hesabına bağlıysa kırmızı", async () => {
    const f = fakeFetch({ page: { id: "1050000000000", name: "Şeker Anaokulu", instagram_business_account: { id: "1" } } });
    const snap = await checkConnections({ env: META, fetchFn: asFetch(f), now: NOW });
    expect(row(snap.rows, "facebook")).toMatchObject({ state: "bad", detail: "Şeker Anaokulu · bu Instagram hesabına bağlı değil" });
    expect(snap.igReady).toBe(false);
  });

  it("reklam hesabı account_status 3 → Ödeme bekliyor kırmızı", async () => {
    const f = fakeFetch({ account: { id: "act_42", name: "Şeker", currency: "TRY", account_status: 3 } });
    const snap = await checkConnections({ env: META, fetchFn: asFetch(f), now: NOW });
    expect(row(snap.rows, "reklam_hesabi")).toMatchObject({ state: "bad", detail: "Durum: Ödeme bekliyor" });
  });

  it("her Meta çağrısı 500 dönerse fırlatmaz", async () => {
    const f = vi.fn(async () => json({ error: { message: "x", code: 1 } }, 500));
    const snap = await checkConnections({ env: META, fetchFn: asFetch(f), now: NOW });
    expect(row(snap.rows, "instagram").state).toBe("bad");
    expect(row(snap.rows, "facebook").state).toBe("bad");
    expect(row(snap.rows, "reklam_hesabi").state).toBe("bad");
    expect(row(snap.rows, "piksel")).toMatchObject({ state: "warn", detail: "Kimlik var, okunamadı" });
    expect(JSON.stringify(snap)).not.toContain("tok-secret");
  });

  it("fetch fırlatsa da checkConnections fırlatmaz", async () => {
    const f = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(checkConnections({ env: META, fetchFn: asFetch(f), now: NOW })).resolves.toBeTruthy();
  });

  it("IG_PUBLISH_ENABLED ve ADS_WRITE_ENABLED kapalıysa iki satır sarı; açıksa yeşil", async () => {
    const off = await checkConnections({ env: {}, now: NOW });
    expect(row(off.rows, "canli_yazim")).toMatchObject({ state: "warn", label: "Sadece göster" });
    expect(row(off.rows, "icerik_yayini")).toMatchObject({ state: "warn", label: "Kapalı", detail: "Yayınla kayda geçer, Instagram'a gitmez" });
    const on = await checkConnections({ env: { IG_PUBLISH_ENABLED: "true", ADS_WRITE_ENABLED: "true" }, now: NOW });
    expect(row(on.rows, "canli_yazim").state).toBe("ok");
    expect(row(on.rows, "icerik_yayini")).toMatchObject({ state: "ok", label: "Açık" });
  });

  it("CAPI ve Google satırları env'den", async () => {
    const snap = await checkConnections({ env: { ...META, META_CAPI_ENABLED: "true" }, fetchFn: asFetch(fakeFetch()), now: NOW });
    expect(row(snap.rows, "capi")).toMatchObject({ state: "ok", label: "Açık" });
    expect(row(snap.rows, "google").state).toBe("off");
  });
});
