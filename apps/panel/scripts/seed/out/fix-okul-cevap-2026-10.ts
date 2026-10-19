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
import { tlToKurus, kurusToTl } from "../../../lib/money";
(globalThis as any).WebSocket = ws;

const [envFile] = process.argv.slice(2);
const APPLY = process.argv.includes("--apply");
const STEP = process.argv.find((a) => a.startsWith("--step="))?.slice(7);
const SEASON = "2026-2027";
const STAFF_SINCE = "2026-10-19T00:00:00Z";

if (STEP !== "kitap" && STEP !== "kivanc" && STEP !== "tentative") {
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

const K = (v: unknown) => tlToKurus(Number(v));
const sumK = (rows: any[]) => rows.reduce((a, i) => a + K(i.amount), 0);
const SELECT = "id, full_name, payment_plans(id, item_type, season, total_amount, installment_count, installments(id, plan_id, due_date, amount, status, updated_at))";

/** Yazma adımı: hata olursa ne yapıldığını yazdırıp tüm koşuyu durdurur. */
async function step(done: string[], label: string, p: PromiseLike<{ error: any }>) {
  const r = await p;
  if (r.error) {
    console.error(`\nHATA (${label}): ${r.error.message}\nBu koşuda tamamlanan adımlar:\n  ${done.join("\n  ") || "(yok)"}\nYedek diskte; koşu durduruldu.`);
    process.exit(1);
  }
  done.push(label);
}

async function readPlan(planId: string) {
  const { data, error } = await db.from("payment_plans").select("id, total_amount, installment_count, installments(id, due_date, amount, status)").eq("id", planId).single();
  if (error) throw error;
  return data as any;
}

async function kitap() {
  const { data: students, error } = await db.from("students").select(SELECT);
  if (error) throw error;
  type Job = { name: string; plan: any; pending: any[]; rows: { plan_id: string; due_date: string; amount: number }[]; newTotalK: number; newCount: number };
  const jobs: Job[] = [];
  for (const [name, schedule] of Object.entries(SCHEDULE)) {
    const s = (students as any[]).find((x) => key(x.full_name) === key(name));
    if (!s) { console.log(`ATLA (öğrenci yok) ${name}`); continue; }
    const plan = s.payment_plans.find((p: any) => p.item_type === "kitap" && p.season === SEASON);
    const aidat = s.payment_plans.find((p: any) => p.item_type === "aidat" && p.season === SEASON);
    if (!plan) { console.log(`ATLA (kitap planı yok) ${name}`); continue; }
    const live = plan.installments.filter((i: any) => i.status !== "iptal");
    const pending = plan.installments.filter((i: any) => i.status === "bekliyor");
    if (!pending.length) { console.log(`ATLA (bekleyen yok) ${name}`); continue; }
    if (pending.some((i: any) => i.updated_at > STAFF_SINCE)) { console.log(`ATLA (personel dokunmuş) ${name}`); continue; }
    if (K(plan.total_amount) !== sumK(live)) { console.log(`ATLA (plan toplamı ${plan.total_amount} ≠ taksit toplamı ${kurusToTl(sumK(live))}) ${name}`); continue; }
    const pendingK = sumK(pending);
    const newK = schedule.reduce((a, [, tl]) => a + tlToKurus(tl), 0);
    const diffK = newK - pendingK;
    const allowedK = tlToKurus(EXPECTED_DIFF[name] ?? 0);
    if (diffK !== allowedK) { console.log(`ATLA (fark ${kurusToTl(diffK)} ≠ beklenen ${kurusToTl(allowedK)}; bekleyen ${kurusToTl(pendingK)}, yeni ${kurusToTl(newK)}) ${name}`); continue; }

    const aidatDues = (aidat?.installments ?? []).filter((i: any) => i.status === "bekliyor").map((i: any) => i.due_date as string);
    const day = inferPaymentDay(aidatDues);
    if (schedule.some(([ay]) => ay !== "2026-10") && day === null) { console.log(`ATLA (ödeme günü bulunamadı) ${name}`); continue; }
    const rows = schedule.map(([ay, amount]) => ({
      plan_id: plan.id as string,
      due_date: ay === "2026-10" ? "2026-10-31" : applyPaymentDay(`${ay}-01`, day!),
      amount,
    }));
    const newTotalK = sumK(live) - pendingK + newK;
    const planNote = newTotalK !== K(plan.total_amount) ? `  [plan ${plan.total_amount} → ${kurusToTl(newTotalK)}]` : "";
    console.log(`${name}: ${pending.map((i: any) => `${i.due_date}=${i.amount}`).join(", ")} → ${rows.map((r) => `${r.due_date}=${r.amount}`).join(", ")}${planNote}`);
    jobs.push({ name, plan, pending, rows, newTotalK, newCount: live.length - pending.length + rows.length });
  }

  if (APPLY && jobs.length) {
    // Yedek: değişiklikten ÖNCE, hedef her planın tam görüntüsü.
    const file = backupFile();
    fs.writeFileSync(file, JSON.stringify(jobs.map((j) => ({ name: j.name, plan: j.plan })), null, 1));
    console.log(`Yedek yazıldı: ${file}`);
    const done: string[] = [];
    for (const j of jobs) {
      await step(done, `${j.name}: taksitler eklendi`, db.from("installments").insert(j.rows));
      await step(done, `${j.name}: eski bekleyenler silindi`, db.from("installments").delete().in("id", j.pending.map((i: any) => i.id)));
      await step(done, `${j.name}: plan güncellendi`, db.from("payment_plans").update({ total_amount: kurusToTl(j.newTotalK), installment_count: j.newCount }).eq("id", j.plan.id));
      const after = await readPlan(j.plan.id);
      const liveAfter = after.installments.filter((i: any) => i.status !== "iptal");
      if (K(after.total_amount) !== sumK(liveAfter) || K(after.total_amount) !== j.newTotalK) {
        console.error(`DOĞRULAMA HATASI ${j.name}: plan ${after.total_amount}, taksit toplamı ${kurusToTl(sumK(liveAfter))}. Durduruldu.\n  ${done.join("\n  ")}`);
        process.exit(1);
      }
      console.log(`  doğrulandı: ${j.name} (${after.total_amount})`);
    }
  }
  console.log(`\n${jobs.length} öğrenci ${APPLY ? "güncellendi" : "(dry-run)"}`);
}

const KIVANC_NEW: [string, number][] = [
  ["2026-11-30", 16000], ["2026-12-31", 16000],
  ["2027-01-31", 18000], ["2027-02-28", 18000], ["2027-03-31", 18000],
  ["2027-04-30", 18000], ["2027-05-31", 18000], ["2027-06-30", 18000],
];

async function kivanc() {
  const { data: students, error } = await db.from("students").select(SELECT);
  if (error) throw error;
  const s = (students as any[]).find((x) => key(x.full_name) === key("KIVANÇ GÖK"));
  if (!s) throw new Error("KIVANÇ GÖK bulunamadı");
  const plan = s.payment_plans.find((p: any) => p.item_type === "aidat" && p.season === SEASON);
  if (!plan) throw new Error("Aidat planı yok");
  const all = (plan.installments as any[]).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const live = all.filter((i) => i.status !== "iptal");
  const pending = all.filter((i) => i.status === "bekliyor");
  if (K(plan.total_amount) !== sumK(live)) throw new Error(`Plan toplamı ${plan.total_amount} ≠ taksit toplamı ${kurusToTl(sumK(live))} — dur`);
  if (pending.length !== 9) throw new Error(`9 bekleyen taksit bekleniyordu, ${pending.length} var — dur`);
  if (K(pending[0].amount) !== tlToKurus(8000) || pending[0].due_date !== "2026-10-31") throw new Error(`Ekim taksiti 8000 / 2026-10-31 değil (${pending[0].due_date}=${pending[0].amount}) — dur`);
  const rest = pending.slice(1);
  if (rest.some((i) => K(i.amount) !== tlToKurus(22000))) throw new Error("Kasım–Haziran taksitleri 22000 değil — dur");
  if (rest.some((r, k) => r.due_date !== KIVANC_NEW[k][0])) throw new Error(`Vadeler beklenenle uyuşmuyor: ${rest.map((r) => r.due_date).join(", ")} — dur`);
  if (pending.some((i) => i.updated_at > STAFF_SINCE)) throw new Error("Personel dokunmuş satır var — dur");
  const newTotalK = sumK(live) - sumK(rest) + KIVANC_NEW.reduce((a, [, t]) => a + tlToKurus(t), 0);
  if (newTotalK !== tlToKurus(148000)) throw new Error(`Yeni toplam ${kurusToTl(newTotalK)} ≠ 148000 — dur`);
  console.log(`KIVANÇ GÖK: ${plan.total_amount} → ${kurusToTl(newTotalK)}  (${plan.installment_count} taksit, değişmez; hesaplanan toplam 148000 ile eşleşti)`);
  rest.forEach((r, k) => console.log(`  ${r.due_date}: ${r.amount} → ${KIVANC_NEW[k][1]}`));
  if (APPLY) {
    const file = backupFile();
    fs.writeFileSync(file, JSON.stringify(plan, null, 1));
    console.log(`Yedek yazıldı: ${file}`);
    const done: string[] = [];
    for (let k = 0; k < rest.length; k++) {
      await step(done, `${rest[k].due_date} → ${KIVANC_NEW[k][1]}`, db.from("installments").update({ amount: KIVANC_NEW[k][1] }).eq("id", rest[k].id));
    }
    await step(done, "plan toplamı güncellendi", db.from("payment_plans").update({ total_amount: kurusToTl(newTotalK) }).eq("id", plan.id));
    const after = await readPlan(plan.id);
    if (K(after.total_amount) !== sumK(after.installments.filter((i: any) => i.status !== "iptal"))) { console.error("DOĞRULAMA HATASI: toplam ≠ taksit toplamı"); process.exit(1); }
  }
  console.log(`\n${APPLY ? "Uygulandı." : "(dry-run)"}`);
}

const TENTATIVE_FROM = "2027-01-01";

async function tentative() {
  const base = "id, full_name, status, payment_plans(id, item_type, season, total_amount, installments(id, due_date, status)";
  let hasColumn = true;
  let res = await db.from("students").select(`${base}, tentative_from)`);
  // payment_plans.tentative_from yoksa PostgREST kolon hatası döner.
  if (res.error) {
    if (!/tentative_from/.test(res.error.message)) throw res.error;
    hasColumn = false;
    console.log("UYARI: tentative_from kolonu yok (migration 0012 bekleniyor) — tüm adaylar işaretlenecek");
    res = await db.from("students").select(`${base})`);
    if (res.error) throw res.error;
  }
  const students = (res.data as any[]).filter((s) => s.status === "aktif");
  const targets: { name: string; plan: any }[] = [];
  for (const s of students) {
    for (const p of s.payment_plans) {
      if (p.item_type !== "aidat" || p.season !== SEASON) continue;
      if (hasColumn && p.tentative_from != null) continue;
      if (!p.installments.some((i: any) => i.status === "bekliyor" && i.due_date >= TENTATIVE_FROM)) continue;
      targets.push({ name: s.full_name, plan: p });
    }
  }
  targets.sort((a, b) => a.name.localeCompare(b.name, "tr"));
  for (const t of targets) console.log(`${t.name}: tentative_from → ${TENTATIVE_FROM}`);

  if (APPLY) {
    if (!hasColumn) { console.error("HATA: tentative_from kolonu yok (migration 0012 uygulanmadan --apply yapılmaz)."); process.exit(1); }
    const file = backupFile();
    fs.writeFileSync(file, JSON.stringify(targets.map((t) => ({ name: t.name, plan: t.plan })), null, 1));
    console.log(`Yedek yazıldı: ${file}`);
    const done: string[] = [];
    for (const t of targets) await step(done, t.name, db.from("payment_plans").update({ tentative_from: TENTATIVE_FROM }).eq("id", t.plan.id).is("tentative_from", null));
    const { data, error } = await db.from("payment_plans").select("id, tentative_from").in("id", targets.map((t) => t.plan.id));
    if (error) throw error;
    const bad = (data as any[]).filter((r) => r.tentative_from !== TENTATIVE_FROM);
    if (bad.length || (data as any[]).length !== targets.length) { console.error(`DOĞRULAMA HATASI: ${bad.length} plan işaretlenmedi`); process.exit(1); }
  }
  console.log(`\n${targets.length} plan ${APPLY ? "işaretlendi" : "(dry-run)"}`);
}

(STEP === "kitap" ? kitap() : STEP === "kivanc" ? kivanc() : tentative()).catch((e) => { console.error(e); process.exit(1); });
