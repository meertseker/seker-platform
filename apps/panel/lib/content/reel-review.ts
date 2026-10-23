// Z1 kontrol kartı ve Z2 yayın paneli için saf yardımcılar (Reklam Konsolu Paket B).
import type { BoardItem } from "./board";
import { checkText } from "./checks";
import { REELS_AD_MAX_S, reelFormatLines } from "./media-meta";
import type { ContentLimits } from "./settings";

export type CheckLine = { ok: boolean; tone: "ok" | "warn" | "bad"; text: string };

/** Z1 "Otomatik kontroller": biçim+süre, açıklama, öğretmen cevabı, altyazı. */
export function reelReviewChecks(
  item: Pick<BoardItem, "caption" | "faceAnswer" | "reelMeta">,
  rules: { banned: string[]; limits: ContentLimits },
): CheckLine[] {
  const lines: CheckLine[] = [];
  const m = item.reelMeta;
  if (!m) {
    const [legacy] = reelFormatLines(null);
    lines.push(legacy);
  } else {
    const secs = Math.round(m.durationS);
    const ad = m.durationS <= REELS_AD_MAX_S;
    const shape = m.vertical ? "Dikey 9:16" : "Dikey değil";
    const text = `${shape}, ${secs} saniye (reklam için ${ad ? "60 sn altı" : "60 sn üstü; organik paylaşılır"})`;
    lines.push({ ok: m.vertical && ad, tone: !m.vertical ? "bad" : ad ? "ok" : "warn", text });
  }

  const caption = item.caption ?? "";
  const check = checkText(caption, { max: rules.limits.reelsCaption, min: rules.limits.min, banned: rules.banned });
  lines.push(
    check.ok
      ? { ok: true, tone: "ok", text: `Açıklama ${caption.length} / ${rules.limits.reelsCaption} karakter, yasaklı ifade yok` }
      : { ok: false, tone: "bad", text: check.message },
  );

  lines.push(
    item.faceAnswer === false
      ? { ok: true, tone: "ok", text: "Öğretmenin cevabı: \"Videoda ve yazıda öğrenci yüzü ya da adı yok\"" }
      : { ok: false, tone: "bad", text: "Öğretmenin yüz/ad cevabı yok" },
  );

  if (m) {
    lines.push(
      m.subtitled
        ? { ok: true, tone: "ok", text: "Altyazı var (öğretmen işaretledi)" }
        : { ok: false, tone: "warn", text: "Altyazı işaretlenmedi" },
    );
  }
  return lines;
}

export type PanelState =
  | { kind: "hazir" }
  | { kind: "planli"; at: string }
  | { kind: "isleniyor" }
  | { kind: "yayinda"; publishedAt: string; permalink: string | null }
  | { kind: "hata"; error: string }
  | { kind: "elle"; permalink: string }
  | { kind: "gizli" };

/** Yayın panelinin hâli (B3: yalnız onaylı, organik Reels'te görünür). */
export function reelPanelState(item: BoardItem): PanelState {
  if (item.kind !== "reels" || item.stage !== "organik" || item.status !== "onaylandi") return { kind: "gizli" };
  if (item.igPermalink && item.igPublishStatus !== "yayinda") return { kind: "elle", permalink: item.igPermalink };
  switch (item.igPublishStatus) {
    case "kuyruk":
      return item.igPublishScheduledAt ? { kind: "planli", at: item.igPublishScheduledAt } : { kind: "isleniyor" };
    case "isleniyor":
      return { kind: "isleniyor" };
    case "yayinda":
      return { kind: "yayinda", publishedAt: item.igPublishedAt ?? item.stageChangedAt, permalink: item.igPermalink };
    case "hata":
      return { kind: "hata", error: item.igPublishError ?? "bilinmeyen hata" };
    default:
      return { kind: "hazir" };
  }
}

/** "https://www.instagram.com/reel/C9xkAbCd/" → "instagram.com/reel/C9xk…". */
export function permalinkLabel(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const host = u.hostname.replace(/^www\./, "");
    if (parts.length >= 2) {
      const code = parts[1];
      return `${host}/${parts[0]}/${code.length > 4 ? `${code.slice(0, 4)}…` : code}`;
    }
    return `${host}${u.pathname}`;
  } catch {
    return url;
  }
}

/** İçerik panosunun Reels yayın bağlamı (sayfa üretir; organik/kontrol Reels yoksa null ve Meta'ya gidilmez). */
export type ReelPanelContext = {
  publishEnabled: boolean;
  igUsername: string | null;
  igReady: boolean;
  remaining: number | null;
  total: number | null;
  limits: ContentLimits;
  banned: string[];
};
