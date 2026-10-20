import { describe, it, expect } from "vitest";
import { checkText, submissionBlockers } from "@/lib/content/checks";
import { STAGES, nextStageAfterApproval } from "@/lib/content/stages";

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
