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


const TOTAL_ROW = /^(toplam|total)/;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Takvimde gerçekten var olan bir tarihi "YYYY-MM-DD" olarak döner; yoksa null (ör. 2026-02-30). */
function toIsoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** ISO (2026-10-12), d.m.yyyy, d/m/yyyy ve dd/mm/yyyy biçimlerini ISO tarihe çevirir. */
function parseDate(raw: string): string | null {
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const local = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (local) return toIsoDate(Number(local[3]), Number(local[2]), Number(local[1]));
  return null;
}

/** Sayaç kolonu (tıklama/gösterim): boş veya "--" ise 0; okunamaz ya da negatifse hata. */
function readCount(raw: string, label: string): { value: number } | { error: string } {
  if (raw === "" || raw === "--") return { value: 0 };
  const value = parseLocaleNumber(raw);
  if (value == null) return { error: `${label} okunamadı (${raw})` };
  if (value < 0) return { error: `negatif değer (${raw})` };
  return { value: Math.round(value) };
}

interface NumberedLine {
  no: number; // dosyadaki 1 tabanlı satır numarası (boş satırlar dahil)
  text: string;
}

/**
 * Google Ads "Kampanyalar" raporu CSV/TSV dışa aktarımını SpendRow listesine çevirir.
 * Aynı (tarih, kampanya kimliği) satırları tek satırda toplanır (segmentli raporlar birden çok satır verir).
 * Toplam satırları ve kampanya kimliği boş satırlar sessizce atlanır; diğer hatalı satırlar satır numarasıyla bildirilir.
 */
export function parseSpendCsv(text: string): { rows: SpendRow[]; errors: string[] } {
  const numbered: NumberedLine[] = text
    .split(/\r?\n/)
    .map((line, i) => ({ no: i + 1, text: line }))
    .filter((line) => line.text.trim() !== "");

  let headerPos = -1;
  let delimiter = ",";
  let columns: Partial<Record<Column, number>> = {};

  for (let i = 0; i < Math.min(numbered.length, 10); i += 1) {
    const d = detectDelimiter(numbered[i].text);
    const headers = splitLine(numbered[i].text, d).map(headerVariants);
    const found: Partial<Record<Column, number>> = {};
    for (const [column, aliases] of Object.entries(ALIASES) as [Column, readonly string[]][]) {
      const index = headers.findIndex((variants) => variants.some((v) => aliases.includes(v)));
      if (index >= 0) found[column] = index;
    }
    if (REQUIRED.every((c) => found[c] !== undefined)) {
      headerPos = i;
      delimiter = d;
      columns = found;
      break;
    }
  }

  if (headerPos < 0) {
    return {
      rows: [],
      errors: [`CSV'de şu kolonlar bulunamadı: ${REQUIRED_LABELS}. Raporu 'Gün' segmentiyle ve 'Kampanya kimliği' kolonuyla indirin.`],
    };
  }

  const merged = new Map<string, SpendRow>();
  const errors: string[] = [];

  for (const line of numbered.slice(headerPos + 1)) {
    const where = `${line.no}. satır`;
    const cells = splitLine(line.text, delimiter);
    const firstCell = (cells[0] ?? "").toLocaleLowerCase("tr-TR");
    if (TOTAL_ROW.test(firstCell)) continue; // "Toplam" / "Total" özet satırı

    const date = parseDate(cells[columns.date!] ?? "");
    if (!date) {
      errors.push(`${where}: tarih okunamadı (${cells[columns.date!] ?? ""})`);
      continue;
    }

    const campaignIdRaw = cells[columns.campaignId!] ?? "";
    if (campaignIdRaw === "") continue; // kampanya kimliği boş satır
    if (!/^\d+$/.test(campaignIdRaw)) {
      errors.push(`${where}: kampanya kimliği geçersiz (${campaignIdRaw})`);
      continue;
    }

    const costRaw = cells[columns.cost!] ?? "";
    const cost = costRaw === "--" ? 0 : parseLocaleNumber(costRaw);
    if (cost == null) {
      errors.push(`${where}: maliyet okunamadı (${costRaw})`);
      continue;
    }
    if (cost < 0) {
      errors.push(`${where}: negatif değer (${costRaw})`);
      continue;
    }

    const clicks = columns.clicks !== undefined ? readCount(cells[columns.clicks] ?? "", "tıklamalar") : { value: 0 };
    if ("error" in clicks) {
      errors.push(`${where}: ${clicks.error}`);
      continue;
    }
    const impressions = columns.impressions !== undefined ? readCount(cells[columns.impressions] ?? "", "gösterimler") : { value: 0 };
    if ("error" in impressions) {
      errors.push(`${where}: ${impressions.error}`);
      continue;
    }

    const key = `${date}|${campaignIdRaw}`;
    const costMicros = Math.round(cost * 1_000_000);
    const existing = merged.get(key);
    if (existing) {
      existing.costMicros += costMicros;
      existing.clicks += clicks.value;
      existing.impressions += impressions.value;
    } else {
      merged.set(key, {
        date,
        campaignId: campaignIdRaw,
        campaignName: cells[columns.campaignName!] ?? "",
        costMicros,
        clicks: clicks.value,
        impressions: impressions.value,
      });
    }
  }

  return { rows: [...merged.values()], errors };
}
