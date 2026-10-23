import { describe, expect, it } from "vitest";
import {
  buildReelMediaMeta,
  DEFAULT_COVER_OFFSET_MS,
  isVertical,
  parseReelMediaMeta,
  reelFormatLines,
  reelUploadBlockers,
} from "@/lib/content/media-meta";

const full = { durationS: 34, width: 1080, height: 1920, vertical: true, coverOffsetMs: 1000, subtitled: true };

describe("Reels biçim bilgisi (K17)", () => {
  it("1080×1920 dikey, 1920×1080 değil, 1080×1350 (4:5) değil", () => {
    expect(isVertical(1080, 1920)).toBe(true);
    expect(isVertical(1920, 1080)).toBe(false);
    expect(isVertical(1080, 1350)).toBe(false);
  });

  it("34 sn dikey video engelsiz", () => {
    expect(reelUploadBlockers({ durationS: 34, width: 1080, height: 1920 })).toEqual([]);
  });
  it("95 sn uzun", () => {
    expect(reelUploadBlockers({ durationS: 95.4, width: 1080, height: 1920 })).toEqual([
      "Video 95 sn. Reels en fazla 90 sn olabilir; kısaltıp yeniden seç.",
    ]);
  });
  it("2 sn kısa", () => {
    expect(reelUploadBlockers({ durationS: 2, width: 1080, height: 1920 })).toEqual(["Video çok kısa. En az 3 sn olmalı."]);
  });
  it("4K dikey reddedilir", () => {
    expect(reelUploadBlockers({ durationS: 20, width: 2160, height: 3840 })).toEqual([
      "Video çözünürlüğü çok yüksek (4K). Kamerada 1080p seçip yeniden çek.",
    ]);
  });
  it("NaN süre okunamadı", () => {
    expect(reelUploadBlockers({ durationS: NaN, width: 1080, height: 1920 })).toEqual([
      "Video okunamadı. Telefonun kamerasıyla MP4 ya da MOV çekip yeniden seç.",
    ]);
    expect(reelUploadBlockers({ durationS: 10, width: 0, height: 0 })).toHaveLength(1);
  });
  it("yatay ve uzun video iki sebebi birlikte döner", () => {
    expect(reelUploadBlockers({ durationS: 120, width: 1920, height: 1080 })).toEqual([
      "Video dikey değil. Telefonu dik tutup 9:16 çek.",
      "Video 120 sn. Reels en fazla 90 sn olabilir; kısaltıp yeniden seç.",
    ]);
  });

  it("kapak seçilmezse 1000 ms", () => {
    const m = buildReelMediaMeta({ durationS: 34.25, width: 1080, height: 1920, subtitled: false });
    expect(m).toEqual({ durationS: 34.3, width: 1080, height: 1920, vertical: true, coverOffsetMs: DEFAULT_COVER_OFFSET_MS, subtitled: false });
  });
  it("kapak süreyi aşarsa son kareye çekilir", () => {
    expect(buildReelMediaMeta({ durationS: 5, width: 1080, height: 1920, coverOffsetMs: 9000, subtitled: true }).coverOffsetMs).toBe(4999);
  });
  it("0.4 sn kapak 400 ms kalır", () => {
    expect(buildReelMediaMeta({ durationS: 5, width: 1080, height: 1920, coverOffsetMs: 400.4, subtitled: true }).coverOffsetMs).toBe(400);
  });

  it("eski media_meta null döner", () => {
    expect(parseReelMediaMeta({ name: "a.mp4", size: 10, durationSec: 30 })).toBeNull();
    expect(parseReelMediaMeta(null)).toBeNull();
  });
  it("tam K17 nesnesi aynen döner (ek anahtarlar atılır)", () => {
    expect(parseReelMediaMeta({ ...full, name: "a.mp4", size: 1 })).toEqual(full);
  });
  it("subtitled string ise null", () => {
    expect(parseReelMediaMeta({ ...full, subtitled: "true" })).toBeNull();
  });

  it("reelFormatLines: 34 sn reklam satırı ok", () => {
    const lines = reelFormatLines(full);
    expect(lines.map((l) => l.text)).toEqual([
      "Dikey 9:16 · 34 sn",
      "Reklam için uygun (60 sn altı)",
      "Altyazı var (öğretmen işaretledi)",
      "Kapak: 1. saniye",
    ]);
    expect(lines.every((l) => l.ok)).toBe(true);
  });
  it("reelFormatLines: 75 sn reklam satırı warn, altyazı yok warn, kapak ilk kare", () => {
    const lines = reelFormatLines({ ...full, durationS: 75, subtitled: false, coverOffsetMs: 0 });
    expect(lines[1]).toEqual({ ok: false, tone: "warn", text: "Reklam için uzun (60 sn üstü); organik paylaşılır" });
    expect(lines[2].tone).toBe("warn");
    expect(lines[3].text).toBe("Kapak: ilk kare");
  });
  it("reelFormatLines: null tek uyarı satırı", () => {
    expect(reelFormatLines(null)).toEqual([
      { ok: false, tone: "warn", text: "Biçim bilgisi yok (eski yükleme). Öğretmen videoyu yeniden seçerse kontrol edilir." },
    ]);
  });
});
