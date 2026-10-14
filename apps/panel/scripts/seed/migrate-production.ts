/**
 * 2026-2027 veri geçişi: hedef veritabanındaki öğrenci/lead verisini temizler ve gözden
 * geçirilmiş out/students-2026-2027.csv dosyasını yükler.
 * Tasarım: docs/superpowers/specs/2026-09-12-production-2026-2027-veri-gecisi-design.md
 *
 * KORUNAN tablolar: profiles, price_lists, price_list_items, app_settings.
 * SİLİNEN tablolar: students, leads, tasks, notifications, events (+ FK cascade ile
 * payment_plans, installments, refunds, lead_notes, appointments, offers).
 *
 * Kullanım:
 *   npx tsx scripts/seed/migrate-production.ts --env .env.production.pull            # dry-run
 *   npx tsx scripts/seed/migrate-production.ts --env .env.production.pull --apply --confirm-wipe
 *   npx tsx scripts/seed/sync-excel-payments.ts --env .env.production.pull --apply   # renk/yorum tahsilatı
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import ws from "ws";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { csvToObjects } from "./lib/csv";
import { SEASON, draftFromCsvRow, type StudentDraft } from "./lib/aidat-2026";

(globalThis as unknown as { WebSocket: typeof ws }).WebSocket = ws;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(SCRIPT_DIR, "..", "..");

/** Excel ödeme yöntemi taşımıyor; ödenmiş taksitlerde zorunlu alan olarak kullanılır. */
const PAID_METHOD = "diger";
/** Ödenmiş taksitin `paid_at` değeri: kendi vadesi, TR saatiyle öğlen. */
const paidAt = (dueDate: string) => `${dueDate}T12:00:00+03:00`;
/** Silme için "tüm satırlar" filtresi (Supabase koşulsuz delete'e izin vermez). */
const ALL_ROWS = "00000000-0000-0000-0000-000000000000";

/**
 * `students` ile `leads` arasında iki yönlü, cascade'siz FK döngüsü var:
 *   leads.converted_student_id → students   |   payment_plans.source_offer_id → offers (leads'ten cascade)
 * Döngü, silmeden önce `payment_plans.source_offer_id` boşaltılarak kırılır (bu kolonun
 * update guard'ı yok); ardından leads → offers cascade'i serbest kalır ve students silinebilir.
 */
const WIPE_TABLES = ["tasks", "notifications", "events", "leads", "students"] as const;
const KEPT_TABLES = ["profiles", "price_lists", "price_list_items", "app_settings"] as const;

function flag(name: string) {
  return process.argv.includes(name);
}
function arg(name: string, fallback?: string) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

function loadEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
    if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

/** Ad eşleştirme anahtarı: büyük/küçük ve fazla boşluk farkını yok sayar. */
function nameKey(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr");
}

const tl = (n: number) => n.toLocaleString("tr-TR");

type ExistingStudent = { id: string; full_name: string; phone: string | null; program: string | null };

