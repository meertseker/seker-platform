import { describe, expect, it } from "vitest";
import type { BoardItem } from "@/lib/content/board";
import { permalinkLabel, reelPanelState, reelReviewChecks } from "@/lib/content/reel-review";

const meta = { durationS: 34, width: 1080, height: 1920, vertical: true, coverOffsetMs: 1000, subtitled: true };
const rules = { banned: ["en iyi"], limits: { reelsCaption: 150, pageTitle: 60, min: 5 } };
const caption118 = "a".repeat(118);

function item(over: Partial<BoardItem> = {}): BoardItem {
  return {
    id: "c1", code: "R-2644-A", kind: "reels", platform: "instagram", topic: "Bahçe", audience: null, brief: null,
    ownerId: "o1", ownerName: "Ayşe", ownerPhone: null, dueAt: null, status: "onaylandi", stage: "organik",
    stageChangedAt: "2026-10-24T06:00:00Z", submittedAt: null, caption: caption118, pageFields: {}, mediaPath: "o1/c1/v.mp4",
    faceAnswer: false, reviewNote: null, learnedNote: null, igPermalink: null, igPublishedAt: null,
    approvedAt: null, approverFaceCheck: true, reelMeta: meta, igPublishStatus: "yok", igPublishError: null,
    igPublishScheduledAt: null, reelChecks: null, ...over,
  };
}

describe("reelReviewChecks (Z1)", () => {
  it("tasarım sırasıyla ve metniyle döner", () => {
    const lines = reelReviewChecks(item(), rules);
    expect(lines.map((l) => l.text)).toEqual([
      "Dikey 9:16, 34 saniye (reklam için 60 sn altı)",
      "Açıklama 118 / 150 karakter, yasaklı ifade yok",
      "Öğretmenin cevabı: \"Videoda ve yazıda öğrenci yüzü ya da adı yok\"",
      "Altyazı var (öğretmen işaretledi)",
    ]);
    expect(lines.every((l) => l.ok && l.tone === "ok")).toBe(true);
  });

  it("75 sn video reklam için uzun uyarısı", () => {
    const [first] = reelReviewChecks(item({ reelMeta: { ...meta, durationS: 75 } }), rules);
    expect(first).toEqual({ ok: false, tone: "warn", text: "Dikey 9:16, 75 saniye (reklam için 60 sn üstü; organik paylaşılır)" });
  });

  it("yasaklı ifade açıklama satırını kırmızı yapar", () => {
    const lines = reelReviewChecks(item({ caption: "En iyi okul burası, gelin" }), rules);
    expect(lines[1]).toEqual({ ok: false, tone: "bad", text: "\"en iyi\" kanıt ister, kullanılamaz" });
  });

  it("biçim bilgisi yoksa ilk satır uyarı, altyazı satırı yok", () => {
    const lines = reelReviewChecks(item({ reelMeta: null }), rules);
    expect(lines[0].tone).toBe("warn");
    expect(lines[0].text).toMatch(/^Biçim bilgisi yok/);
    expect(lines).toHaveLength(3);
  });

  it("öğretmen cevabı yoksa kırmızı", () => {
    expect(reelReviewChecks(item({ faceAnswer: null }), rules)[2].tone).toBe("bad");
  });

  it("altyazı işaretlenmediyse uyarı", () => {
    expect(reelReviewChecks(item({ reelMeta: { ...meta, subtitled: false } }), rules)[3]).toEqual({
      ok: false,
      tone: "warn",
      text: "Altyazı işaretlenmedi",
    });
  });
});

describe("reelPanelState", () => {
  it("onaylı organik yok → hazir", () => expect(reelPanelState(item())).toEqual({ kind: "hazir" }));
  it("kuyruk + planlı → planli", () =>
    expect(reelPanelState(item({ igPublishStatus: "kuyruk", igPublishScheduledAt: "2026-10-24T20:30:00Z" }))).toEqual({
      kind: "planli",
      at: "2026-10-24T20:30:00Z",
    }));
  it("kuyruk planlı değil → isleniyor", () => expect(reelPanelState(item({ igPublishStatus: "kuyruk" }))).toEqual({ kind: "isleniyor" }));
  it("isleniyor", () => expect(reelPanelState(item({ igPublishStatus: "isleniyor" }))).toEqual({ kind: "isleniyor" }));
  it("yayinda", () =>
    expect(
      reelPanelState(item({ igPublishStatus: "yayinda", igPublishedAt: "2026-10-24T06:31:00Z", igPermalink: "https://www.instagram.com/reel/C9xkAbCd/" })),
    ).toEqual({ kind: "yayinda", publishedAt: "2026-10-24T06:31:00Z", permalink: "https://www.instagram.com/reel/C9xkAbCd/" }));
  it("hata ve metin", () =>
    expect(reelPanelState(item({ igPublishStatus: "hata", igPublishError: "Onay geri alındı" }))).toEqual({
      kind: "hata",
      error: "Onay geri alındı",
      retry: true,
    }));
  it("yayınlandı ama bağlantı bulunamadıysa tekrar dene yok", () =>
    expect(
      reelPanelState(item({ igPublishStatus: "hata", igPublishError: "Instagram'da yayınlandı ama bağlantı bulunamadı; bağlantıyı elle yapıştırın" })),
    ).toMatchObject({ kind: "hata", retry: false }));
  it("elle bağlanmış", () =>
    expect(reelPanelState(item({ igPermalink: "https://www.instagram.com/reel/X1/" }))).toEqual({
      kind: "elle",
      permalink: "https://www.instagram.com/reel/X1/",
    }));
  it("test aşaması gizli", () => expect(reelPanelState(item({ stage: "test" }))).toEqual({ kind: "gizli" }));
  it("kontrol gizli", () => expect(reelPanelState(item({ stage: "kontrol", status: "teslim" }))).toEqual({ kind: "gizli" }));
  it("sayfa gizli", () => expect(reelPanelState(item({ kind: "sayfa" }))).toEqual({ kind: "gizli" }));
});

describe("permalinkLabel", () => {
  it("kısa kod 4 karakter", () => expect(permalinkLabel("https://www.instagram.com/reel/C9xkAbCd/")).toBe("instagram.com/reel/C9xk…"));
  it("bozuk adres olduğu gibi", () => expect(permalinkLabel("x")).toBe("x"));
});
