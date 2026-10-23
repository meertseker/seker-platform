import { describe, it, expect } from "vitest";
import type { LandingFields } from "@seker/shared/landing";
import { pageFieldChecks, pagePublishBlockers, type FieldCheck } from "@/lib/pages/preflight";
import { DEFAULT_BANNED_PHRASES } from "@/lib/content/checks";

const OPTS = { banned: DEFAULT_BANNED_PHRASES, pageTitleMax: 30 };
const CLEAN: LandingFields = {
  h1: "İlk hafta uyum nasıl geçer",
  subhead: "Uyum haftasında neler yaptığımızı anlatıyoruz",
  bodyBlocks: [
    { heading: "Sabah", text: "Kapıda karşılıyoruz" },
    { heading: "Öğle", text: "Birlikte yemek yiyoruz" },
  ],
  mediaKey: "gardenWide",
  adPrimaryText: "Uyum haftası nasıl geçer, anlattık",
  adHeadline: "İlk hafta uyum",
  metaTitle: "İlk hafta uyum nasıl geçer",
  metaDescription: "Uyum haftası",
};

type BlockerInput = Parameters<typeof pagePublishBlockers>[0];
const blockers = (fields: LandingFields, over: Partial<BlockerInput> = {}) =>
  pagePublishBlockers({
    kind: "sayfa",
    status: "onaylandi",
    slug: "ilk-hafta-uyum",
    current: null,
    slugTaken: false,
    fieldChecks: pageFieldChecks(fields, OPTS),
    ...over,
  });

describe("pageFieldChecks", () => {
  it("sırayla Z3 satırları", () => {
    const checks = pageFieldChecks(CLEAN, OPTS);
    expect(checks.map((c) => c.label)).toEqual([
      "Başlık",
      "Alt başlık",
      "Bloklar",
      "Reklam cümlesi",
      "Reklam başlığı",
      "Görsel",
      "Yasaklı ifade",
      "Form, çerez bandı, ölçüm kodları",
    ]);
    expect(checks.every((c) => c.ok)).toBe(true);
    const by = Object.fromEntries(checks.map((c) => [c.label, c])) as Record<string, FieldCheck>;
    expect(by["Başlık"].count).toBe(`${CLEAN.h1.length} / 30`);
    expect(by["Başlık"].summary).toBe(CLEAN.h1);
    expect(by["Bloklar"].summary).toBe("2 blok");
    expect(by["Görsel"].summary).toBe("Bahçe, geniş açı");
    expect(by["Yasaklı ifade"].summary).toBe("yok");
    expect(by["Form, çerez bandı, ölçüm kodları"].summary).toBe("şablondan hazır");
    expect(by["Reklam cümlesi"].count).toBe(`${CLEAN.adPrimaryText.length} / 125`);
    expect(by["Reklam başlığı"].count).toBe(`${CLEAN.adHeadline.length} / 40`);
  });

  it("boş reklam alanları geçer ama not düşer", () => {
    const checks = pageFieldChecks({ ...CLEAN, adPrimaryText: "", adHeadline: "" }, OPTS);
    const ad = checks.filter((c) => c.label.startsWith("Reklam"));
    expect(ad.every((c) => c.ok)).toBe(true);
    expect(ad.map((c) => c.message)).toEqual(["Boş · Instagram reklamı için gerekir", "Boş · Instagram reklamı için gerekir"]);
  });

  it("bloktaki yasaklı ifade yakalanır", () => {
    const checks = pageFieldChecks({ ...CLEAN, bodyBlocks: [{ heading: "Sabah", text: "Garanti uyum" }] }, OPTS);
    const b = checks.find((c) => c.label === "Bloklar")!;
    expect(b.ok).toBe(false);
    expect(b.message).toBe('"garanti" kanıt ister, kullanılamaz');
    expect(checks.find((c) => c.label === "Yasaklı ifade")!.ok).toBe(false);
  });
});

describe("pagePublishBlockers", () => {
  it("temiz girdi → []", () => {
    expect(blockers(CLEAN)).toEqual([]);
  });
  it("31 karakterlik başlık", () => {
    expect(blockers({ ...CLEAN, h1: "a".repeat(31) })).toContain("Başlık: 30 karakteri aştı");
  });
  it("126 karakterlik reklam cümlesi", () => {
    expect(blockers({ ...CLEAN, adPrimaryText: "a".repeat(126) })).toContain("Reklam cümlesi: 125 karakteri aştı");
  });
  it("yasaklı reklam başlığı", () => {
    expect(blockers({ ...CLEAN, adHeadline: "En iyi okul" })).toContain('Reklam başlığı: "en iyi" kanıt ister, kullanılamaz');
  });
  it("görsel yok yayını engellemez; uyarı olarak görünür", () => {
    expect(blockers({ ...CLEAN, mediaKey: null })).toEqual([]);
    const g = pageFieldChecks({ ...CLEAN, mediaKey: null }, OPTS).find((c) => c.label === "Görsel")!;
    expect(g).toEqual({
      label: "Görsel",
      summary: "",
      count: null,
      ok: true,
      message: "Seçilmedi · varsayılan fotoğraf kullanılır",
    });
  });
  it("sayfa olmayan içerik", () => {
    expect(blockers(CLEAN, { kind: "reels" })).toContain("Bu içerik sayfa değil");
  });
  it("onaysız içerik", () => {
    expect(blockers(CLEAN, { status: "teslim" })).toContain("Önce içerik onaylanmalı");
  });
  it("geçersiz ve ayrılmış slug", () => {
    expect(blockers(CLEAN, { slug: "AB" })).toContain("Adres 3–60 karakter olmalı; yalnız küçük harf, rakam ve tire");
    expect(blockers(CLEAN, { slug: "onizleme" })).toContain("Bu adres sitede zaten var");
  });
  it("yayından sonra adres değişmez", () => {
    const published = { slug: "ilk-hafta-uyum", publishedAt: "2026-10-20T08:00:00Z" };
    expect(blockers(CLEAN, { slug: "baska", current: published })).toContain("Yayından sonra adres değişmez");
    expect(blockers(CLEAN, { current: published })).toEqual([]);
    expect(blockers(CLEAN, { slug: "baska", current: { slug: null, publishedAt: null } })).toEqual([]);
  });
  it("alınmış slug", () => {
    expect(blockers(CLEAN, { slugTaken: true })).toContain("Bu adres başka bir sayfada kullanılıyor");
  });
});