async function main() {
  const apply = flag("--apply");
  const confirmWipe = flag("--confirm-wipe");
  const envFile = path.resolve(ROOT, arg("--env", ".env.local")!);
  const csvPath = path.resolve(arg("--students", path.join(SCRIPT_DIR, "out", `students-${SEASON}.csv`))!);

  if (!fs.existsSync(envFile)) throw new Error(`Ortam dosyası bulunamadı: ${envFile}`);
  if (!fs.existsSync(csvPath)) throw new Error(`CSV bulunamadı: ${csvPath}\nÖnce parse-aidat-2026.ts çalıştırın.`);

  const env = loadEnv(envFile);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(`${path.basename(envFile)}: NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli`);
  }
  const db: SupabaseClient = createClient(url, serviceKey, { auth: { persistSession: false } });

  console.log("=== migrate-production ===");
  console.log(`Hedef   : ${url}`);
  console.log(`Ortam   : ${path.relative(ROOT, envFile)}`);
  console.log(`CSV     : ${path.relative(ROOT, csvPath)}`);
  console.log(`Mod     : ${apply ? "GERÇEK UYGULAMA" : "DRY-RUN (hiçbir şey yazılmaz)"}`);
  console.log(`Sezon   : ${SEASON}\n`);

  // ---- 1. Yüklenecek veriyi hazırla ----
  const rows = csvToObjects(fs.readFileSync(csvPath, "utf8"));
  const drafts = rows
    .map((r, i) => draftFromCsvRow(r, i + 2))
    .filter((d): d is StudentDraft => d !== null);
  if (drafts.length === 0) throw new Error("CSV'de yüklenecek satır yok");

  const dupes = [...new Map<string, number>(
    drafts.map((d) => [nameKey(d.fullName), drafts.filter((x) => nameKey(x.fullName) === nameKey(d.fullName)).length]),
  )].filter(([, n]) => n > 1);
  if (dupes.length) throw new Error(`CSV'de mükerrer öğrenci adı: ${dupes.map(([k]) => k).join(", ")}`);

  // ---- 2. Yönetici profili (ödenmiş taksitlerde marked_by zorunlu) ----
  const { data: admins, error: adminErr } = await db
    .from("profiles").select("id, full_name").eq("role", "yonetici").eq("is_active", true).limit(1);
  if (adminErr) throw new Error(`profiles okunamadı: ${adminErr.message}`);
  const admin = admins?.[0] as { id: string; full_name: string } | undefined;
  const paidInstallmentCount = drafts.reduce(
    (a, d) => a + d.plans.reduce((b, p) => b + p.installments.filter((i) => i.paid).length, 0), 0,
  );
  if (!admin && paidInstallmentCount > 0) {
    throw new Error("Aktif yönetici profili yok — ödenmiş taksitler için marked_by zorunlu.");
  }
  if (admin) console.log(`Ödemeleri işaretleyen: ${admin.full_name} (${admin.id})`);

  // ---- 3. Mevcut veriyi snapshot'la ----
  const { data: existingRaw, error: exErr } = await db
    .from("students").select("id, full_name, phone, program");
  if (exErr) throw new Error(`students okunamadı: ${exErr.message}`);
  const existing = (existingRaw ?? []) as ExistingStudent[];
  const snapshot = new Map(existing.map((s) => [nameKey(s.full_name), s]));

  const csvKeys = new Set(drafts.map((d) => nameKey(d.fullName)));
  const dropped = existing.filter((s) => !csvKeys.has(nameKey(s.full_name)));
  const carriedPhones = drafts.filter((d) => snapshot.get(nameKey(d.fullName))?.phone);
  const carriedPrograms = drafts.filter((d) => snapshot.get(nameKey(d.fullName))?.program);

  console.log(`\nMevcut öğrenci: ${existing.length} → yeni liste: ${drafts.length}`);
  console.log(`Taşınan telefon: ${carriedPhones.length} | taşınan program: ${carriedPrograms.length}`);
  if (dropped.length) {
    console.log(`\nUYARI — DB'de olup Excel listesinde OLMAYAN ${dropped.length} öğrenci silinecek:`);
    for (const s of dropped) console.log(`  ${s.full_name}`);
  }

  const planTotals = new Map<string, { count: number; total: number }>();
  let instTotal = 0;
  for (const d of drafts) {
    for (const p of d.plans) {
      const cur = planTotals.get(p.itemType) ?? { count: 0, total: 0 };
      planTotals.set(p.itemType, { count: cur.count + 1, total: cur.total + p.totalTl });
      instTotal += p.installments.length;
    }
  }
  console.log(`\nYüklenecek: öğrenci=${drafts.length}, plan=${[...planTotals.values()].reduce((a, v) => a + v.count, 0)}, taksit=${instTotal} (ödenmiş=${paidInstallmentCount})`);
  for (const [type, v] of planTotals) console.log(`  ${type.padEnd(8)} adet=${v.count} toplam=${tl(v.total)} ₺`);

  const noProgram = drafts.filter((d) => !d.guessedProgram && !snapshot.get(nameKey(d.fullName))?.program);
  const noPlan = drafts.filter((d) => d.plans.length === 0);
  if (noProgram.length) console.log(`\nProgramsız kalacak: ${noProgram.map((d) => d.fullName).join(", ")}`);
  if (noPlan.length) console.log(`Hiç planı olmayacak: ${noPlan.map((d) => d.fullName).join(", ")}`);

  if (!apply) {
    console.log("\nSilinecek tablolar:", WIPE_TABLES.join(", "));
    console.log("Korunacak tablolar:", KEPT_TABLES.join(", "));
    console.log("\nDRY-RUN — hiçbir şey değişmedi.");
    console.log("Uygulamak için: --apply --confirm-wipe");
    return;
  }
  if (!confirmWipe) throw new Error("--apply için --confirm-wipe de gerekli (veri silinecek).");

  // ---- 4. Yedek: silinecek her şeyi diske al (geri dönüş için) ----
  const backup: Record<string, unknown> = { takenAt: new Date().toISOString(), target: url };
  for (const table of [...WIPE_TABLES, "payment_plans", "installments", "refunds", "lead_notes", "appointments", "offers"]) {
    const { data, error } = await db.from(table).select("*");
    if (error) throw new Error(`${table} yedeklenemedi: ${error.message}`);
    backup[table] = data;
  }
  const backupPath = path.join(SCRIPT_DIR, "out", `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), "utf8");
  console.log(`\nYedek alındı: ${path.relative(ROOT, backupPath)}`);

  // ---- 5. Temizlik ----
  console.log("\n--- Temizlik ---");
  const { error: unlinkErr } = await db
    .from("payment_plans").update({ source_offer_id: null }).not("source_offer_id", "is", null);
  if (unlinkErr) throw new Error(`payment_plans.source_offer_id boşaltılamadı: ${unlinkErr.message}`);
  console.log("  payment_plans.source_offer_id boşaltıldı (FK döngüsü kırıldı)");

  for (const table of WIPE_TABLES) {
    const { error } = await db.from(table).delete().neq("id", ALL_ROWS);
    if (error) throw new Error(`${table} silinemedi: ${error.message}`);
    const { count } = await db.from(table).select("*", { count: "exact", head: true });
    console.log(`  ${table.padEnd(15)} silindi (kalan: ${count})`);
  }

  // ---- 6. Yükleme ----
  console.log("\n--- Yükleme ---");
  let students = 0, plans = 0, installments = 0;
  const eventRows: Record<string, unknown>[] = [];

  for (const d of drafts) {
    const prev = snapshot.get(nameKey(d.fullName));
    const program = prev?.program ?? d.guessedProgram;
    const programSource = prev?.program ? "mevcut kayıt" : d.guessedProgram ? "tutardan tahmin" : "yok";

    const { data: studentRow, error: sErr } = await db.from("students").insert({
      full_name: d.fullName,
      parent_name: d.parentName,
      phone: prev?.phone ?? null,
      season: SEASON,
      program,
      status: "aktif",
    }).select("id").single();
    if (sErr) throw new Error(`student insert (satır ${d.sourceRow} ${d.fullName}): ${sErr.message}`);
    students++;

    for (const plan of d.plans) {
      const { data: planRow, error: pErr } = await db.from("payment_plans").insert({
        student_id: studentRow.id,
        season: SEASON,
        item_type: plan.itemType,
        total_amount: plan.totalTl,
        installment_count: plan.installmentCount,
      }).select("id").single();
      if (pErr) throw new Error(`plan insert (${d.fullName}/${plan.itemType}): ${pErr.message}`);
      plans++;

      const instRows = plan.installments.map((i) =>
        i.paid
          ? {
              plan_id: planRow.id, due_date: i.dueDate, amount: i.amountTl, status: "odendi",
              paid_at: paidAt(i.dueDate), paid_amount: i.amountTl,
              payment_method: PAID_METHOD, marked_by: admin!.id,
            }
          : { plan_id: planRow.id, due_date: i.dueDate, amount: i.amountTl, status: "bekliyor" },
      );
      const { error: iErr } = await db.from("installments").insert(instRows);
      if (iErr) throw new Error(`installments insert (${d.fullName}/${plan.itemType}): ${iErr.message}`);
      installments += instRows.length;
    }

    // students tablosunda not alanı yok — kaynak izi ve uyarılar event'e yazılır.
    eventRows.push({
      entity_type: "student", entity_id: studentRow.id, event_type: "seed_import",
      actor_id: admin?.id ?? null,
      payload: {
        source: "aidat-2026-2027.xlsx", source_row: d.sourceRow, mode: d.mode,
        program_source: programSource, phone_source: prev?.phone ? "mevcut kayıt" : "yok",
        notes: d.notes,
      },
    });
    if (students % 10 === 0) console.log(`  ${students}/${drafts.length} öğrenci…`);
  }

  const { error: evErr } = await db.from("events").insert(eventRows);
  if (evErr) throw new Error(`events insert: ${evErr.message}`);
  await db.from("events").insert({
    entity_type: "student", entity_id: crypto.randomUUID(), event_type: "seed_import",
    actor_id: admin?.id ?? null,
    payload: { summary: true, season: SEASON, students, plans, installments, paid: paidInstallmentCount },
  });

  console.log(`\nYüklendi — öğrenci: ${students}, plan: ${plans}, taksit: ${installments}`);

  // ---- 7. Doğrulama ----
  console.log("\n--- Doğrulama ---");
  for (const table of [...WIPE_TABLES, "payment_plans", "installments", ...KEPT_TABLES]) {
    const { count } = await db.from(table).select("*", { count: "exact", head: true });
    console.log(`  ${table.padEnd(18)} ${count}`);
  }
  const { data: paid } = await db.from("installments").select("amount").eq("status", "odendi");
  const { data: pending } = await db.from("installments").select("amount").eq("status", "bekliyor");
  const sum = (xs: { amount: number }[] | null) => (xs ?? []).reduce((a, x) => a + Number(x.amount), 0);
  console.log(`  ödendi: ${paid?.length ?? 0} taksit / ${tl(sum(paid))} ₺`);
  console.log(`  bekliyor: ${pending?.length ?? 0} taksit / ${tl(sum(pending))} ₺`);
}

main().catch((e) => {
  console.error(`\nHATA: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
