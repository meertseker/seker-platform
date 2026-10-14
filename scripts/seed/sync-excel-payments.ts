/**
 * Excel boyası + yorumuna göre mevcut taksitleri düzeltir. Öğrenci silmez.
 *
 *   npx tsx scripts/seed/sync-excel-payments.ts --env .env.local
 *   npx tsx scripts/seed/sync-excel-payments.ts --env .env.local --apply
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ws from "ws";
import { createClient } from "@supabase/supabase-js";
import { factFromCell, type ExcelPayFact } from "./lib/excel-payment-facts";
import type { PaymentMethod } from "../../lib/constants";

(globalThis as unknown as { WebSocket: typeof ws }).WebSocket = ws;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(SCRIPT_DIR, "..", "..");
const REPO = path.join(ROOT, "..");

const MONTH_KEY: Record<string, string> = {
  EYLUL: "2026-09",
  EKIM: "2026-10",
  KASIM: "2026-11",
  ARALIK: "2026-12",
  OCAK: "2027-01",
  SUBAT: "2027-02",
  MART: "2027-03",
  NISAN: "2027-04",
  MAYIS: "2027-05",
  HAZIRAN: "2027-06",
};

type RawCell = {
  value: number | string | null;
  fill: string | null;
  note: string | null;
  status?: string;
};

type RawStudent = {
  name: string;
  phones: string[];
  kitap: RawCell;
  aidat_yillik: RawCell;
  months: Record<string, RawCell>;
};

type Target = {
  student: string;
  itemType: "aidat" | "kitap";
  monthKey: string;
  fact: ExcelPayFact;
  note: string | null;
};

function flag(name: string) {
  return process.argv.includes(name);
}
function arg(name: string, fallback?: string) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

function loadEnv(file: string) {
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
    if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

function nameKey(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr");
}

function cellTl(value: RawCell["value"]) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function paidAtIso(paidOn: string | null, dueDate: string) {
  return `${paidOn ?? dueDate}T12:00:00+03:00`;
}

function collectTargets(rows: RawStudent[]): Target[] {
  const out: Target[] = [];
  for (const row of rows) {
    const annualTl = cellTl(row.aidat_yillik.value);
    if (annualTl) {
      const fact = factFromCell(annualTl, row.aidat_yillik.fill, row.aidat_yillik.note);
      if (fact) {
        out.push({
          student: row.name,
          itemType: "aidat",
          monthKey: "2026-09",
          fact,
          note: row.aidat_yillik.note,
        });
      }
    } else {
      for (const [label, monthKey] of Object.entries(MONTH_KEY)) {
        const cell = row.months[label];
        if (!cell) continue;
        const tl = cellTl(cell.value);
        if (!tl) continue;
        const fact = factFromCell(tl, cell.fill, cell.note);
        if (!fact) continue;
        out.push({ student: row.name, itemType: "aidat", monthKey, fact, note: cell.note });
      }
    }

    const kitapTl = cellTl(row.kitap.value);
    if (kitapTl) {
      const fact = factFromCell(kitapTl, row.kitap.fill, row.kitap.note);
      if (fact) {
        out.push({
          student: row.name,
          itemType: "kitap",
          monthKey: "2026-09",
          fact,
          note: row.kitap.note,
        });
      }
    }
  }
  return out;
}

async function main() {
  const apply = flag("--apply");
  const envFile = path.resolve(ROOT, arg("--env", ".env.local")!);
  const factsPath = path.resolve(arg("--facts", path.join(REPO, "analysis", "excel_payments.json"))!);

  const env = loadEnv(envFile);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY eksik");
  if (!fs.existsSync(factsPath)) throw new Error(`Facts yok: ${factsPath}`);

  const rows = JSON.parse(fs.readFileSync(factsPath, "utf8")) as RawStudent[];
  const targets = collectTargets(rows);
  const phones = new Map(rows.filter((r) => r.phones[0]).map((r) => [nameKey(r.name), r.phones[0]]));

  const db = createClient(url, key, { auth: { persistSession: false } });
  console.log(`Hedef: ${url}`);
  console.log(`Mod  : ${apply ? "UYGULA" : "DRY-RUN"}\n`);

  const { data: adminRows, error: adminErr } = await db
    .from("profiles")
    .select("id, full_name")
    .eq("role", "yonetici")
    .eq("is_active", true)
    .limit(1);
  if (adminErr) throw new Error(adminErr.message);
  const admin = adminRows?.[0] as { id: string; full_name: string } | undefined;
  if (!admin) throw new Error("Aktif yönetici yok (marked_by)");

  const { data: students, error: sErr } = await db
    .from("students")
    .select(
      "id, full_name, phone, payment_plans(id, item_type, season, installments(id, due_date, amount, status, paid_amount))",
    );
  if (sErr) throw new Error(sErr.message);

  const byName = new Map(
    ((students ?? []) as { id: string; full_name: string; phone: string | null; payment_plans: PlanRow[] }[]).map(
      (s) => [nameKey(s.full_name), s],
    ),
  );

  type Inst = { id: string; due_date: string; amount: number; status: string; paid_amount: number | null };
  type PlanRow = { id: string; item_type: string; season: string; installments: Inst[] | null };

  const ops: string[] = [];
  let markPaid = 0;
  let revert = 0;
  let split = 0;
  let phoneFill = 0;
  let missing = 0;

  for (const target of targets) {
    const student = byName.get(nameKey(target.student));
    if (!student) {
      ops.push(`YOK  ${target.student}`);
      missing += 1;
      continue;
    }
    const plan = (student.payment_plans ?? []).find(
      (p) => p.item_type === target.itemType && p.season === "2026-2027",
    );
    if (!plan) {
      ops.push(`PLAN YOK  ${target.student} ${target.itemType}`);
      missing += 1;
      continue;
    }
    const inst = (plan.installments ?? [])
      .filter((i) => i.due_date.startsWith(target.monthKey) && i.status !== "iptal")
      .sort((a, b) => a.id.localeCompare(b.id));
    if (!inst.length) {
      ops.push(`TAKSİT YOK  ${target.student} ${target.itemType} ${target.monthKey}`);
      missing += 1;
      continue;
    }

    const open = inst.filter((i) => i.status === "bekliyor");
    const paid = inst.filter((i) => i.status === "odendi");
    const fact = target.fact;

    if (fact.status === "odendi") {
      const waiting = open[0] ?? paid[0];
      if (waiting.status === "bekliyor") {
        ops.push(
          `ÖDE  ${target.student} ${target.itemType} ${target.monthKey} ${waiting.amount} ${fact.method} ${fact.paidOn ?? ""}`,
        );
        markPaid += 1;
        if (apply) {
          const { error } = await db
            .from("installments")
            .update({
              status: "odendi",
              paid_amount: waiting.amount,
              paid_at: paidAtIso(fact.paidOn, waiting.due_date),
              payment_method: fact.method as PaymentMethod,
              marked_by: admin.id,
            })
            .eq("id", waiting.id);
          if (error) throw new Error(`${target.student} öde: ${error.message}`);
        }
      }
    } else if (fact.status === "bekliyor") {
      for (const row of paid) {
        ops.push(`GERİ  ${target.student} ${target.itemType} ${target.monthKey} ${row.amount}`);
        revert += 1;
        if (apply) {
          const { error } = await db
            .from("installments")
            .update({
              status: "bekliyor",
              paid_amount: null,
              paid_at: null,
              payment_method: null,
              marked_by: null,
            })
            .eq("id", row.id);
          if (error) throw new Error(`${target.student} geri: ${error.message}`);
        }
      }
    } else {
      const source = open[0] ?? paid[0];
      const alreadySplit = inst.length > 1 && paid.length > 0 && open.length > 0;
      if (alreadySplit) {
        ops.push(`ATLA kısmi zaten var  ${target.student} ${target.itemType} ${target.monthKey}`);
        continue;
      }
      ops.push(
        `KISMİ ${target.student} ${target.itemType} ${target.monthKey} ${fact.paidTl}+${fact.remainingTl}`,
      );
      split += 1;
      if (apply) {
        const { error: uErr } = await db
          .from("installments")
          .update({
            amount: fact.paidTl,
            status: "odendi",
            paid_amount: fact.paidTl,
            paid_at: paidAtIso(fact.paidOn, source.due_date),
            payment_method: fact.method,
            marked_by: admin.id,
          })
          .eq("id", source.id);
        if (uErr) throw new Error(`${target.student} kısmi güncelle: ${uErr.message}`);
        const { error: iErr } = await db.from("installments").insert({
          plan_id: plan.id,
          due_date: source.due_date,
          amount: fact.remainingTl,
          status: "bekliyor",
        });
        if (iErr) throw new Error(`${target.student} kalan taksit: ${iErr.message}`);
      }
    }
  }

  for (const [key, phone] of phones) {
    const student = byName.get(key);
    if (!student || student.phone) continue;
    ops.push(`TEL   ${student.full_name} ${phone}`);
    phoneFill += 1;
    if (apply) {
      const { error } = await db.from("students").update({ phone }).eq("id", student.id);
      if (error) throw new Error(`${student.full_name} telefon: ${error.message}`);
    }
  }

  const paidFacts = targets.filter((t) => t.fact.status === "odendi" || t.fact.status === "kismi");
  const paidSum = paidFacts.reduce((s, t) => s + t.fact.paidTl, 0);
  const waitSum = targets.reduce((s, t) => s + t.fact.remainingTl, 0);

  console.log(ops.join("\n"));
  console.log(`\nÖdenecek işaret: ${markPaid}`);
  console.log(`Geri alınacak:    ${revert}`);
  console.log(`Kısmi bölünecek:  ${split}`);
  console.log(`Telefon yazılacak:${phoneFill}`);
  console.log(`Eşleşmeyen:       ${missing}`);
  console.log(`Excel tahsil toplamı (işaretlenecek kalemler): ${paidSum.toLocaleString("tr-TR")} ₺`);
  console.log(`Excel kalan toplamı: ${waitSum.toLocaleString("tr-TR")} ₺`);
  if (!apply) console.log("\nDRY-RUN. Yazmak için --apply ekleyin.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
