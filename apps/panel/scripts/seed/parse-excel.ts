/**
 * Task 16 / Step 2 — "DATA KAYIT 2024-2025.xlsx" dosyasını okuyup `out/students.csv`
 * üretir (insan onayı için; `upload.ts` bunları DB'ye yükler, spec §9.3).
 *
 * Kullanım:
 *   npx tsx scripts/seed/parse-excel.ts --input "<path>/00000727-DATA KAYIT 2024-2025.xlsx" [--out <path>]
 *
 * KOLON EŞLEMESİ (gerçek dosya açılıp başlıklar görüldükten sonra sabitlendi —
 * her iki kopyada (00000598 Temmuz 2024 / 00000727 Ağustos 2024) da AYNI):
 *   Satır 4 (0-index 3) başlık satırı, veri satır 5'ten (0-index 4) başlar.
 *   Sütun 0: sıra no                    -> kullanılmıyor
 *   Sütun 1: "ÖĞRENCİ ADI"               -> full_name
 *   Sütun 2: "DOĞUM TARİHİ"              -> birth_month / birth_year (bkz. parseDob)
 *   Sütun 3: "YAŞ"                       -> age_recorded (yalnızca bilgi amaçlı not)
 *   Sütun 4: "ANNE ADI "                 -> anne_adi
 *   Sütun 5: "BABA ADI "                 -> baba_adi
 *   Sütun 6: "TELEFON "                  -> phone
 *   Sütun 7-9: "ARAMA 1/2/3"             -> call_note (bilgi amaçlı, tarih serileri)
 *   Sütun 10: "SONUÇ"                    -> outcome_note
 *
 * ÖNEMLİ BULGU: Bu dosya aslında "kayıt olmuş öğrenci" listesinden çok, okulun
 * TÜM arama/ilgi kayıtlarını tutan bir çağrı takip tablosu. 230 veri satırının
 * yalnızca küçük bir kısmında ÖĞRENCİ ADI dolu (çoğu satır "ulaşıldı ama henüz
 * karar verilmedi" durumunda). Dosyada program (tam_gün/yarım_gün/...), sezon
 * veya ücret/tutar bilgisi tutan AYRI bir kolon YOK — yalnızca SONUÇ serbest
 * metninde bazen ("~14/230 satırda 'TL' geçiyor) ücret bahsi geçiyor. Bu yüzden
 * students.csv'de program/season/start_date/status kolonları BOŞ bırakılır;
 * insan onaylayıcı upload.ts'i çalıştırmadan önce bunları doldurmalı ya da o
 * satırları elemelidir (bkz. scripts/seed/README.md).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// SheetJS bir CJS modülü ve types/index.d.ts'de default export yok; ancak Node/tsx'in
// esModuleInterop'u module.exports'u default olarak sunuyor (bkz. README notu).
// Namespace import (`import * as xlsx`) tsx/esbuild altında çalışma zamanında
// `readFile` gibi metodları taşımadığından burada default import kullanılır.
import xlsx from "xlsx";
import { normalizeTurkishPhone } from "../../lib/phone";
import { toCsv } from "./lib/csv";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const HEADER_ROW_INDEX = 3; // 0-index; brief'te görülen gerçek dosyada başlık bu satırda
const DATA_START_INDEX = HEADER_ROW_INDEX + 1;

type StudentRow = {
  source_row: number;
  full_name: string;
  parent_name: string;
  phone: string;
  birth_month: number | null;
  birth_year: number | null;
  age_recorded: string;
  program: string;
  season: string;
  start_date: string;
  status: string;
  note: string;
};

function parseArgs(argv: string[]): { input: string; out: string } {
  const inputIdx = argv.indexOf("--input");
  const outIdx = argv.indexOf("--out");
  const input = inputIdx !== -1 ? argv[inputIdx + 1] : undefined;
  if (!input) {
    console.error('Kullanım: npx tsx scripts/seed/parse-excel.ts --input "<path>/DATA KAYIT ....xlsx" [--out <path>]');
    process.exit(1);
  }
  const out = outIdx !== -1 ? argv[outIdx + 1] : path.join(SCRIPT_DIR, "out", "students.csv");
  return { input, out };
}

/**
 * DOĞUM TARİHİ hücresini ay/yıl'a çevirir. Gözlenen biçimler:
 *  - Excel tarih serisi (number)             -> tam tarih
 *  - ".MM.YYYY" (gün bilgisi girilmemiş)      -> ay + yıl
 *  - "D.MM.YYYY" / "DD.MM.YYYY"                -> ay + yıl (gün yok sayılır)
 *  - "YYYY" (yalnızca yıl)                     -> yalnızca yıl
 *  - "5 yaş", "5,5 YAŞ TOPLAM" gibi serbest metin -> ayrıştırılamaz, ham metin not'ta kalır
 */
