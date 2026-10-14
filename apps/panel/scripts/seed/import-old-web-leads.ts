/**
 * Eski site veritabanındaki web başvurularını CRM'e bir kez aktarır.
 *
 * Kullanım:
 *   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SECRET_KEY=<sb_secret_…> \
 *   pnpm --filter @seker/panel exec tsx scripts/seed/import-old-web-leads.ts --csv out/old-web-leads.csv [--dry-run]
 *
 * Idempotent: daha önce aktarılmış satır (leads.web_payload veya events.payload
 * içinde old_web_lead_id) atlanır. Bildirim üretmez (p_meta.silent). KVKK onay
 * zamanı olarak başvurunun orijinal tarihi yazılır; eski formun onayı yalnızca
 * aramayı kapsadığı için consent_scope "arama" olarak işaretlenir (Google paylaşımı yok).
 * Kişisel veri loglanmaz.
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import ws from "ws";
import { createClient } from "@supabase/supabase-js";
import { parseOldWebLeads } from "./lib/old-web-leads";

(globalThis as unknown as { WebSocket: typeof ws }).WebSocket = ws;
dotenv.config({ path: ".env.local" });

const argv = process.argv.slice(2);
const csvPath = argv[argv.indexOf("--csv") + 1];
const dryRun = argv.includes("--dry-run");
if (!argv.includes("--csv") || !csvPath) {
  console.error("Kullanım: … import-old-web-leads.ts --csv <dosya> [--dry-run]");
  process.exit(1);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});

async function alreadyImported(): Promise<Set<string>> {
  const done = new Set<string>();
  const { data: leads, error: e1 } = await db
    .from("leads").select("web_payload").not("web_payload->>old_web_lead_id", "is", null);
  if (e1) throw e1;
  const { data: events, error: e2 } = await db
    .from("events").select("payload").eq("event_type", "web_tekrar_basvuru")
    .not("payload->>old_web_lead_id", "is", null);
  if (e2) throw e2;
  for (const r of leads ?? []) done.add(String((r.web_payload as Record<string, unknown>).old_web_lead_id));
  for (const r of events ?? []) done.add(String((r.payload as Record<string, unknown>).old_web_lead_id));
  return done;
}

async function main() {
  const { rows, rejected } = parseOldWebLeads(fs.readFileSync(path.resolve(csvPath), "utf8"));
  const done = await alreadyImported();
  const todo = rows.filter((r) => !done.has(r.id));

  console.log(`CSV: ${rows.length} geçerli, ${rejected.length} reddedildi, ${rows.length - todo.length} zaten aktarılmış, ${todo.length} aktarılacak.`);
  for (const r of rejected) console.log(`  satır ${r.line}: ${r.reason}`);
  if (dryRun) {
    console.log("--dry-run: hiçbir şey yazılmadı.");
    return;
  }

  let created = 0, merged = 0, failed = 0;
  for (const row of todo) {
    const { data, error } = await db.rpc("create_web_lead", {
      p_parent_name: row.parentName,
      p_phone: row.phone,
      p_gclid: row.gclid,
      p_utm: {},
      p_landing_path: row.landingPath,
      p_consent_at: row.createdAt,
      p_meta: {
        silent: true,
        old_web_lead_id: row.id,
        old_created_at: row.createdAt,
        consent_scope: "arama",
      },
    });
    if (error || !data) {
      failed++;
      console.error(`  ${row.id}: ${error?.code ?? "veri yok"}`);
      continue;
    }
    if ((data as { duplicate: boolean }).duplicate) merged++; else created++;
  }
  console.log(`Bitti: ${created} yeni lead, ${merged} mevcut karta eklendi, ${failed} hata.`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
