// Kampanyalar ekranının metinleri (saf): durum etiketi, onay penceresinin madde satırları, gerekçe ve kod listesi.
import type { CampaignRow } from "./campaigns";

export type AdChangeKind = "pause" | "resume" | "budget";

const PLATFORM_LABEL = { google: "Google", meta: "Instagram" } as const;
const tlInt = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

export const PARENT_PAUSED_LINE = "Kampanya / reklam seti durdurulmuş; bu reklam üst düzey başlatılana kadar gösterilmez.";

/** Kampanya hücresindeki küçük durum yazısı. */
export function statusLabel(row: CampaignRow): string | null {
  if (row.status === "yayinda") return "yayında";
  if (row.status === "reklam") return "reklam";
  if (row.status === "durduruldu") {
    if (row.parentPaused && row.selfPaused) return "durduruldu · üst düzey de durdurulmuş";
    if (row.parentPaused) return "durduruldu · üst düzey";
    return "durduruldu";
  }
  return null;
}

/**
 * Onay penceresindeki madde satırları. Canlı yazım kapalıyken platformda bir şey olacakmış gibi söz verilmez;
 * üst düzeyi durmuş reklam başlatılınca gösterilmeye başlamaz.
 */
export function dialogLines(
  row: CampaignRow,
  kind: AdChangeKind,
  opts: { writeEnabled: boolean; currentTl: number; nextTl: number },
): string[] {
  const lines: string[] = [];
  if (kind === "budget") {
    const monthly = tlInt.format(Math.round(Math.abs(opts.nextTl - opts.currentTl) * 30));
    lines.push(
      opts.nextTl > opts.currentTl ? `Aylık en fazla ${monthly} TL ek harcama demek.` : `Aylık en fazla ${monthly} TL daha az harcama demek.`,
    );
    if (row.budgetNote) lines.push(row.budgetNote);
    if (opts.writeEnabled) lines.push(`${PLATFORM_LABEL[row.platform]} hesabında hemen uygulanır.`);
    lines.push("Kim, ne zaman, eski ve yeni değer kayda geçer.");
    return lines;
  }
  if (kind === "pause") {
    if (opts.writeEnabled) {
      lines.push("Reklam bugün içinde gösterilmeyi bırakır, harcama durur.");
      lines.push("Gelmiş veliler ve geçmiş sayılar silinmez.");
      lines.push("İstediğinizde aynı düğmeyle yeniden başlatılır.");
    } else {
      lines.push("Yalnız kayda geçer; platforma gönderilmez, reklam yayında kalır.");
      lines.push("Gelmiş veliler ve geçmiş sayılar silinmez.");
    }
    return lines;
  }
  if (!opts.writeEnabled) lines.push("Yalnız kayda geçer; platforma gönderilmez, reklam durdurulmuş kalır.");
  if (row.parentPaused) {
    lines.push(PARENT_PAUSED_LINE);
  } else if (opts.writeEnabled) {
    lines.push("Reklam yeniden gösterilmeye başlar.");
    if (row.platform === "meta") lines.push("Instagram'da öğrenme dönemi baştan başlayabilir.");
  }
  return lines;
}

/** Gerekçe yalnız uyarı (kırmızı kapı ya da büyütme sınırı) varken gönderilir. */
export function reasonToSend(needsReason: boolean, reason: string): string | undefined {
  if (!needsReason) return undefined;
  const trimmed = reason.trim();
  return trimmed ? trimmed : undefined;
}

/** Instagram reklamı yalnız Reels (R-) koduna bağlanır. */
export function instagramCodes<T extends { code: string }>(codes: T[]): T[] {
  return codes.filter((c) => c.code.startsWith("R-"));
}
