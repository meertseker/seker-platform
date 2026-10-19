/**
 * Okulun cevabına göre prod veri düzeltmesi.
 *   npx tsx scripts/seed/out/fix-okul-cevap-2026-10.ts <env> --step=kitap|kivanc|tentative [--apply]
 *  kitap     : 11 öğrencinin bekleyen kitap taksitlerini okulun planıyla değiştirir.
 *  kivanc    : KIVANÇ GÖK aidat tutarlarını düşürür (satırlar silinmez).
 *  tentative : migration bekleniyor (Task 7).
 * --apply verilmezse hiçbir şey yazılmaz.
 */
import fs from "node:fs";
import path from "node:path";
import ws from "ws";
import { createClient } from "@supabase/supabase-js";
import { applyPaymentDay, inferPaymentDay } from "../../../lib/payment-day";
(globalThis as any).WebSocket = ws;

const [envFile] = process.argv.slice(2);
const APPLY = process.argv.includes("--apply");
const STEP = process.argv.find((a) => a.startsWith("--step="))?.slice(7);
const SEASON = "2026-2027";
const STAFF_SINCE = "2026-10-19T00:00:00Z";

if (STEP === "tentative") {
  console.log("tentative: migration bekleniyor (Task 7 doldurur). Bir şey yapılmadı.");
  process.exit(0);
}
if (STEP !== "kitap" && STEP !== "kivanc") {
  console.error("Kullanım: <env> --step=kitap|kivanc|tentative [--apply]");
  process.exit(1);
}

