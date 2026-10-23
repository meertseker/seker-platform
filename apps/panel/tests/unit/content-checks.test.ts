import { describe, it, expect } from "vitest";
import { checkText, submissionBlockers } from "@/lib/content/checks";
import { STAGES, nextStageAfterApproval } from "@/lib/content/stages";
import { PAGE_AD_FIELDS, contentBlockers, isPageFieldKey } from "@/lib/content/store";

const opts = { max: 150, min: 10, banned: ["en iyi", "bir numara", "en güvenli", "garanti"] };

describe("checkText", () => {
  it("yasaklı ifadeyi yakalar", () => {
    expect(checkText("En iyi okul", opts)).toEqual({
      ok: false,
      message: '"en iyi" kanıt ister, kullanılamaz',
    });
  });
  it("Türkçe büyük İ ile yakalar", () => {
    expect(checkText("İŞTE EN İYİ", opts).ok).toBe(false);
  });
  it("kelime ortasındaki eşleşme yasaklanmaz", () => {
    expect(checkText("Ben iyiyim bugün", opts).ok).toBe(true);
    expect(checkText("Sınıf düzen iyi gitti", opts).ok).toBe(true);
  });
  it("ek alan ifade yine yakalanır", () => {
    expect(checkText("Garantili sonuç var", opts).ok).toBe(false);
  });
  it("ASCII yazılmış EN IYI yakalanır", () => {
    expect(checkText("EN IYI okul", opts).ok).toBe(false);
  });
  it("fazla boşluk ve NBSP yakalanır", () => {
    expect(checkText("en  iyi okul", opts).ok).toBe(false);
    expect(checkText("en iyi okul", opts).ok).toBe(false);
  });
  it("uzunluk aşımı", () => {
    expect(checkText("a".repeat(151), opts)).toEqual({ ok: false, message: "150 karakteri aştı" });
  });
  it("kısa metin", () => {
    expect(checkText("kısa", opts)).toEqual({ ok: false, message: "Biraz daha yaz" });
  });
  it("geçer", () => {
    expect(checkText("Bugün bahçede oyun oynadık", opts)).toEqual({ ok: true, message: "Kontrol geçti" });
  });
});

describe("submissionBlockers", () => {
  const text = "Bugün bahçede oyun oynadık";
  it("uygun Reels teslim edilir", () => {
    expect(submissionBlockers({ kind: "reels", text, hasVideo: true, faceAnswer: false }, opts)).toEqual([]);
  });
  it("yüz Evet engeller", () => {
    expect(submissionBlockers({ kind: "reels", text, hasVideo: true, faceAnswer: true }, opts)).toEqual([
      "Öğrenci yüzü ya da adı olan içerik kullanılamaz",
    ]);
  });
  it("video yoksa ve cevap yoksa engeller", () => {
    expect(submissionBlockers({ kind: "reels", text, hasVideo: false, faceAnswer: null }, opts)).toEqual([
      "Video yükle",
      "Yüz sorusunu cevapla",
    ]);
  });
  it("sayfada video gerekmez", () => {
    expect(submissionBlockers({ kind: "sayfa", text, hasVideo: false, faceAnswer: null }, opts)).toEqual([]);
  });
  it("metin hatası eklenir", () => {
    expect(submissionBlockers({ kind: "sayfa", text: "kısa", hasVideo: false, faceAnswer: null }, opts)).toEqual([
      "Biraz daha yaz",
    ]);
  });
});

describe("STAGES", () => {
  it("sıra ve sayfa organiği atlar", () => {
    expect(STAGES.map((s) => s.key)).toEqual(["gorev", "kontrol", "organik", "test", "kazanan", "arsiv"]);
    expect(nextStageAfterApproval("reels")).toBe("organik");
    expect(nextStageAfterApproval("sayfa")).toBe("test");
  });
});

describe("contentBlockers sayfa reklam alanları ve görsel (O2)", () => {
  const rules = {
    banned: ["en iyi", "bir numara", "en güvenli", "garanti"],
    limits: { reelsCaption: 150, pageTitle: 30, min: 10 },
    rules: { targetTl: 0, stopMultiple: 0, winMin: 0, noResultWeeks: 0 },
  };
  const row = (extra: Record<string, unknown>) => ({
    kind: "sayfa" as const,
    caption: null,
    page_fields: { baslik: "İlk hafta uyum programı", ...extra },
    media_path: null,
    face_answer: null,
  });

  it("görsel seçilmemişse engeller", () => {
    expect(contentBlockers(row({}), rules)).toContain("Görsel seç");
    expect(contentBlockers(row({ mediaKey: "yokBoyle" }), rules)).toContain("Görsel seç");
  });
  it("geçerli görselle engel yok", () => {
    expect(contentBlockers(row({ mediaKey: "gardenWide" }), rules)).toEqual([]);
  });
  it("uzun reklam cümlesi", () => {
    expect(contentBlockers(row({ mediaKey: "gardenWide", adPrimaryText: "a".repeat(126) }), rules)).toEqual([
      "Reklam cümlesi: 125 karakteri aştı",
    ]);
  });
  it("yasaklı reklam başlığı", () => {
    expect(contentBlockers(row({ mediaKey: "gardenWide", adHeadline: "Garanti yer" }), rules)).toEqual([
      'Reklam başlığı: "garanti" kanıt ister, kullanılamaz',
    ]);
  });
  it("boş reklam alanları engellemez", () => {
    expect(contentBlockers(row({ mediaKey: "gardenWide", adPrimaryText: "", adHeadline: "  " }), rules)).toEqual([]);
  });
  it("isPageFieldKey yeni anahtarları kabul eder", () => {
    expect(isPageFieldKey("mediaKey")).toBe(true);
    expect(isPageFieldKey("adPrimaryText")).toBe(true);
    expect(isPageFieldKey("adHeadline")).toBe(true);
    expect(isPageFieldKey("baslik")).toBe(true);
    expect(isPageFieldKey("baska")).toBe(false);
  });
  it("PAGE_AD_FIELDS sınırları", () => {
    expect(PAGE_AD_FIELDS).toEqual([
      { key: "adPrimaryText", label: "Reklam cümlesi (Instagram'da görünür)", max: 125 },
      { key: "adHeadline", label: "Reklam başlığı", max: 40 },
    ]);
  });
});
