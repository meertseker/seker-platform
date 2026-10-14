/**
 * Minimal CSV yardımcıları (RFC4180 alt kümesi): parse-whatsapp.ts, parse-excel.ts ve
 * upload.ts arasında paylaşılır. Harici bağımlılık gerektirmez.
 */

export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [header.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(row.map((v) => csvEscape(v === null || v === undefined ? "" : String(v))).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

/** Basit bir RFC4180 parser: tırnaklı alanlarda virgül/newline/çift-tırnak destekler. */
export function parseCsv(text: string): string[][] {
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const s = withoutBom;

  while (i < s.length) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

export function csvToObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => {
      obj[h] = r[idx] ?? "";
    });
    return obj;
  });
}