const env: Record<string, string> = {};
for (const l of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) { const m = /^([A-Z_]+)=(.*)$/.exec(l.trim()); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const SCHEDULE: Record<string, [string, number][]> = {
  "ATLAS TEKİN": [["2026-10", 20000]],
  "ADA KARADAĞ": [["2026-10", 17000], ["2026-11", 16000]],
  "CAN ATA YILMAZ": [["2026-10", 15000], ["2026-11", 20000]],
  "HALİT ENSAR AKÇELİK": [["2026-11", 10000], ["2026-12", 10000]],
  "GÖKTUĞ AKSOY": [["2026-11", 25000]],
  "BARTU EMRE BOZSEKİ": [["2026-11", 15000]],
  "MİLA YIKARBABA": [["2026-11", 13900]],
  "EREN ULAŞ ATA": [["2026-11", 9000]],
  "ZEHRA KARABIÇAK": [["2026-10", 15500]],
  "LİVA HAMİDOĞLU": [["2026-10", 15000], ["2026-11", 10000]],
  "İNCİ ADA ZEREN": [["2026-10", 15000], ["2026-11", 10000]],
};
// Okulun planı Excel'deki kalandan farklıysa izin verilen fark (TL).
const EXPECTED_DIFF: Record<string, number> = {
  "LİVA HAMİDOĞLU": -5000,
  "İNCİ ADA ZEREN": -5000,
};

const key = (s: string) => s.trim().toLocaleLowerCase("tr");
const backupFile = () => path.join(path.dirname(process.argv[1]), `backup-okul-cevap-${STEP}-${Date.now()}.json`);

async function kitap() {
  const { data: students, error } = await db
    .from("students")
    .select("id, full_name, payment_plans(id, item_type, season, total_amount, installment_count, installments(id, plan_id, due_date, amount, status, updated_at))");
  if (error) throw error;
  const backup: unknown[] = [];
  let changed = 0;
  for (const [name, schedule] of Object.entries(SCHEDULE)) {
    const s = (students as any[]).find((x) => key(x.full_name) === key(name));
    if (!s) { console.log(`ATLA (öğrenci yok) ${name}`); continue; }
    const plan = s.payment_plans.find((p: any) => p.item_type === "kitap" && p.season === SEASON);
    const aidat = s.payment_plans.find((p: any) => p.item_type === "aidat" && p.season === SEASON);
    if (!plan) { console.log(`ATLA (kitap planı yok) ${name}`); continue; }
    const pending = plan.installments.filter((i: any) => i.status === "bekliyor");
    if (!pending.length) { console.log(`ATLA (bekleyen yok) ${name}`); continue; }
    if (pending.some((i: any) => i.updated_at > STAFF_SINCE)) { console.log(`ATLA (personel dokunmuş) ${name}`); continue; }
    const pendingTl = pending.reduce((a: number, i: any) => a + Number(i.amount), 0);
    const newTl = schedule.reduce((a, [, tl]) => a + tl, 0);
    const diff = newTl - pendingTl;
    const allowed = EXPECTED_DIFF[name] ?? 0;
    if (Math.abs(diff - allowed) > 0.001) { console.log(`ATLA (fark ${diff} ≠ beklenen ${allowed}; bekleyen ${pendingTl}, yeni ${newTl}) ${name}`); continue; }

    const aidatDues = (aidat?.installments ?? []).filter((i: any) => i.status === "bekliyor").map((i: any) => i.due_date as string);
    const day = inferPaymentDay(aidatDues);
    const needsDay = schedule.some(([ay]) => ay !== "2026-10");
    if (needsDay && day === null) { console.log(`ATLA (ödeme günü bulunamadı) ${name}`); continue; }
    const rows = schedule.map(([ay, amount]) => ({
      plan_id: plan.id as string,
      due_date: ay === "2026-10" ? "2026-10-31" : applyPaymentDay(`${ay}-01`, day!),
      amount,
    }));
    const planNote = diff !== 0 ? `  [plan ${plan.total_amount} → ${Number(plan.total_amount) + diff}]` : "";
    console.log(`${name}: ${pending.map((i: any) => `${i.due_date}=${i.amount}`).join(", ")} → ${rows.map((r) => `${r.due_date}=${r.amount}`).join(", ")}${planNote}`);
    backup.push({ name, plan: { id: plan.id, total_amount: plan.total_amount, installment_count: plan.installment_count }, pending });
    changed++;
    if (APPLY) {
      const ins = await db.from("installments").insert(rows);
      if (ins.error) throw ins.error;
      const del = await db.from("installments").delete().in("id", pending.map((i: any) => i.id));
      if (del.error) throw del.error;
      const count = plan.installments.length - pending.length + rows.length;
      const upd = await db.from("payment_plans").update({ total_amount: Number(plan.total_amount) + diff, installment_count: count }).eq("id", plan.id);
      if (upd.error) throw upd.error;
    }
  }
  if (APPLY) fs.writeFileSync(backupFile(), JSON.stringify(backup, null, 1));
  console.log(`\n${changed} öğrenci ${APPLY ? "güncellendi" : "(dry-run)"}`);
}

const KIVANC_NEW: [string, number][] = [
  ["2026-11-30", 16000], ["2026-12-31", 16000],
  ["2027-01-31", 18000], ["2027-02-28", 18000], ["2027-03-31", 18000],
  ["2027-04-30", 18000], ["2027-05-31", 18000], ["2027-06-30", 18000],
];

async function kivanc() {
  const { data: students, error } = await db
    .from("students")
    .select("id, full_name, payment_plans(id, item_type, season, total_amount, installment_count, installments(id, due_date, amount, status, updated_at))");
  if (error) throw error;
  const s = (students as any[]).find((x) => key(x.full_name) === key("KIVANÇ GÖK"));
  if (!s) throw new Error("KIVANÇ GÖK bulunamadı");
  const plan = s.payment_plans.find((p: any) => p.item_type === "aidat" && p.season === SEASON);
  if (!plan) throw new Error("Aidat planı yok");
  const all = (plan.installments as any[]).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const pending = all.filter((i) => i.status === "bekliyor");
  if (pending.length !== 9) throw new Error(`9 bekleyen taksit bekleniyordu, ${pending.length} var — dur`);
  if (Number(pending[0].amount) !== 8000 || pending[0].due_date !== "2026-10-31") throw new Error(`Ekim taksiti 8000 / 2026-10-31 değil (${pending[0].due_date}=${pending[0].amount}) — dur`);
  const rest = pending.slice(1);
  if (rest.some((i) => Number(i.amount) !== 22000)) throw new Error("Kasım–Haziran taksitleri 22000 değil — dur");
  if (rest.some((r, k) => r.due_date !== KIVANC_NEW[k][0])) throw new Error(`Vadeler beklenenle uyuşmuyor: ${rest.map((r) => r.due_date).join(", ")} — dur`);
  if (pending.some((i) => i.updated_at > STAFF_SINCE)) throw new Error("Personel dokunmuş satır var — dur");
  const newTotal = 8000 + KIVANC_NEW.reduce((a, [, t]) => a + t, 0);
  if (newTotal !== 148000) throw new Error(`Yeni toplam ${newTotal} ≠ 148000`);
  console.log(`KIVANÇ GÖK: ${plan.total_amount} → ${newTotal}  (${plan.installment_count} taksit, değişmez)`);
  rest.forEach((r, k) => console.log(`  ${r.due_date}: ${r.amount} → ${KIVANC_NEW[k][1]}`));
  if (APPLY) {
    fs.writeFileSync(backupFile(), JSON.stringify(plan, null, 1));
    for (let k = 0; k < rest.length; k++) {
      const u = await db.from("installments").update({ amount: KIVANC_NEW[k][1] }).eq("id", rest[k].id);
      if (u.error) throw u.error;
    }
    const upd = await db.from("payment_plans").update({ total_amount: newTotal }).eq("id", plan.id);
    if (upd.error) throw upd.error;
  }
  console.log(`\n${APPLY ? "Uygulandı." : "(dry-run)"}`);
}

(STEP === "kitap" ? kitap() : kivanc()).catch((e) => { console.error(e); process.exit(1); });
