/**
 * Task 16 / Step 1 — WhatsApp `_chat.txt` dışa aktarımını tek seferlik lead adayı
 * CSV'sine dönüştürür. Çıktı insan onayından geçmeden `upload.ts` ile DB'ye YÜKLENMEZ
 * (spec §9.3).
 *
 * Kullanım:
 *   npx tsx scripts/seed/parse-whatsapp.ts --input "<path>/_chat.txt" [--out <path>]
 *
 * Sezgisel (heuristik) çıkarım kuralları task-16 brief'inde tanımlıdır; bu dosyadaki
 * yorumlar hangi kararın nereden geldiğini belgeler. Girdi dosyası gerçek kişisel veri
 * içerir — bu script yalnızca `out/` altına (gitignore'da) CSV üretir, repo'ya
 * hiçbir isim/telefon commit edilmez.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeTurkishPhone } from "../../lib/phone";
import { toCsv } from "./lib/csv";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

type Block = {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS
  sender: string;
  lines: string[]; // ilk satır dahil, mesajın tüm satırları
};

type LeadRow = {
  parent_name: string;
  phone: string;
  child_name: string;
  birth_month: number | null;
  birth_year: number | null;
  source: string;
  status: string;
  lost_reason: string;
  note: string;
  first_seen_date: string;
};

// ---------------------------------------------------------------------------
// CLI argümanları
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): { input: string; out: string } {
  const inputIdx = argv.indexOf("--input");
  const outIdx = argv.indexOf("--out");
  const input = inputIdx !== -1 ? argv[inputIdx + 1] : undefined;
  if (!input) {
    console.error('Kullanım: npx tsx scripts/seed/parse-whatsapp.ts --input "<path>/_chat.txt" [--out <path>]');
    process.exit(1);
  }
  const out = outIdx !== -1 ? argv[outIdx + 1] : path.join(SCRIPT_DIR, "out", "leads.csv");
  return { input, out };
}

// ---------------------------------------------------------------------------
// Satır birleştirme: [YYYY-MM-DD, HH:MM:SS] gönderen: mesaj deseniyle blok başlat,
// desene uymayan satırları önceki bloğa ekle (brief §1.1 — çok satırlı mesajlar).
// ---------------------------------------------------------------------------

const HEADER_RE = /^\[(\d{4}-\d{2}-\d{2}), (\d{2}:\d{2}:\d{2})\]\s(.+?):\s(.*)$/;

/**
 * WhatsApp export'larındaki görünmez yön işaretleri (LRM/RLM) ve BOM temizliği.
 * Kod noktası bazlı filtreleme kullanılır (kaynak dosyada görünmez unicode literal
 * tutmamak için): U+200E, U+200F, U+FEFF.
 */
function stripControlChars(line: string): string {
  let out = "";
  for (const ch of line) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0x200e || code === 0x200f || code === 0xfeff) continue;
    out += ch;
  }
  return out;
}

function readBlocks(input: string): Block[] {
  const raw = fs.readFileSync(input, "utf-8");
  const lines = raw.split(/\r\n|\n/);
  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const rawLine of lines) {
    const line = stripControlChars(rawLine);
    const m = line.match(HEADER_RE);
    if (m) {
      if (current) blocks.push(current);
      current = { date: m[1], time: m[2], sender: m[3].trim(), lines: [m[4]] };
    } else if (current) {
      current.lines.push(line);
    }
    // current === null iken desene uymayan satır (dosya başındaki bozuk satır vb.) yok sayılır.
  }
  if (current) blocks.push(current);
  return blocks;
}

// ---------------------------------------------------------------------------
// Telefon adayı tespiti (brief §1.2): regex her SATIR için ayrı denenir — bloğun
// tamamına uygulanırsa (ör. telefon satırından sonra gelen "2019 doğumlu" gibi bir
// yıl) greedy [\s\d]{7,} yanlışlıkla farklı satırlardaki rakamları birleştirebilir.
// ---------------------------------------------------------------------------

const PHONE_CANDIDATE_RE = /(\+90|0)?\s*5\d{2}[\s\d]{7,}/;

