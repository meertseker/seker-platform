import { describe, expect, it } from "vitest";
import {
  APPROVAL_REVOKED,
  containerOutcome,
  igErrorText,
  inPublishWindow,
  nextPublishWindowStart,
  nextStep,
  publishBlocker,
  scheduleWarning,
  stillPublishable,
  validateSchedule,
  type QueueRow,
} from "@/lib/content/publish-queue";
import { MetaApiError } from "@/lib/ads/meta/insights";

const NOW = new Date("2026-10-24T10:00:00+03:00");
const meta = { durationS: 34, width: 1080, height: 1920, vertical: true, coverOffsetMs: 1000, subtitled: true };

function row(extra: Partial<QueueRow> = {}): QueueRow {
  return {
    id: "c1",
    code: "R-2644-A",
    topic: "Bahçe",
    ownerId: "o1",
    kind: "reels",
    status: "onaylandi",
    stage: "organik",
    approverFaceCheck: true,
    mediaPath: "c1/video.mp4",
    mediaMeta: meta,
    caption: "Bahçede ilk gün",
    igPublishStatus: "yok",
    igContainerId: null,
    igPublishScheduledAt: null,
    igPublishRequestedBy: null,
    igPublishRequestedAt: null,
    igMediaId: null,
    igPermalink: null,
    updatedAt: NOW.toISOString(),
    ...extra,
  };
}
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe("publishBlocker", () => {
  it("onaylı + MEB + organik + K17 tam → null", () => expect(publishBlocker(row())).toBeNull());
  it("MEB yok", () => expect(publishBlocker(row({ approverFaceCheck: null }))).toBe("MEB kutusu işaretlenmeden yayınlanamaz"));
  it("teslim", () => expect(publishBlocker(row({ status: "teslim" }))).toBe("Önce içeriği onaylayın"));
  it("sayfa", () => expect(publishBlocker(row({ kind: "sayfa" }))).toBe("Yalnız Reels Instagram'da yayınlanır"));
  it("test aşaması", () => expect(publishBlocker(row({ stage: "test" }))).toBe("Bu aşamada yayınlanamaz"));
  it("elle bağlanmış", () =>
    expect(publishBlocker(row({ igPermalink: "https://www.instagram.com/reel/x/" }))).toBe("Bu içerik zaten Instagram'a bağlı"));
  it("sırada", () => expect(publishBlocker(row({ igPublishStatus: "kuyruk" }))).toBe("Yayın zaten sırada"));
  it("yayında", () => expect(publishBlocker(row({ igPublishStatus: "yayinda" }))).toBe("Zaten yayında"));
  it("hata durumundan tekrar → null", () => expect(publishBlocker(row({ igPublishStatus: "hata" }))).toBeNull());
  it("video yok", () => expect(publishBlocker(row({ mediaPath: null }))).toBe("Video yok"));
  it("K17 null → eski yükleme metni", () => expect(publishBlocker(row({ mediaMeta: null }))).toMatch(/^Video biçim bilgisi yok/));
  it("yatay video → ilk sebep", () =>
    expect(publishBlocker(row({ mediaMeta: { ...meta, width: 1920, height: 1080, vertical: false } }))).toBe(
      "Video dikey değil. Telefonu dik tutup 9:16 çek.",
    ));
});

describe("stillPublishable (B6)", () => {
  it("kuyruk geçerli", () => expect(stillPublishable(row({ igPublishStatus: "kuyruk" }))).toBe(true));
  it("duzeltme → false", () => expect(stillPublishable(row({ igPublishStatus: "kuyruk", status: "duzeltme" }))).toBe(false));
  it("MEB null → false", () => expect(stillPublishable(row({ igPublishStatus: "kuyruk", approverFaceCheck: null }))).toBe(false));
  it("test aşaması → false", () => expect(stillPublishable(row({ igPublishStatus: "isleniyor", stage: "test" }))).toBe(false));
  it("yok → false", () => expect(stillPublishable(row())).toBe(false));
  it("metin", () => expect(APPROVAL_REVOKED).toBe("Onay geri alındı"));
});

describe("nextStep", () => {
  it("planlı saat gelecekte → wait", () =>
    expect(nextStep(row({ igPublishStatus: "kuyruk", igPublishScheduledAt: "2026-10-24T12:00:00+03:00" }), NOW)).toEqual({ kind: "wait" }));
  it("saat geldi → create", () =>
    expect(nextStep(row({ igPublishStatus: "kuyruk", igPublishScheduledAt: ago(1000) }), NOW)).toEqual({ kind: "create" }));
  it("plansız kuyruk → create", () => expect(nextStep(row({ igPublishStatus: "kuyruk" }), NOW)).toEqual({ kind: "create" }));
  it("konteyner yok → fail", () =>
    expect(nextStep(row({ igPublishStatus: "isleniyor", updatedAt: ago(180_000) }), NOW)).toEqual({
      kind: "fail",
      error: "Konteyner kaydı yok; tekrar deneyin",
    }));
  it("61 dk önce → zaman aşımı", () =>
    expect(nextStep(row({ igPublishStatus: "isleniyor", igContainerId: "1", updatedAt: ago(61 * 60_000) }), NOW)).toEqual({
      kind: "fail",
      error: "Instagram videoyu 1 saatte işleyemedi; tekrar deneyin",
    }));
  it("30 sn önce → wait", () =>
    expect(nextStep(row({ igPublishStatus: "isleniyor", igContainerId: "1", updatedAt: ago(30_000) }), NOW)).toEqual({ kind: "wait" }));
  it("3 dk önce → poll", () =>
    expect(nextStep(row({ igPublishStatus: "isleniyor", igContainerId: "1", updatedAt: ago(180_000) }), NOW)).toEqual({ kind: "poll" }));
  it("yayinda → wait", () => expect(nextStep(row({ igPublishStatus: "yayinda" }), NOW)).toEqual({ kind: "wait" }));
});

