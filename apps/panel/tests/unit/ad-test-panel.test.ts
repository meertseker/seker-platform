import { describe, it, expect } from "vitest";
import type { AdTestView } from "@/lib/ads/ad-test-context";
import type { PreflightItem, PreflightKey } from "@/lib/ads/preflight";
import {
  canLaunch,
  checklistCount,
  existingLabel,
  fixHref,
  launchOptions,
  MSG_EXISTING,
  MSG_WRITE_OFF,
  reasonNeeded,
  showAdTestButton,
} from "@/lib/ads/ad-test-panel";

const KEYS: PreflightKey[] = ["onay", "yayin", "ad", "utm", "piksel", "butce", "metin", "bicim", "hesap"];

function items(red: Partial<Record<PreflightKey, string>> = {}): PreflightItem[] {
  return KEYS.map((key) =>
    red[key] ? { key, ok: false, label: red[key]!, fix: "Bekle" } : { key, ok: true, label: `${key} tamam`, fix: null },
  );
}

function view(over: Partial<AdTestView> = {}, red: Partial<Record<PreflightKey, string>> = {}): AdTestView {
  const list = items(red);
  return {
    contentId: "c1",
    code: "R-2644-A",
    kind: "reels",
    topic: "İlk gün uyumu",
    preview: { kind: "reels", caption: "İlk hafta", permalink: null },
    rows: [],
    checklist: { ok: list.every((x) => x.ok), items: list },
    blockText: list.find((x) => !x.ok)?.label ?? null,
    needs72hOverride: false,
    hoursLeft: null,
    gateRed: [],
    writeEnabled: true,
    existing: null,
    ...over,
  };
}

const none = { skip72h: false, reason: "" };
const goodReason = "Okul açılışı bu hafta";

describe("showAdTestButton", () => {
  const base = { id: "1", code: "R-1", kind: "reels" as const, stage: "organik", status: "onaylandi" };
  it("onaylı ve organik/test aşamasında görünür", () => {
    expect(showAdTestButton(base)).toBe(true);
    expect(showAdTestButton({ ...base, stage: "test" })).toBe(true);
  });
  it("onaysız, başka aşama ya da Google sayfasında görünmez", () => {
    expect(showAdTestButton({ ...base, status: "taslak" })).toBe(false);
    expect(showAdTestButton({ ...base, stage: "kazanan" })).toBe(false);
    expect(showAdTestButton({ ...base, kind: "sayfa", platform: "google" })).toBe(false);
    expect(showAdTestButton({ ...base, kind: "sayfa", platform: "instagram" })).toBe(true);
  });
});

describe("canLaunch", () => {
  it("hepsi yeşil ve bayrak açıkken açık", () => {
    expect(canLaunch(view(), none)).toEqual({ enabled: true, blockText: null });
  });
  it("kırmızı kontrolde kapalı, ilk kırmızıyı yazar", () => {
    const r = canLaunch(view({}, { yayin: "Sayfa henüz yayında değil: önce Sayfayı yayınla." }), none);
    expect(r).toEqual({ enabled: false, blockText: "Sayfa henüz yayında değil: önce Sayfayı yayınla." });
  });
  it("bayrak kapalıyken kapalı", () => {
    expect(canLaunch(view({ writeEnabled: false }), none)).toEqual({ enabled: false, blockText: MSG_WRITE_OFF });
  });
  it("kurulu reklam varsa kapalı", () => {
    expect(canLaunch(view({ existing: { adId: "120", review: null } }), none)).toEqual({ enabled: false, blockText: MSG_EXISTING });
  });
  it("tek kırmızı 72 saat: kutu + 10 karakter gerekçe açar", () => {
    const v = view({ needs72hOverride: true, hoursLeft: 20 }, { yayin: "72 saatten önce teste alınamaz · kalan 20 saat" });
    expect(canLaunch(v, none).enabled).toBe(false);
    expect(canLaunch(v, { skip72h: true, reason: "kısa" })).toEqual({
      enabled: false,
      blockText: "Devam etmek için nedenini yazın (en az 10 karakter).",
    });
    expect(canLaunch(v, { skip72h: true, reason: goodReason }).enabled).toBe(true);
  });
  it("72 saat dışında başka kırmızı varsa kutu açmaz", () => {
    const v = view({ needs72hOverride: true }, { yayin: "72 saat…", piksel: "Piksel kapalı" });
    expect(canLaunch(v, { skip72h: true, reason: goodReason }).enabled).toBe(false);
  });
  it("kapı kırmızıyken gerekçe ister", () => {
    const v = view({ gateRed: ["bu hafta: geç arama"] });
    expect(canLaunch(v, none).enabled).toBe(false);
    expect(canLaunch(v, { skip72h: false, reason: goodReason }).enabled).toBe(true);
  });
  it("sunucu needsReason döndüyse gerekçe ister", () => {
    expect(canLaunch(view(), none, true).enabled).toBe(false);
    expect(canLaunch(view(), { skip72h: false, reason: goodReason }, true).enabled).toBe(true);
  });
});

describe("reasonNeeded", () => {
  it("72 saat kutusu, kırmızı kapı ya da sunucu isteğiyle açılır", () => {
    expect(reasonNeeded(view(), none, false)).toBe(false);
    expect(reasonNeeded(view({ needs72hOverride: true }), { skip72h: true, reason: "" }, false)).toBe(true);
    expect(reasonNeeded(view({ needs72hOverride: true }), none, false)).toBe(false);
    expect(reasonNeeded(view({ gateRed: ["x"] }), none, false)).toBe(true);
    expect(reasonNeeded(view(), none, true)).toBe(true);
  });
});

describe("küçük yardımcılar", () => {
  it("fixHref yalnız Ayarlar düzeltmelerine bağlantı verir", () => {
    expect(fixHref("Ayarlar'a git")).toBe("/reklam/ayarlar");
    expect(fixHref("Kampanyaları kur")).toBe("/reklam/ayarlar");
    expect(fixHref("Mert'e haber verin")).toBeNull();
    expect(fixHref(null)).toBeNull();
  });
  it("checklistCount yeşil sayısını yazar", () => {
    expect(checklistCount(view().checklist)).toBe("9 / 9");
    expect(checklistCount(view({}, { piksel: "x", hesap: "y" }).checklist)).toBe("7 / 9");
  });
  it("existingLabel inceleme durumunu ekler", () => {
    expect(existingLabel({ adId: "1208", review: null })).toBe("Testte · reklam 1208");
    expect(existingLabel({ adId: "1208", review: "İncelemede" })).toBe("Testte · reklam 1208 · İncelemede");
  });
  it("launchOptions gerekçeyi kırpar, 72 saati yalnız kurarken gönderir", () => {
    const v = view({ needs72hOverride: true });
    expect(launchOptions("kur", v, { skip72h: true, reason: `  ${goodReason} ` }, "r1")).toEqual({
      mode: "kur",
      reason: goodReason,
      skip72h: true,
      recommendationId: "r1",
    });
    expect(launchOptions("goster", v, { skip72h: true, reason: "" })).toEqual({ mode: "goster" });
    expect(launchOptions("kur", view(), { skip72h: true, reason: "" })).toEqual({ mode: "kur" });
  });
});