function extractPhone(block: Block): string | null {
  for (const line of block.lines) {
    const m = line.match(PHONE_CANDIDATE_RE);
    if (!m) continue;
    const normalized = normalizeTurkishPhone(m[0]);
    if (normalized) return normalized;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Alan çıkarımı (brief §1.3)
// ---------------------------------------------------------------------------

const TURKISH_MONTHS: Record<string, number> = {
  ocak: 1, şubat: 2, subat: 2, mart: 3, nisan: 4, mayıs: 5, mayis: 5,
  haziran: 6, temmuz: 7, ağustos: 8, agustos: 8, eylül: 9, eylul: 9,
  ekim: 10, kasım: 11, kasim: 11, aralık: 12, aralik: 12,
};

function extractBirth(text: string): { month: number | null; year: number | null } {
  // "2019 Şubat doğumlu" gibi: yıl + ay adı + doğumlu
  const withMonth = text.matchAll(/(\d{4})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s*(doğumlu|dogumlu)/gi);
  for (const m of withMonth) {
    const monthKey = m[2].toLocaleLowerCase("tr-TR");
    const month = TURKISH_MONTHS[monthKey];
    if (month) return { month, year: Number(m[1]) };
  }
  // Yalnızca "(\d{4}) doğumlu" (ay bilgisi yok)
  const yearOnly = text.match(/(\d{4})\s*(doğumlu|dogumlu)/i);
  if (yearOnly) return { month: null, year: Number(yearOnly[1]) };
  return { month: null, year: null };
}

function extractSource(text: string): string {
  const t = text.toLocaleLowerCase("tr-TR");
  if (t.includes("referans")) return "referans";
  if (t.includes("instagram")) return "instagram";
  if (t.includes("reklam")) return "reklam";
  return "telefon";
}

function extractLostReason(text: string): string {
  const t = text.toLocaleLowerCase("tr-TR");
  if (t.includes("uzak")) return "uzaklik";
  if (t.includes("fiyat") || t.includes("ücret") || t.includes("pahalı")) return "fiyat";
  if (t.includes("başka okul") || t.includes("başka bir okul")) return "baska_okul";
  if (t.includes("ulaşılamadı") || t.includes("cevap yok") || t.includes("cevap vermedi") || t.includes("açmadı"))
    return "ulasilamadi";
  if (t.includes("vazgeç")) return "vazgecti";
  return "diger";
}

function extractStatus(text: string): { status: string; lostReason: string; uncertain: boolean } {
  const t = text.toLocaleLowerCase("tr-TR");
  if (t.includes("kayıt oldu") || t.includes("kayda geldi") || t.includes("kayit oldu")) {
    return { status: "kazanildi", lostReason: "", uncertain: false };
  }
  if (t.includes("randevu") || t.includes("görüşme") || t.includes("gorusme")) {
    return { status: "gorusme_yapildi", lostReason: "", uncertain: false };
  }
  return { status: "kaybedildi", lostReason: extractLostReason(text), uncertain: true };
}

// ---------------------------------------------------------------------------
// Numaraya göre dedupe + birleştirme (brief §1.2: "aynı numara tekrarlarını en
// zengin blokta birleştir"). Yorum: aynı telefonla ilgili tüm bloklar kronolojik
// sırayla birleştirilip (en zengin/toplam bilgiyi taşıyan metin budur), alan
// çıkarımı bu birleşik metin üzerinden yapılır; parent_name ise İLK (en erken)
// bloğun ilk satırından alınır — genelde veli ismi ilk temasta paylaşılır.
// ---------------------------------------------------------------------------

function buildLeadRows(blocks: Block[]): { rows: LeadRow[]; totalCandidates: number } {
  const groups = new Map<string, { block: Block; text: string }[]>();
  let totalCandidates = 0;

  for (const block of blocks) {
    const phone = extractPhone(block);
    if (!phone) continue;
    totalCandidates++;
    const text = block.lines.join("\n");
    const arr = groups.get(phone) ?? [];
    arr.push({ block, text });
    groups.set(phone, arr);
  }

  const rows: LeadRow[] = [];
  for (const [phone, entries] of groups) {
    // Dosyadaki sıra zaten kronolojiktir (WhatsApp export'u tarih sırasıyla yazar).
    const combinedText = entries.map((e) => e.text).join("\n---\n");
    const firstEntry = entries[0];
    const firstLine = firstEntry.block.lines[0]?.trim() ?? "";

    const { month, year } = extractBirth(combinedText);
    const source = extractSource(combinedText);
    const { status, lostReason, uncertain } = extractStatus(combinedText);

    let note = combinedText.slice(0, 500);
    if (uncertain) note = `seed: durum belirsiz | ${note}`;

    rows.push({
      parent_name: firstLine,
      phone,
      child_name: "", // brief'te heuristik tanımlanmamış; insan incelemesinde doldurulur
      birth_month: month,
      birth_year: year,
      source,
      status,
      lost_reason: status === "kaybedildi" ? lostReason : "",
      note,
      first_seen_date: firstEntry.block.date,
    });
  }

  return { rows, totalCandidates };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main() {
  const { input, out } = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(input)) {
    console.error(`Girdi dosyası bulunamadı: ${input}`);
    process.exit(1);
  }

  const blocks = readBlocks(input);
  const { rows, totalCandidates } = buildLeadRows(blocks);

  fs.mkdirSync(path.dirname(out), { recursive: true });
  const csv = toCsv(
    ["parent_name", "phone", "child_name", "birth_month", "birth_year", "source", "status", "lost_reason", "note", "first_seen_date"],
    rows.map((r) => [
      r.parent_name, r.phone, r.child_name, r.birth_month, r.birth_year,
      r.source, r.status, r.lost_reason, r.note, r.first_seen_date,
    ]),
  );
  fs.writeFileSync(out, csv, "utf-8");

  const statusDist = new Map<string, number>();
  for (const r of rows) statusDist.set(r.status, (statusDist.get(r.status) ?? 0) + 1);

  console.log("=== parse-whatsapp özet ===");
  console.log(`Toplam blok (mesaj): ${blocks.length}`);
  console.log(`Telefon adayı blok: ${totalCandidates}`);
  console.log(`Benzersiz numara (satır sayısı): ${rows.length}`);
  console.log("Statü dağılımı:");
  for (const [status, count] of statusDist) console.log(`  ${status}: ${count}`);
  console.log(`Çıktı: ${out}`);
}

main();
