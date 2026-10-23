/**
 * Reels video biçim bilgisi (spec K17). Saf: tarayıcı (yükleme) ve sunucu (yayın kapısı) birlikte kullanır.
 * `media_meta` anahtarları tam olarak { durationS, width, height, vertical, coverOffsetMs, subtitled };
 * eski yüklemelerin `name`, `size`, `durationSec` alanları korunur ama burada okunmaz.
 */

export type ReelMediaMeta = {
  durationS: number;
  width: number;
  height: number;
  vertical: boolean;
  coverOffsetMs: number;
  subtitled: boolean;
};

export const DEFAULT_COVER_OFFSET_MS = 1000;
/** Meta Reels alt sınırı 3 sn. */
export const REELS_MIN_S = 3;
export const REELS_MAX_S = 90;
export const REELS_AD_MAX_S = 60;
/** Meta: yatay en çok 1920 px. https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media */
export const REELS_MAX_WIDTH_PX = 1920;
/** 9:16 = 1.78; %5 pay. */
export const VERTICAL_MIN_RATIO = 1.7;

export function isVertical(width: number, height: number): boolean {
  if (!(width > 0) || !(height > 0)) return false;
  return height / width >= VERTICAL_MIN_RATIO;
}

const UNREADABLE = "Video okunamadı. Telefonun kamerasıyla MP4 ya da MOV çekip yeniden seç.";

/** Yüklemeyi engelleyen sebepler, sırayla. Boş dizi = uygun. */
export function reelUploadBlockers(m: { durationS: number; width: number; height: number }): string[] {
  const ok = (n: number) => Number.isFinite(n) && n > 0;
  if (!ok(m.durationS) || !ok(m.width) || !ok(m.height)) return [UNREADABLE];
  const out: string[] = [];
  if (!isVertical(m.width, m.height)) out.push("Video dikey değil. Telefonu dik tutup 9:16 çek.");
  if (m.durationS > REELS_MAX_S) {
    out.push(`Video ${Math.round(m.durationS)} sn. Reels en fazla ${REELS_MAX_S} sn olabilir; kısaltıp yeniden seç.`);
  }
  if (m.durationS < REELS_MIN_S) out.push(`Video çok kısa. En az ${REELS_MIN_S} sn olmalı.`);
  if (m.width > REELS_MAX_WIDTH_PX) out.push("Video çözünürlüğü çok yüksek (4K). Kamerada 1080p seçip yeniden çek.");
  return out;
}

export function buildReelMediaMeta(input: {
  durationS: number;
  width: number;
  height: number;
  coverOffsetMs?: number | null;
  subtitled: boolean;
}): ReelMediaMeta {
  const durationS = Math.round(input.durationS * 10) / 10;
  const maxMs = Math.max(0, Math.floor(input.durationS * 1000) - 1);
  const raw = input.coverOffsetMs == null || !Number.isFinite(input.coverOffsetMs) ? DEFAULT_COVER_OFFSET_MS : input.coverOffsetMs;
  const coverOffsetMs = Math.round(Math.min(Math.max(0, raw), maxMs));
  return {
    durationS,
    width: Math.round(input.width),
    height: Math.round(input.height),
    vertical: isVertical(input.width, input.height),
    coverOffsetMs,
    subtitled: input.subtitled === true,
  };
}

/** Altı anahtarın hepsi doğru türdeyse K17 nesnesi; aksi null (eski yükleme). */
export function parseReelMediaMeta(raw: unknown): ReelMediaMeta | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  if (!num(r.durationS) || !num(r.width) || !num(r.height) || !num(r.coverOffsetMs)) return null;
  if (typeof r.vertical !== "boolean" || typeof r.subtitled !== "boolean") return null;
  return {
    durationS: r.durationS as number,
    width: r.width as number,
    height: r.height as number,
    vertical: r.vertical,
    coverOffsetMs: r.coverOffsetMs as number,
    subtitled: r.subtitled,
  };
}

export type FormatLine = { ok: boolean; tone: "ok" | "warn" | "bad"; text: string };

export function coverLabel(coverOffsetMs: number): string {
  const s = Math.round(coverOffsetMs / 1000);
  return s <= 0 ? "Kapak: ilk kare" : `Kapak: ${s}. saniye`;
}

/** Z1/Z2/O1 biçim satırları. */
export function reelFormatLines(m: ReelMediaMeta | null): FormatLine[] {
  if (!m) {
    return [{ ok: false, tone: "warn", text: "Biçim bilgisi yok (eski yükleme). Öğretmen videoyu yeniden seçerse kontrol edilir." }];
  }
  const secs = Math.round(m.durationS);
  const line = (ok: boolean, bad: "warn" | "bad", text: string): FormatLine => ({ ok, tone: ok ? "ok" : bad, text });
  return [
    line(m.vertical, "bad", m.vertical ? `Dikey 9:16 · ${secs} sn` : `Dikey değil · ${secs} sn`),
    m.durationS <= REELS_AD_MAX_S
      ? line(true, "warn", "Reklam için uygun (60 sn altı)")
      : line(false, "warn", "Reklam için uzun (60 sn üstü); organik paylaşılır"),
    line(m.subtitled, "warn", m.subtitled ? "Altyazı var (öğretmen işaretledi)" : "Altyazı işaretlenmedi"),
    line(true, "warn", coverLabel(m.coverOffsetMs)),
  ];
}
