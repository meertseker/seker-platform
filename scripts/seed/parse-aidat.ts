/**
 * Aidat çalışma kitabının "2026 - 2027" sayfasını okuyup insan onayı için
 * out/students-2026-2027.csv üretir. DB'ye YAZMAZ (spec §9.3 akışı: parse→onay→upload).
 *
 * Kullanım:
 *   npx tsx scripts/seed/parse-aidat.ts --input "<path>/…AİDAT LİSTESİ.xlsx" [--sheet "2026 - 2027"] [--out <path>]
 *
 * Telefon: geçmiş kaynaklardan (leads/students csv, DATA KAYIT xlsx, .vcf, _chat.txt)
 * skorlanır; güven etiketi ile yazılır. Orta/düşük güven insan tarafından doğrulanmalı.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import xlsx from "xlsx";
import { normalizeTurkishPhone } from "../../lib/phone";
import { toCsv } from "./lib/csv";
import { buildRosterRow } from "./lib/aidat-parse";
import {
  normalizeName, buildQuery, scorePhone, type PoolEntry, type ChatBlock,
} from "./lib/phone-recovery";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

// ---- Telefon havuzu: mevcut yerel kaynaklardan (kişisel veri LOG'lanmaz) ----
function loadPool(whatsappDir: string, seedOutDir: string): { pool: PoolEntry[]; chat: ChatBlock[] } {
  const pool: PoolEntry[] = [];
  const push = (name: unknown, rawPhone: unknown, source: string) => {
    const phone = normalizeTurkishPhone(String(rawPhone ?? ""));
    const nm = normalizeName(String(name ?? ""));
    if (phone && nm) pool.push({ name: nm, phone, source });
  };

  // seed CSV'leri (varsa)
  for (const [file, cols] of [["students.csv", ["full_name", "parent_name"]], ["leads.csv", ["child_name", "parent_name"]]] as const) {
    const p = path.join(seedOutDir, file);
    if (!fs.existsSync(p)) continue;
    const lines = fs.readFileSync(p, "utf8").split(/\r?\n/).filter(Boolean);
    const header = lines[0].split(",");
    for (const line of lines.slice(1)) {
      const cells = line.split(","); // out CSV'leri basit; tırnaklı alan yoksa yeterli
      const rec: Record<string, string> = {};
      header.forEach((h, i) => (rec[h] = cells[i] ?? ""));
      for (const c of cols) push(rec[c], rec.phone, `${file}/${c}`);
    }
  }

  // DATA KAYIT xlsx'leri: col1 ad, col4 anne, col5 baba, col6 telefon
  if (fs.existsSync(whatsappDir)) {
    for (const f of fs.readdirSync(whatsappDir).filter((x) => /DATA KAYIT.*\.xlsx$/i.test(x))) {
      const wb = xlsx.readFile(path.join(whatsappDir, f));
      const rows = xlsx.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
      for (let i = 4; i < rows.length; i++) {
        const r = rows[i]; if (!r) continue;
        push(r[1], r[6], f); push(r[4], r[6], f); push(r[5], r[6], f);
      }
    }
    // .vcf kartları: FN + TEL
    for (const f of fs.readdirSync(whatsappDir).filter((x) => x.toLowerCase().endsWith(".vcf"))) {
      const t = fs.readFileSync(path.join(whatsappDir, f), "utf8");
      const fn = (t.match(/FN[^:]*:(.+)/) || [])[1] || f.replace(/\.vcf$/i, "");
      for (const m of t.matchAll(/TEL[^:]*:(.+)/g)) push(fn, m[1], `vcf`);
    }
  }

  // _chat.txt: mesaj bloklarını çıkar, blok metni + içindeki telefonlar
  const chat: ChatBlock[] = [];
  const chatPath = path.join(whatsappDir, "_chat.txt");
  if (fs.existsSync(chatPath)) {
    const lines = fs.readFileSync(chatPath, "utf8").split(/\r?\n/);
    const lineRe = /^\[[^\]]+\]\s*([^:]+):\s*(.*)$/;
    let cur: { sender: string; text: string } | null = null;
    const blocks: { sender: string; text: string }[] = [];
    for (const line of lines) {
      const m = line.match(lineRe);
      if (m) { if (cur) blocks.push(cur); cur = { sender: m[1], text: m[2] }; }
      else if (cur) cur.text += "\n" + line;
    }
    if (cur) blocks.push(cur);
    for (const b of blocks) {
      const phones = new Set<string>();
      for (const m of b.text.matchAll(/(?:\+?90|0)?\s*5\d{2}[\s\d]{7,}/g)) {
        const p = normalizeTurkishPhone(m[0]); if (p) phones.add(p);
      }
      const sp = normalizeTurkishPhone(b.sender); if (sp) phones.add(sp);
      if (phones.size) chat.push({ text: normalizeName(`${b.sender} ${b.text}`), phones: [...phones] });
    }
  }
  return { pool, chat };
}

function main() {
  const input = arg("--input");
  if (!input) {
    console.error('Kullanım: npx tsx scripts/seed/parse-aidat.ts --input "<path>/…AİDAT LİSTESİ.xlsx" [--sheet "2026 - 2027"] [--out <path>]');
    process.exit(1);
  }
  if (!fs.existsSync(input)) { console.error(`Girdi bulunamadı: ${input}`); process.exit(1); }
  const sheet = arg("--sheet", "2026 - 2027")!;
  const out = arg("--out", path.join(SCRIPT_DIR, "out", "students-2026-2027.csv"))!;

  const wb = xlsx.readFile(input);
  if (!wb.Sheets[sheet]) { console.error(`Sayfa bulunamadı: "${sheet}". Mevcut: ${wb.SheetNames.join(", ")}`); process.exit(1); }
  const rows = xlsx.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], { header: 1, defval: "" });

  const repoRoot = path.join(SCRIPT_DIR, "..", "..");
  const { pool, chat } = loadPool(path.join(repoRoot, "..", "whatsapp_export"), path.join(SCRIPT_DIR, "out"));

  const outRows: (string | number | null)[][] = [];
  let matched = 0;
  for (let i = 1; i < rows.length; i++) {
    const rr = buildRosterRow(rows[i], i + 1);
    if (!rr) continue;
    const q = buildQuery(rr.full_name, rr.parent_name);
    const m = scorePhone(q, pool, chat);
    if (m) matched++;
    outRows.push([
      rr.source_row, rr.full_name, rr.parent_name,
      m?.phone ?? "", m?.confidence ?? "", m?.source ?? "",
      rr.program ?? "", rr.program_note, rr.season,
      rr.aidat_monthly ?? "", rr.servis_monthly ?? "", rr.kitap_amount ?? "", rr.note,
    ]);
  }

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, toCsv(
    ["source_row", "full_name", "parent_name", "phone", "phone_confidence", "phone_source",
     "program", "program_note", "season", "aidat_monthly", "servis_monthly", "kitap_amount", "note"],
    outRows,
  ), "utf-8");

  console.log("=== parse-aidat özet ===");
  console.log(`Girdi: ${input} | Sayfa: ${sheet}`);
  console.log(`Öğrenci satırı: ${outRows.length}`);
  console.log(`Telefon eşleşen: ${matched} | eşleşmeyen: ${outRows.length - matched}`);
  console.log(`Çıktı: ${out}`);
  console.log("Sonraki adım: CSV'yi elle gözden geçir (eksik telefon/program/aidat), sonra upload-aidat.ts --dry-run.");
}

main();
