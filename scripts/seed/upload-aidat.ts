/**
 * out/students-2026-2027.csv → Supabase (service role). Varsayılan DRY-RUN.
 * Yalnız insan onayından SONRA ve doğru ortama (yerel) çalıştırılır — spec §9.3.
 *
 * Kullanım:
 *   npx tsx scripts/seed/upload-aidat.ts --dry-run
 *   npx tsx scripts/seed/upload-aidat.ts            # gerçek yükleme (yerel)
 *   npx tsx scripts/seed/upload-aidat.ts --students <path>
 *
 * Yeniden çalıştırma güvenli: öğrenci telefon+ad ile, plan season+item_type ile atlanır.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import ws from "ws";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { csvToObjects } from "./lib/csv";
import { buildImportPlan } from "./lib/aidat-upload";

(globalThis as unknown as { WebSocket: typeof ws }).WebSocket = ws;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const envLocalPath = path.join(SCRIPT_DIR, "..", "..", ".env.local");
if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath });

function flag(name: string) { return process.argv.includes(name); }
function value(name: string) { const i = process.argv.indexOf(name); return i !== -1 ? process.argv[i + 1] : null; }

function studentKey(phone: string, fullName: string) {
  return `${phone}::${fullName.trim().toLocaleLowerCase("tr")}`;
}

async function main() {
  const dryRun = flag("--dry-run");
  const studentsPath = value("--students") ?? path.join(SCRIPT_DIR, "out", "students-2026-2027.csv");
  if (!fs.existsSync(studentsPath)) { console.error(`CSV bulunamadı: ${studentsPath}`); process.exit(1); }

  const { units, skipped } = buildImportPlan(csvToObjects(fs.readFileSync(studentsPath, "utf8")));

  console.log("=== upload-aidat özet ===");
  console.log(`Mod: ${dryRun ? "DRY RUN (DB'ye yazılmayacak)" : "GERÇEK YÜKLEME (yerel)"}`);
  console.log(`Öğrenci: yüklenecek=${units.length} atlanacak=${skipped.length}`);
  for (const s of skipped) console.log(`  [satır ${s.row}] ${s.reason}`);
  const planCount = units.reduce((a, u) => a + u.plans.length, 0);
  const instCount = units.reduce((a, u) => a + u.plans.reduce((b, p) => b + p.installments.length, 0), 0);
  console.log(`Plan: ${planCount} | Taksit: ${instCount}`);

  if (dryRun) { console.log("\nDry-run: DB'ye hiçbir şey yazılmadı."); return; }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) { console.error("NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli."); process.exit(1); }
  const db: SupabaseClient = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Önceki seed uyarısı (engellemez)
  const { data: prev } = await db.from("events").select("id").eq("event_type", "seed_import").eq("entity_type", "student").limit(1);
  if (prev && prev.length) console.warn("UYARI: daha önce bir student seed_import event'i var — telefon+ad ve season+item_type kontrolleri tekrarı önler.");

  // Mevcut öğrenci anahtarları
  const { data: existingStudents, error: sErr } = await db.from("students").select("id, phone, full_name");
  if (sErr) throw new Error(`öğrenciler okunamadı: ${sErr.message}`);
  const keyToId = new Map<string, string>();
  for (const r of (existingStudents ?? []) as { id: string; phone: string; full_name: string }[]) {
    keyToId.set(studentKey(r.phone, r.full_name), r.id);
  }

  let insertedStudents = 0, insertedPlans = 0, insertedInst = 0;
  for (const u of units) {
    let studentId = keyToId.get(studentKey(u.student.phone, u.student.full_name));
    if (!studentId) {
      const { data, error } = await db.from("students").insert(u.student).select("id").single();
      if (error) throw new Error(`student insert (satır ${u.source_row}): ${error.message}`);
      studentId = data.id as string;
      insertedStudents++;
    }
    // Bu öğrencinin bu season'daki mevcut planlarının item_type'ları
    const { data: existingPlans } = await db.from("payment_plans")
      .select("item_type").eq("student_id", studentId).eq("season", u.student.season);
    const have = new Set((existingPlans ?? []).map((p: { item_type: string }) => p.item_type));

    for (const plan of u.plans) {
      if (have.has(plan.item_type)) continue; // yeniden çalıştırma: atla
      const { data: planRow, error: pErr } = await db.from("payment_plans").insert({
        student_id: studentId, season: u.student.season, item_type: plan.item_type,
        total_amount: plan.total_amount, installment_count: plan.installment_count,
      }).select("id").single();
      if (pErr) throw new Error(`plan insert (satır ${u.source_row}, ${plan.item_type}): ${pErr.message}`);
      insertedPlans++;
      const instRows = plan.installments.map((i) => ({ plan_id: planRow.id, due_date: i.due_date, amount: i.amount, status: i.status }));
      const { error: iErr } = await db.from("installments").insert(instRows);
      if (iErr) throw new Error(`installments insert (satır ${u.source_row}, ${plan.item_type}): ${iErr.message}`);
      insertedInst += instRows.length;
    }
  }

  // Tek işaret event'i (tarihi veri — satır başına event yok)
  await db.from("events").insert({
    entity_type: "student", entity_id: crypto.randomUUID(), event_type: "seed_import",
    payload: { seed: true, source: "aidat-2026-2027", count: insertedStudents },
  });

  console.log(`\nYüklendi — öğrenci: ${insertedStudents}, plan: ${insertedPlans}, taksit: ${insertedInst}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