function parseDob(raw: unknown): { month: number | null; year: number | null; raw: string } {
  if (typeof raw === "number") {
    const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30);
    const d = new Date(EXCEL_EPOCH_UTC_MS + raw * 86400000);
    return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear(), raw: String(raw) };
  }
  const s = String(raw ?? "").trim();
  if (!s) return { month: null, year: null, raw: s };

  let m = s.match(/^\.(\d{1,2})\.(\d{4})$/);
  if (m) return { month: Number(m[1]), year: Number(m[2]), raw: s };

  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return { month: Number(m[2]), year: Number(m[3]), raw: s };

  m = s.match(/^(\d{4})$/);
  if (m) return { month: null, year: Number(m[1]), raw: s };

  return { month: null, year: null, raw: s };
}

function excelSerialToDateText(v: unknown): string {
  if (typeof v !== "number") return String(v ?? "").trim();
  const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30);
  const d = new Date(EXCEL_EPOCH_UTC_MS + v * 86400000);
  return d.toISOString().slice(0, 10);
}

function buildStudentRows(input: string): StudentRow[] {
  const wb = xlsx.readFile(input);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

  const out: StudentRow[] = [];
  for (let i = DATA_START_INDEX; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => c === "")) continue; // tamamen boş satırları atla

    const fullName = String(r[1] ?? "").trim();
    const { month, year, raw: dobRaw } = parseDob(r[2]);
    const ageRecorded = String(r[3] ?? "").trim();
    const anne = String(r[4] ?? "").trim();
    const baba = String(r[5] ?? "").trim();
    const phoneRaw = r[6];
    const phone = normalizeTurkishPhone(String(phoneRaw ?? "")) ?? "";
    const aramaNotes = [7, 8, 9]
      .map((idx) => excelSerialToDateText(r[idx]))
      .filter((v) => v !== "")
      .join(", ");
    const sonuc = String(r[10] ?? "").trim();

    const noteParts: string[] = [];
    if (dobRaw && month === null && year === null) noteParts.push(`dogum_tarihi_ham: ${dobRaw}`);
    if (aramaNotes) noteParts.push(`arama_tarihleri: ${aramaNotes}`);
    if (sonuc) noteParts.push(`sonuc: ${sonuc}`);

    out.push({
      source_row: i + 1, // insan gözüyle Excel'deki satır no (1-index, header dahil)
      full_name: fullName,
      parent_name: anne || baba, // brief: veli — önce anne adı, yoksa baba adı
      phone,
      birth_month: month,
      birth_year: year,
      age_recorded: ageRecorded,
      program: "", // kaynak veride yok — insan onayı sırasında doldurulmalı
      season: "", // kaynak veride yok — insan onayı sırasında doldurulmalı
      start_date: "", // kaynak veride yok
      status: "", // boşsa upload.ts DB varsayılanına (aktif) bırakır
      note: noteParts.join(" | ").slice(0, 500),
    });
  }
  return out;
}

function main() {
  const { input, out } = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(input)) {
    console.error(`Girdi dosyası bulunamadı: ${input}`);
    process.exit(1);
  }

  const rows = buildStudentRows(input);
  fs.mkdirSync(path.dirname(out), { recursive: true });

  const csv = toCsv(
    [
      "source_row", "full_name", "parent_name", "phone", "birth_month", "birth_year",
      "age_recorded", "program", "season", "start_date", "status", "note",
    ],
    rows.map((r) => [
      r.source_row, r.full_name, r.parent_name, r.phone, r.birth_month, r.birth_year,
      r.age_recorded, r.program, r.season, r.start_date, r.status, r.note,
    ]),
  );
  fs.writeFileSync(out, csv, "utf-8");

  const withName = rows.filter((r) => r.full_name !== "").length;
  const withPhone = rows.filter((r) => r.phone !== "").length;
  const withBirth = rows.filter((r) => r.birth_month !== null || r.birth_year !== null).length;

  console.log("=== parse-excel özet ===");
  console.log(`Girdi: ${input}`);
  console.log(`Toplam (boş olmayan) veri satırı: ${rows.length}`);
  console.log(`ÖĞRENCİ ADI dolu: ${withName}`);
  console.log(`Geçerli telefon: ${withPhone}`);
  console.log(`Doğum ay/yıl çözülebilen: ${withBirth}`);
  console.log(`Çıktı: ${out}`);
}

main();
