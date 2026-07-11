/**
 * Task 16 / Step 3 — `out/leads.csv` ve `out/students.csv` dosyalarını okuyup
 * Supabase'e (service role ile) yükler. Bu script yalnızca insan onayından SONRA,
 * ve yalnızca doğru ortama (asla üretime otomatik değil — spec §9.3) çalıştırılır.
 *
 * Kullanım:
 *   npx tsx scripts/seed/upload.ts --dry-run
 *   npx tsx scripts/seed/upload.ts --assigned-to <danisman-uuid>
 *   npx tsx scripts/seed/upload.ts --assigned-to <uuid> --leads out/leads.csv --students out/students.csv
 *   npx tsx scripts/seed/upload.ts --skip-students --assigned-to <uuid>
 *
 * Ortam değişkenleri (asla kod içine yazılmaz):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   (.env.local varsa otomatik yüklenir — tests/rls/helpers.ts ile aynı desen)
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import ws from "ws";
import { createClient } from "@supabase/supabase-js";
import { normalizeTurkishPhone } from "../../lib/phone";
import { LEAD_SOURCES, LEAD_STATUSES, LOST_REASONS, PROGRAMS, STUDENT_STATUSES } from "../../lib/constants";
import { csvToObjects } from "./lib/csv";

// Node <22 native WebSocket taşımaz; supabase-js realtime client init sırasında
// gerektiriyor (bkz. tests/setup-ws.ts — aynı desen).
(globalThis as unknown as { WebSocket: typeof ws }).WebSocket = ws;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

const envLocalPath = path.join(SCRIPT_DIR, "..", "..", ".env.local");
if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath });

// ---------------------------------------------------------------------------
// CLI argümanları
// ---------------------------------------------------------------------------

type Options = {
  dryRun: boolean;
  assignedTo: string | null;
  leadsPath: string;
  studentsPath: string;
  skipLeads: boolean;
  skipStudents: boolean;
};

function flag(argv: string[], name: string): boolean {
  return argv.includes(name);
}
function value(argv: string[], name: string): string | null {
  const i = argv.indexOf(name);
  return i !== -1 ? (argv[i + 1] ?? null) : null;
}

function parseArgs(argv: string[]): Options {
  return {
    dryRun: flag(argv, "--dry-run"),
    assignedTo: value(argv, "--assigned-to"),
    leadsPath: value(argv, "--leads") ?? path.join(SCRIPT_DIR, "out", "leads.csv"),
    studentsPath: value(argv, "--students") ?? path.join(SCRIPT_DIR, "out", "students.csv"),
    skipLeads: flag(argv, "--skip-leads"),
    skipStudents: flag(argv, "--skip-students"),
  };
}

// ---------------------------------------------------------------------------
// Doğrulama yardımcıları — CSV'deki telefonlar üretim sırasında zaten E.164
// olmalı ama burada yeniden doğrulanır; geçersiz satır DB'ye YAZILMAZ, atlanıp
// raporlanır (crash etmez).
// ---------------------------------------------------------------------------

function toIntOrNull(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isInteger(n) ? n : null;
}

function validMonth(n: number | null): boolean {
  return n === null || (n >= 1 && n <= 12);
}
function validYear(n: number | null): boolean {
  return n === null || (n >= 2010 && n <= 2035);
}

type SkipReport = { row: number; reason: string };

// ---------------------------------------------------------------------------
// leads.csv -> public.leads
// ---------------------------------------------------------------------------

function buildLeadInserts(csvText: string, assignedTo: string) {
  const objects = csvToObjects(csvText);
  const inserts: Record<string, unknown>[] = [];
  const skipped: SkipReport[] = [];

  objects.forEach((o, idx) => {
    const rowNo = idx + 2; // header + 1-index
    const phone = normalizeTurkishPhone(o.phone ?? "");
    if (!phone) return skipped.push({ row: rowNo, reason: "geçersiz telefon" });
    if (!o.parent_name?.trim()) return skipped.push({ row: rowNo, reason: "parent_name boş" });

    const source = (o.source ?? "").trim();
    if (!(source in LEAD_SOURCES)) return skipped.push({ row: rowNo, reason: `geçersiz source: ${source}` });

    const status = (o.status ?? "").trim();
    if (!(status in LEAD_STATUSES)) return skipped.push({ row: rowNo, reason: `geçersiz status: ${status}` });

    const lostReasonRaw = (o.lost_reason ?? "").trim();
    let lostReason: string | null = lostReasonRaw || null;
    if (status === "kaybedildi") {
      if (!lostReason || !(lostReason in LOST_REASONS)) lostReason = "diger";
    } else {
      lostReason = null; // constraint: status <> 'kaybedildi' olduğunda lost_reason serbest ama biz temiz tutuyoruz
    }

    const birthMonth = toIntOrNull(o.birth_month ?? "");
    const birthYear = toIntOrNull(o.birth_year ?? "");
    if (!validMonth(birthMonth)) return skipped.push({ row: rowNo, reason: `geçersiz birth_month: ${o.birth_month}` });
    if (!validYear(birthYear)) return skipped.push({ row: rowNo, reason: `geçersiz birth_year: ${o.birth_year}` });

    const firstSeenDate = (o.first_seen_date ?? "").trim();
    const timestamp = /^\d{4}-\d{2}-\d{2}$/.test(firstSeenDate) ? `${firstSeenDate}T00:00:00+03:00` : undefined;

    inserts.push({
      parent_name: o.parent_name.trim(),
      phone,
      child_name: o.child_name?.trim() || null,
      child_birth_month: birthMonth,
      child_birth_year: birthYear,
      source,
      // leads tablosunda ayrı bir "note" kolonu yok; lead_notes yalnızca insan
      // notu için (bkz. migration yorum "yalnızca insan notu"). Bu yüzden ham
      // WhatsApp metni source_detail'e yazılır (belgelenmiştir, README'ye bkz).
      source_detail: o.note?.slice(0, 2000) || null,
      status,
      lost_reason: lostReason,
      assigned_to: assignedTo,
      ...(timestamp ? { last_activity_at: timestamp, created_at: timestamp } : {}),
    });
  });

  return { inserts, skipped, total: objects.length };
}

// ---------------------------------------------------------------------------
// students.csv -> public.students
// ---------------------------------------------------------------------------

function buildStudentInserts(csvText: string) {
  const objects = csvToObjects(csvText);
  const inserts: Record<string, unknown>[] = [];
  const skipped: SkipReport[] = [];

  objects.forEach((o, idx) => {
    const rowNo = idx + 2;
    if (!o.full_name?.trim()) return skipped.push({ row: rowNo, reason: "full_name boş" });

    const phone = normalizeTurkishPhone(o.phone ?? "");
    if (!phone) return skipped.push({ row: rowNo, reason: "geçersiz telefon" });

    if (!o.parent_name?.trim()) return skipped.push({ row: rowNo, reason: "parent_name boş" });

    const program = (o.program ?? "").trim();
    if (!(program in PROGRAMS)) return skipped.push({ row: rowNo, reason: `geçersiz/boş program: "${program}"` });

    const season = (o.season ?? "").trim();
    if (!season) return skipped.push({ row: rowNo, reason: "season boş" });

    const birthMonth = toIntOrNull(o.birth_month ?? "");
    const birthYear = toIntOrNull(o.birth_year ?? "");
    if (!validMonth(birthMonth)) return skipped.push({ row: rowNo, reason: `geçersiz birth_month: ${o.birth_month}` });
    if (!validYear(birthYear)) return skipped.push({ row: rowNo, reason: `geçersiz birth_year: ${o.birth_year}` });

    const status = (o.status ?? "").trim();
    if (status && !(status in STUDENT_STATUSES)) return skipped.push({ row: rowNo, reason: `geçersiz status: ${status}` });

    const startDate = (o.start_date ?? "").trim();
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return skipped.push({ row: rowNo, reason: `geçersiz start_date: ${startDate}` });
    }

    inserts.push({
      full_name: o.full_name.trim(),
      parent_name: o.parent_name.trim(),
      phone,
      birth_month: birthMonth,
      birth_year: birthYear,
      season,
      program,
      ...(startDate ? { start_date: startDate } : {}),
      ...(status ? { status } : {}),
    });
  });

  return { inserts, skipped, total: objects.length };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  let leadsCsv = "";
  let studentsCsv = "";
  if (!opts.skipLeads) {
    if (!fs.existsSync(opts.leadsPath)) {
      console.error(`leads CSV bulunamadı: ${opts.leadsPath} (--skip-leads ile atlanabilir)`);
      process.exit(1);
    }
    leadsCsv = fs.readFileSync(opts.leadsPath, "utf-8");
  }
  if (!opts.skipStudents) {
    if (!fs.existsSync(opts.studentsPath)) {
      console.error(`students CSV bulunamadı: ${opts.studentsPath} (--skip-students ile atlanabilir)`);
      process.exit(1);
    }
    studentsCsv = fs.readFileSync(opts.studentsPath, "utf-8");
  }

  if (!opts.skipLeads && !opts.assignedTo) {
    console.error("leads yüklemek için --assigned-to <danisman-uuid> zorunlu (spec: leadler bir danışmana atanır).");
    process.exit(1);
  }

  const leadResult = opts.skipLeads
    ? { inserts: [], skipped: [], total: 0 }
    : buildLeadInserts(leadsCsv, opts.assignedTo!);
  const studentResult = opts.skipStudents
    ? { inserts: [], skipped: [], total: 0 }
    : buildStudentInserts(studentsCsv);

  console.log("=== upload.ts özet ===");
  console.log(`Mod: ${opts.dryRun ? "DRY RUN (DB'ye yazılmayacak)" : "GERÇEK YÜKLEME"}`);
  console.log(`Leads: toplam=${leadResult.total} yüklenecek=${leadResult.inserts.length} atlanacak=${leadResult.skipped.length}`);
  for (const s of leadResult.skipped.slice(0, 20)) console.log(`  [leads satır ${s.row}] ${s.reason}`);
  console.log(`Students: toplam=${studentResult.total} yüklenecek=${studentResult.inserts.length} atlanacak=${studentResult.skipped.length}`);
  for (const s of studentResult.skipped.slice(0, 20)) console.log(`  [students satır ${s.row}] ${s.reason}`);

  if (opts.dryRun) {
    console.log("\nDry-run: DB'ye hiçbir şey yazılmadı.");
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY ortam değişkenleri gerekli.");
    process.exit(1);
  }
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  if (leadResult.inserts.length > 0) {
    const { error } = await db.from("leads").insert(leadResult.inserts);
    if (error) throw new Error(`leads insert hatası: ${error.message}`);
    console.log(`leads: ${leadResult.inserts.length} satır yüklendi.`);

    // Tarihi veri: satır başına event yazılmaz — yalnızca tek bir seed işareti (brief §3).
    const { error: evError } = await db.from("events").insert({
      entity_type: "lead",
      entity_id: crypto.randomUUID(),
      event_type: "seed_import",
      actor_id: opts.assignedTo,
      payload: { seed: true, count: leadResult.inserts.length, source: "whatsapp" },
    });
    if (evError) throw new Error(`leads seed event hatası: ${evError.message}`);
  }

  if (studentResult.inserts.length > 0) {
    const { error } = await db.from("students").insert(studentResult.inserts);
    if (error) throw new Error(`students insert hatası: ${error.message}`);
    console.log(`students: ${studentResult.inserts.length} satır yüklendi.`);

    const { error: evError } = await db.from("events").insert({
      entity_type: "student",
      entity_id: crypto.randomUUID(),
      event_type: "seed_import",
      actor_id: opts.assignedTo,
      payload: { seed: true, count: studentResult.inserts.length, source: "excel" },
    });
    if (evError) throw new Error(`students seed event hatası: ${evError.message}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