describe("containerOutcome", () => {
  it("FINISHED → publish", () => expect(containerOutcome({ statusCode: "FINISHED", errorSubcode: null })).toEqual({ kind: "publish" }));
  it("IN_PROGRESS/UNKNOWN → wait", () => {
    expect(containerOutcome({ statusCode: "IN_PROGRESS", errorSubcode: null })).toEqual({ kind: "wait" });
    expect(containerOutcome({ statusCode: "UNKNOWN", errorSubcode: null })).toEqual({ kind: "wait" });
  });
  it("ERROR 2207026 → biçim metni", () =>
    expect(containerOutcome({ statusCode: "ERROR", errorSubcode: 2207026 })).toEqual({
      kind: "fail",
      error: "Video biçimi Instagram'a uymuyor (MP4/MOV, H.264). Öğretmenden yeniden çekim isteyin",
    }));
  it("EXPIRED → süre doldu", () =>
    expect(containerOutcome({ statusCode: "EXPIRED", errorSubcode: null })).toEqual({
      kind: "fail",
      error: "Instagram konteynerinin süresi doldu; tekrar deneyin",
    }));
  it("PUBLISHED → recover", () => expect(containerOutcome({ statusCode: "PUBLISHED", errorSubcode: null })).toEqual({ kind: "recover" }));
});

describe("igErrorText", () => {
  it("günlük hak", () =>
    expect(igErrorText(new MetaApiError("x", 400, 9, 2207042))).toBe("Günlük Instagram yayın hakkı doldu; yarın tekrar deneyin"));
  it("izin", () => expect(igErrorText(new MetaApiError("x", 403, 10))).toBe("Instagram yayın izni yok (instagram_content_publish) · Mert"));
  it("izin 200", () => expect(igErrorText(new MetaApiError("x", 403, 200))).toMatch(/yayın izni yok/));
  it("anahtar", () => expect(igErrorText(new MetaApiError("x", 400, 190))).toBe("Meta anahtarı geçersiz ya da süresi dolmuş (Mert)"));
  it("indiremedi", () => expect(igErrorText(new MetaApiError("x", 400, 9004, 2207052))).toBe("Instagram videoyu indiremedi; tekrar deneyin"));
  it("geçici", () => expect(igErrorText(new MetaApiError("x", 400, -1, 2207001))).toBe("Instagram geçici hata verdi; tekrar deneyin"));
  it("diğer Meta hatası kısaltılır", () => {
    const t = igErrorText(new MetaApiError("y".repeat(400), 400, 1234));
    expect(t.startsWith("Instagram hatası: ")).toBe(true);
    expect(t.length).toBeLessThanOrEqual(200);
  });
  it("Meta dışı hata", () => expect(igErrorText(new TypeError("fetch failed"))).toBe("Instagram'a ulaşılamadı; tekrar deneyin"));
});

describe("zaman penceresi", () => {
  it("scheduleWarning", () => {
    expect(scheduleWarning(new Date("2026-10-24T23:30:00+03:00"))).toBe(
      "Bu saat 07:00–23:00 dışında. Yayın ertesi sabah 07:00'den sonraki ilk koşuda yapılır.",
    );
    expect(scheduleWarning(new Date("2026-10-24T22:40:00+03:00"))).toBeNull();
    expect(scheduleWarning(new Date("2026-10-24T06:59:00+03:00"))).not.toBeNull();
    expect(inPublishWindow(new Date("2026-10-24T07:00:00+03:00"))).toBe(true);
  });
  it("validateSchedule", () => {
    expect(validateSchedule("abc", NOW)).toEqual({ error: "Saat geçersiz" });
    expect(validateSchedule(new Date(NOW.getTime() + 5 * 60_000).toISOString(), NOW)).toEqual({
      error: "En erken 10 dakika sonrası seçilebilir",
    });
    expect(validateSchedule(new Date(NOW.getTime() + 15 * 86_400_000).toISOString(), NOW)).toEqual({
      error: "En geç 14 gün sonrası seçilebilir",
    });
    const ok = validateSchedule("2026-10-24T15:00", NOW);
    expect("at" in ok && ok.at.toISOString()).toBe("2026-10-24T12:00:00.000Z");
  });
  it("nextPublishWindowStart", () => {
    expect(nextPublishWindowStart(new Date("2026-10-24T23:30:00+03:00")).toISOString()).toBe(
      new Date("2026-10-25T07:00:00+03:00").toISOString(),
    );
    expect(nextPublishWindowStart(new Date("2026-10-24T05:00:00+03:00")).toISOString()).toBe(
      new Date("2026-10-24T07:00:00+03:00").toISOString(),
    );
    const inside = new Date("2026-10-24T12:34:00+03:00");
    expect(nextPublishWindowStart(inside).getTime()).toBe(inside.getTime());
  });
});
