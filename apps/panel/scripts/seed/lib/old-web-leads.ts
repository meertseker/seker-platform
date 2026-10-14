import { normalizeTurkishPhone } from "@seker/shared";
import { parseCsv } from "./csv";

export type OldWebLead = {
  id: string;
  parentName: string;
  phone: string;
  landingPath: string;
  gclid: string;
  createdAt: string;
};

const REQUIRED = ["id", "parent_name", "phone", "landing_path", "gclid", "created_at"] as const;

export function parseOldWebLeads(csvText: string): {
  rows: OldWebLead[];
  rejected: { line: number; reason: string }[];
} {
  const [header, ...lines] = parseCsv(csvText).filter((r) => r.some((c) => c.trim() !== ""));
  const index = Object.fromEntries((header ?? []).map((h, i) => [h.trim(), i]));
  const missing = REQUIRED.filter((k) => index[k] === undefined);
  if (missing.length) throw new Error(`CSV başlığında eksik kolon: ${missing.join(", ")}`);

  const rows: OldWebLead[] = [];
  const rejected: { line: number; reason: string }[] = [];
  lines.forEach((cells, i) => {
    const line = i + 2;
    const get = (k: (typeof REQUIRED)[number]) => (cells[index[k]] ?? "").trim();
    const parentName = get("parent_name");
    if (parentName.length < 2) return rejected.push({ line, reason: "ad eksik" });
    const phone = normalizeTurkishPhone(get("phone"));
    if (!phone) return rejected.push({ line, reason: "geçersiz telefon" });
    const created = new Date(get("created_at").replace(" ", "T").replace(/\+00$/, "Z"));
    if (Number.isNaN(created.getTime())) return rejected.push({ line, reason: "geçersiz tarih" });
    rows.push({
      id: get("id"),
      parentName,
      phone,
      landingPath: get("landing_path"),
      gclid: get("gclid"),
      createdAt: created.toISOString(),
    });
  });
  return { rows, rejected };
}
