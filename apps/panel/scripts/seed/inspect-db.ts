/**
 * Hedef veritabanındaki satır sayılarını ve örnek verileri listeler — SADECE OKUR.
 * Kullanım: npx tsx scripts/seed/inspect-db.ts [--env <dosya>]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import ws from "ws";

(globalThis as unknown as { WebSocket: typeof ws }).WebSocket = ws;

const argv = process.argv.slice(2);
const envFile = argv[argv.indexOf("--env") + 1] ?? ".env.local";

function loadEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnv(envFile);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error(`${envFile}: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY eksik`);

const db = createClient(url, key, { auth: { persistSession: false } });

const TABLES = [
  "profiles", "families", "students", "leads", "lead_notes", "appointments",
  "price_lists", "price_list_items", "offers", "payment_plans", "installments",
  "refunds", "tasks", "notifications", "events", "app_settings",
];

async function main() {
  console.log(`# Hedef: ${url}  (env: ${envFile})\n`);
  for (const t of TABLES) {
    const { count, error } = await db.from(t).select("*", { count: "exact", head: true });
    console.log(`${t.padEnd(20)} ${error ? `HATA: ${error.message}` : count}`);
  }

  const { data: students } = await db
    .from("students")
    .select("id, full_name, season, program, status, phone, parent_name, created_at")
    .order("created_at", { ascending: true });
  console.log(`\n# students (${students?.length ?? 0})`);
  const bySeason = new Map<string, number>();
  for (const s of students ?? []) bySeason.set(s.season, (bySeason.get(s.season) ?? 0) + 1);
  console.log("sezona göre:", Object.fromEntries(bySeason));
  for (const s of (students ?? []).slice(0, 15)) {
    console.log(`  ${s.full_name} | ${s.season} | ${s.program} | ${s.status} | tel=${s.phone ?? "-"}`);
  }

  const { data: plans } = await db.from("payment_plans").select("season, item_type, total_amount, installment_count");
  const agg = new Map<string, { n: number; total: number }>();
  for (const p of plans ?? []) {
    const k = `${p.season}/${p.item_type}`;
    const cur = agg.get(k) ?? { n: 0, total: 0 };
    agg.set(k, { n: cur.n + 1, total: cur.total + Number(p.total_amount) });
  }
  console.log(`\n# payment_plans (${plans?.length ?? 0})`);
  for (const [k, v] of agg) console.log(`  ${k.padEnd(28)} adet=${v.n} toplam=${v.total.toLocaleString("tr-TR")}`);

  const { data: inst } = await db.from("installments").select("status, amount, due_date");
  const st = new Map<string, number>();
  for (const i of inst ?? []) st.set(i.status, (st.get(i.status) ?? 0) + 1);
  console.log(`\n# installments (${inst?.length ?? 0})`, Object.fromEntries(st));

  const { data: prof } = await db.from("profiles").select("id, full_name, role, is_active");
  console.log(`\n# profiles (${prof?.length ?? 0})`);
  for (const p of prof ?? []) console.log(`  ${p.full_name} | ${p.role} | aktif=${p.is_active} | ${p.id}`);

  const { data: pl } = await db.from("price_lists").select("id, season, is_active");
  console.log(`\n# price_lists (${pl?.length ?? 0})`);
  for (const x of pl ?? []) console.log(`  ${x.season} | aktif=${x.is_active}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
