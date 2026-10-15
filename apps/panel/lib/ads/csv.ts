import type { SpendRow } from "./types";

const ALIASES = {
  date: ["gün", "day", "date", "tarih"],
  campaignId: ["kampanya kimliği", "campaign id"],
  campaignName: ["kampanya", "campaign"],
  cost: ["maliyet", "cost"],
  clicks: ["tıklamalar", "tıklama", "clicks"],
  impressions: ["gösterimler", "gösterim", "gösterim sayısı", "impr.", "impressions"],
} as const;
type Column = keyof typeof ALIASES;
const REQUIRED: Column[] = ["date", "campaignId", "campaignName", "cost"];
const REQUIRED_LABELS = "Gün, Kampanya kimliği, Kampanya, Maliyet";

/**
 * Başlığın iki küçük harf biçimini döner. Türkçe yerelde "ID" → "ıd" olur ("Campaign ID" eşleşmez),
 * Türkçe olmayan küçültmede "TIKLAMALAR" → "tiklamalar" olur; ikisini birden denemek her iki dili yakalar.
 */
function headerVariants(value: string): string[] {
  const trimmed = value.replace(/^﻿/, "").trim();
  return [trimmed.toLocaleLowerCase("tr-TR"), trimmed.toLowerCase()];
}

function detectDelimiter(line: string): string {
  const counts = [",", "\t", ";"].map((d) => [d, line.split(d).length] as const);
  return counts.sort((a, b) => b[1] - a[1])[0][0];
}

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

/** "1.234,56", "1,234.56", "₺75,00" gibi biçimleri sayıya çevirir. Okunamazsa null. */
export function parseLocaleNumber(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(cleaned)) return null;
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    normalized = lastComma > lastDot
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = /^-?\d{1,3}(,\d{3})+$/.test(cleaned) ? cleaned.replace(/,/g, "") : cleaned.replace(",", ".");
  } else if (lastDot >= 0) {
    normalized = /^-?\d{1,3}(\.\d{3})+$/.test(cleaned) ? cleaned.replace(/\./g, "") : cleaned;
  } else {
    normalized = cleaned;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function parseDate(raw: string): string | null {
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;
  const tr = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (tr) return `${tr[3]}-${tr[2].padStart(2, "0")}-${tr[1].padStart(2, "0")}`;
  return null;
}

/** Google Ads "Kampanyalar" raporu CSV/TSV dışa aktarımını SpendRow listesine çevirir. */
export function parseSpendCsv(text: string): { rows: SpendRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  let headerIndex = -1;
  let delimiter = ",";
  let columns: Partial<Record<Column, number>> = {};

  for (let i = 0; i < Math.min(lines.length, 10); i += 1) {
    const d = detectDelimiter(lines[i]);
    const headers = splitLine(lines[i], d).map(headerVariants);
    const found: Partial<Record<Column, number>> = {};
    for (const [column, aliases] of Object.entries(ALIASES) as [Column, readonly string[]][]) {
      const index = headers.findIndex((variants) => variants.some((v) => aliases.includes(v)));
      if (index >= 0) found[column] = index;
    }
    if (REQUIRED.every((c) => found[c] !== undefined)) {
      headerIndex = i;
      delimiter = d;
      columns = found;
      break;
    }
  }

  if (headerIndex < 0) {
    return {
      rows: [],
      errors: [`CSV'de şu kolonlar bulunamadı: ${REQUIRED_LABELS}. Raporu 'Gün' segmentiyle ve 'Kampanya kimliği' kolonuyla indirin.`],
    };
  }

  const rows: SpendRow[] = [];
  const errors: string[] = [];
  lines.slice(headerIndex + 1).forEach((line, offset) => {
    const lineNo = headerIndex + offset + 2; // dosyadaki 1 tabanlı satır (boş satırlar hariç)
    const cells = splitLine(line, delimiter);
    const date = parseDate(cells[columns.date!] ?? "");
    if (!date) return; // "Toplam" ve özet satırları
    const campaignId = (cells[columns.campaignId!] ?? "").replace(/\D/g, "");
    if (!campaignId) {
      errors.push(`${lineNo}. satır: kampanya kimliği yok`);
      return;
    }
    const costRaw = cells[columns.cost!] ?? "";
    const cost = parseLocaleNumber(costRaw);
    if (cost == null) {
      errors.push(`${lineNo}. satır: maliyet okunamadı (${costRaw})`);
      return;
    }
    const clicks = columns.clicks !== undefined ? parseLocaleNumber(cells[columns.clicks] ?? "") ?? 0 : 0;
    const impressions = columns.impressions !== undefined ? parseLocaleNumber(cells[columns.impressions] ?? "") ?? 0 : 0;
    rows.push({
      date,
      campaignId,
      campaignName: cells[columns.campaignName!] ?? "",
      costMicros: Math.round(cost * 1_000_000),
      clicks: Math.round(clicks),
      impressions: Math.round(impressions),
    });
  });

  return { rows, errors };
}
