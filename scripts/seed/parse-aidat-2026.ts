/**
 * "2026 - 2027" sayfasını okuyup insan onayı için out/students-2026-2027.csv üretir.
 * DB'ye YAZMAZ. Akış: parse → onay → migrate-production.
 *
 * Kullanım:
 *   npx tsx scripts/seed/parse-aidat-2026.ts --input "<path>/…AİDAT LİSTESİ.xlsx"
 *   npx tsx scripts/seed/parse-aidat-2026.ts --input <path> --sheet "2026 - 2027" --out <path>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import xlsx from "xlsx";
import { toCsv } from "./lib/csv";
import {
  CSV_HEADER,
  PLAN_MONTH_LABELS,
  SEASON,
  SHEET_NAME,
  buildStudentDrafts,
  draftToCsvRow,
  type Cell,
  type StudentDraft,
} from "./lib/aidat-2026";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

function main() {
  const input = arg("--input");
  if (!input) {
    console.error('Kullanım: npx tsx scripts/seed/parse-aidat-2026.ts --input "<xlsx yolu>"');
    process.exit(1);
  }
  if (!fs.existsSync(input)) {
    console.error(`Dosya bulunamadı: ${input}`);
    process.exit(1);
  }
  const sheetName = arg("--sheet", SHEET_NAME)!;
  const outPath = arg("--out", path.join(SCRIPT_DIR, "out", `students-${SEASON}.csv`))!;

  const wb = xlsx.readFile(input, { cellDates: false });
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    console.error(`"${sheetName}" sayfası yok. Mevcut sayfalar: ${wb.SheetNames.join(", ")}`);
    process.exit(1);
  }

  const rows = xlsx.utils.sheet_to_json<Cell[]>(sheet, { header: 1, defval: null, blankrows: true });
  const drafts = buildStudentDrafts(rows.slice(1), 2);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, toCsv(CSV_HEADER, drafts.map(draftToCsvRow)), "utf8");

  // ---- Rapor (kişisel veri: sadece öğrenci adı; telefon bu dosyada yok) ----
  const byMode = (mode: StudentDraft["mode"]) => drafts.filter((d) => d.mode === mode);
  const planCount = drafts.reduce((a, d) => a + d.plans.length, 0);
  const instCount = drafts.reduce(
    (a, d) => a + d.plans.reduce((b, p) => b + p.installments.length, 0),
    0,
  );
  const paidCount = drafts.reduce(
    (a, d) => a + d.plans.reduce((b, p) => b + p.installments.filter((i) => i.paid).length, 0),
    0,
  );
  const sum = (t: "aidat" | "kitap") =>
    drafts.reduce((a, d) => a + (d.plans.find((p) => p.itemType === t)?.totalTl ?? 0), 0);

  const tl = (n: number) => n.toLocaleString("tr-TR");
  console.log(`=== parse-aidat-2026 — "${sheetName}" ===`);
  console.log(`Kaynak: ${path.basename(input)}`);
  console.log(`Öğrenci: ${drafts.length} (aylık=${byMode("aylik").length}, yıllık peşin=${byMode("yillik").length}, tutarsız=${byMode("yok").length})`);
  console.log(`Plan: ${planCount} | Taksit: ${instCount} | Ödenmiş işaretlenecek (Eylül): ${paidCount}`);
  console.log(`Aidat toplamı: ${tl(sum("aidat"))} ₺ | Kitap toplamı: ${tl(sum("kitap"))} ₺`);

  const noAidat = drafts.filter((d) => !d.plans.some((p) => p.itemType === "aidat"));
  const noKitap = drafts.filter((d) => !d.plans.some((p) => p.itemType === "kitap"));
  const noProgram = drafts.filter((d) => d.guessedProgram === null);
  const noParent = drafts.filter((d) => !d.parentName);
  console.log(`\nEksik: aidat planı=${noAidat.length}, kitap planı=${noKitap.length}, program tahmini=${noProgram.length}, veli adı=${noParent.length}`);
  for (const d of noAidat) console.log(`  [satır ${d.sourceRow}] aidat planı yok: ${d.fullName}`);
  for (const d of noKitap) console.log(`  [satır ${d.sourceRow}] kitap planı yok: ${d.fullName}`);

  const withNotes = drafts.filter((d) => d.notes.length);
  console.log(`\nNotlu satır: ${withNotes.length}`);
  for (const d of withNotes) console.log(`  [satır ${d.sourceRow}] ${d.fullName} — ${d.notes.join(" | ")}`);

  const varying = drafts.filter((d) => {
    const vals = d.monthlyAmounts.filter((v): v is number => v !== null);
    return vals.length > 1 && new Set(vals).size > 1;
  });
  console.log(`\nAylık tutarı yıl içinde değişen: ${varying.length}`);
  for (const d of varying) {
    console.log(`  [satır ${d.sourceRow}] ${d.fullName} — ${PLAN_MONTH_LABELS.map((l, i) => `${l}=${d.monthlyAmounts[i]}`).join(" ")}`);
  }

  console.log(`\nCSV yazıldı: ${outPath}`);
  console.log("Gözden geçirip onayladıktan sonra: npx tsx scripts/seed/migrate-production.ts --env <ortam> --dry-run");
}

main();
