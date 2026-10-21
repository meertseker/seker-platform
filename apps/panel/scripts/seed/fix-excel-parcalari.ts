/**
 * Excel aidat defteri (hücre yorumları) ↔ prod ödenmiş taksitler: çok parçalı ödemeleri ve
 * yöntemleri düzeltme önizlemesi + SQL. KURU ÇALIŞTIRMA: DB'ye bağlanmaz, yalnız dosya okur/yazar.
 *
 *   npx tsx scripts/seed/fix-excel-parcalari.ts \
 *     --facts hucreler.json --prod prod.json --protect koru.json \
 *     --md ../../../seker-platform-ledgers/odeme-excel-duzeltme-onizleme.md \
 *     --sql ../../../seker-platform-ledgers/odeme-excel-duzeltme.sql [--today 2026-10-21]
 *
 * hucreler.json: scripts/seed/excel-hucreler.py çıktısı (renk + yorum openpyxl ile okunur).
 * prod.json: aşağıdaki SELECT'in json_agg sonucu (Supabase MCP execute_sql, salt okuma):
 *   select s.full_name student, p.id plan_id, p.item_type, p.total_amount, p.installment_count,
 *          i.id, i.due_date, i.amount, i.status, i.paid_at, i.paid_amount, i.payment_method,
 *          pr.full_name marked_by, i.created_at
 *     from installments i join payment_plans p on p.id = i.plan_id
 *     join students s on s.id = p.student_id left join profiles pr on pr.id = i.marked_by
 *    where p.season = '2026-2027';
 * koru.json: { "installmentIds": [...], "students": [...] } — panelden alınmış (geri alınmamış
 *   odeme_alindi) taksitler ve koordinatörün elle düzelttiği (seed_import olaylı) öğrenciler.
 *
 * Öneri sınıfları:
 *   a  değişiklik yok        b  yalnız yöntem        c  parçalara böl (toplam değişmez)
 *   d  Excel ↔ prod tutmuyor ya da yorum belirsiz → elle karar
 *   k  dokunma (panel ödemesi / koordinatör düzeltmesi)
 */
import fs from "node:fs";
import path from "node:path";
import { parseCell, fillMethod, paidAtUtc, type Method, type Part } from "./lib/excel-odeme-parcalari";

const MONTH_KEY: Record<string, string> = {
  EYLUL: "2026-09", EKIM: "2026-10", KASIM: "2026-11", ARALIK: "2026-12", OCAK: "2027-01",
  SUBAT: "2027-02", MART: "2027-03", NISAN: "2027-04", MAYIS: "2027-05", HAZIRAN: "2027-06",
};
const MONTH_TR: Record<string, string> = {
  "2026-09": "Eylül", "2026-10": "Ekim", "2026-11": "Kasım", "2026-12": "Aralık", "2027-01": "Ocak",
  "2027-02": "Şubat", "2027-03": "Mart", "2027-04": "Nisan", "2027-05": "Mayıs", "2027-06": "Haziran",
};
/** İçe aktarmanın yazdığı satırlar: Mehtap Şeker adına, 12.09 ya da 16–19.10'da oluşturulmuş. */
const IMPORT_MARKER = "Mehtap Şeker";
const IMPORT_DAYS = new Set(["2026-09-12", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19"]);

type RawCell = { value: number | string | null; fill: string | null; note: string | null };
type RawStudent = { row: number; name: string; kitap: RawCell; aidat_yillik: RawCell; months: Record<string, RawCell> };
type Row = {
  student: string; plan_id: string; item_type: "aidat" | "kitap"; total_amount: string; installment_count: number;
  id: string; due_date: string; amount: string; status: "bekliyor" | "odendi" | "iptal"; paid_at: string | null;
  paid_amount: string | null; payment_method: string | null; marked_by: string | null; created_at: string;
};
type Protect = { installmentIds: string[]; students: string[] };

type Cls = "a" | "b" | "c" | "d" | "k";
type Change =
  | { kind: "method"; row: Row; from: string; to: Method }
  | { kind: "split"; row: Row; parts: (Part & { amount: number; date: string; method: Method })[] };
interface Verdict {
  student: string; item: string; label: string; cellTl: number; fill: string | null;
  prodPaid: Row[]; prodOpen: Row[]; parts: Part[]; cls: Cls; why: string; changes: Change[];
  belirsiz: string[]; uyari: string[];
}

function arg(name: string, fallback?: string) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : fallback;
}
const nameKey = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr");
const tl = (n: number) => n.toLocaleString("tr-TR");
const num = (s: string | null) => (s === null ? 0 : Number(s));
const cellTlOf = (c: RawCell | undefined) =>
  c && typeof c.value === "number" && Number.isFinite(c.value) && c.value > 0 ? c.value : null;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const sqlStr = (s: string) => `'${s.replace(/'/g, "''")}'`;
const partStr = (p: Part) => `${p.date ? p.date.slice(8, 10) + "." + p.date.slice(5, 7) : "?"} ${p.amount === null ? "?" : tl(p.amount)} ${p.method ?? "?"}`;
const rowStr = (r: Row) =>
  r.status === "odendi"
    ? `${tl(num(r.paid_amount))} ${r.payment_method} (${r.paid_at?.slice(8, 10)}.${r.paid_at?.slice(5, 7)})`
    : `${tl(num(r.amount))} bekliyor`;

function isImported(r: Row) {
  return r.marked_by === IMPORT_MARKER && IMPORT_DAYS.has(r.created_at.slice(0, 10));
}

function judge(
  student: string, item: "aidat" | "kitap", label: string, monthKey: string | null, cellTl: number,
  cell: RawCell, rows: Row[], protect: Protect, today: string,
): Verdict {
  const parsed = parseCell({ note: cell.note, cellTl, fill: cell.fill, monthKey, today });
  const paid = rows.filter((r) => r.status === "odendi");
  const open = rows.filter((r) => r.status === "bekliyor");
  const v: Verdict = {
    student, item, label, cellTl, fill: cell.fill, prodPaid: paid, prodOpen: open, parts: parsed.parts,
    cls: "a", why: "", changes: [], belirsiz: parsed.belirsiz, uyari: parsed.uyari,
  };
  const ret = (cls: Cls, why: string) => Object.assign(v, { cls, why });

  if (protect.students.includes(student) && !parsed.parts.length && !paid.length) return ret("k", "ödeme yok");
  if (protect.students.includes(student)) {
    for (const part of parsed.parts) {
      const hit = paid.find((r) => num(r.paid_amount) === part.amount && r.payment_method === part.method);
      if (!hit) v.uyari.push(`Excel parçası ${partStr(part)} prod'da birebir yok`);
      else if (part.date && hit.paid_at?.slice(0, 10) !== part.date) {
        v.uyari.push(`${tl(num(hit.paid_amount))} ${hit.payment_method}: prod paid_at ${hit.paid_at?.slice(0, 10)}, Excel ${part.date} (koordinatör/panel kaydı; dokunulmadı)`);
      }
    }
    return ret("k", "koordinatör 21.10'da elle düzeltti; zaten düzeltildi, değişiklik yok");
  }
  const guarded = paid.filter((r) => protect.installmentIds.includes(r.id) || !isImported(r));
  const scope = paid.filter((r) => !guarded.includes(r));
  const guardNote = guarded.length ? ` (panelden alınmış ${guarded.map(rowStr).join(", ")} kapsam dışı)` : "";

  let parts = parsed.parts;
  if (!parts.length && fillMethod(cell.fill) && scope.length) {
    parts = [{ amount: sum(scope.map((r) => num(r.paid_amount))), date: null, method: fillMethod(cell.fill), raw: "(mor boya)" }];
  }
  if (!parts.length && !scope.length) {
    return ret("k", guarded.length ? `Excel'de ödeme yok${guardNote}; dokunulmaz` : "ödeme yok");
  }
  if (parsed.belirsiz.length) return ret("d", "yorum belirsiz → elle karar" + guardNote);
  if (!scope.length) {
    if (guarded.length) return ret("k", `yalnız panel ödemesi var${guardNote}`);
    return ret("d", `Excel'e göre ${tl(sum(parts.map((p) => p.amount ?? 0)))} ödenmiş, prod'da ödenmiş satır yok`);
  }
  if (!parts.length) return ret("d", `prod'da ödenmiş ${tl(sum(scope.map((r) => num(r.paid_amount))))}, Excel yorumunda ödeme cümlesi yok`);

  const qSum = sum(parts.map((p) => p.amount ?? 0));
  const pSum = sum(scope.map((r) => num(r.paid_amount)));
  if (qSum !== pSum) {
    return ret("d", `Excel parçaları toplamı ${tl(qSum)} ≠ prod ödenmiş ${tl(pSum)}${guardNote}`);
  }
  if (scope.some((r) => num(r.paid_amount) !== num(r.amount))) return ret("d", "prod satırında ödenen ≠ tutar" + guardNote);

  if (scope.length === parts.length) {
    // Tutar sırasına göre eşle; yalnız yöntem karşılaştırılır.
    const ps = [...parts].sort((x, y) => (x.amount ?? 0) - (y.amount ?? 0));
    const rs = [...scope].sort((x, y) => num(x.paid_amount) - num(y.paid_amount));
    if (ps.some((p, i) => p.amount !== num(rs[i].paid_amount))) return ret("d", "parça tutarları satırlarla eşleşmiyor" + guardNote);
    ps.forEach((p, i) => {
      if (p.method && p.method !== rs[i].payment_method) {
        v.changes.push({ kind: "method", row: rs[i], from: rs[i].payment_method ?? "", to: p.method });
      }
    });
    return ret(v.changes.length ? "b" : "a", (v.changes.length ? "yöntem düzelt" : "doğru") + guardNote);
  }
  if (scope.length === 1 && parts.length > 1) {
    if (parts.some((p) => !p.date || !p.method || p.amount === null)) return ret("d", "parçalardan birinin tarihi/yöntemi eksik");
    const full = [...parts]
      .map((p) => p as Part & { amount: number; date: string; method: Method })
      .sort((x, y) => x.date.localeCompare(y.date));
    v.changes.push({ kind: "split", row: scope[0], parts: full });
    return ret("c", `${parts.length} parçaya böl` + guardNote);
  }
  return ret("d", `prod'da ${scope.length} ödenmiş satır, Excel'de ${parts.length} parça` + guardNote);
}

function main() {
  const today = arg("--today", "2026-10-21")!;
  const facts = JSON.parse(fs.readFileSync(path.resolve(arg("--facts")!), "utf8")) as RawStudent[];
  const prod = JSON.parse(fs.readFileSync(path.resolve(arg("--prod")!), "utf8")) as Row[];
  const protect = JSON.parse(fs.readFileSync(path.resolve(arg("--protect")!), "utf8")) as Protect;
  const mdPath = path.resolve(arg("--md")!);
  const sqlPath = path.resolve(arg("--sql")!);

  const byStudent = new Map<string, Row[]>();
  for (const r of prod) {
    const k = nameKey(r.student);
    byStudent.set(k, [...(byStudent.get(k) ?? []), r]);
  }

  const verdicts: Verdict[] = [];
  const unmatched: string[] = [];
  for (const s of facts) {
    const rows = (byStudent.get(nameKey(s.name)) ?? []).filter((r) => r.status !== "iptal");
    const cells: { item: "aidat" | "kitap"; label: string; monthKey: string | null; cell: RawCell; rows: Row[] }[] = [];
    const kitapPlan = rows.filter((r) => r.item_type === "kitap");
    const aidat = rows.filter((r) => r.item_type === "aidat");
    if (cellTlOf(s.kitap) || kitapPlan.length) cells.push({ item: "kitap", label: "kitap", monthKey: null, cell: s.kitap, rows: kitapPlan });
    if (cellTlOf(s.aidat_yillik)) {
      cells.push({ item: "aidat", label: "yıllık", monthKey: null, cell: s.aidat_yillik, rows: aidat });
    } else {
      for (const [label, mk] of Object.entries(MONTH_KEY)) {
        const c = s.months[label];
        const mrows = aidat.filter((r) => r.due_date.startsWith(mk));
        if (cellTlOf(c) || mrows.some((r) => r.status === "odendi") || (c?.note && mrows.length)) {
          cells.push({ item: "aidat", label: MONTH_TR[mk], monthKey: mk, cell: c ?? { value: null, fill: null, note: null }, rows: mrows });
        }
      }
    }
    if (!rows.length && cells.some((c) => cellTlOf(c.cell))) unmatched.push(s.name);
    for (const c of cells) {
      const tlv = cellTlOf(c.cell) ?? 0;
      if (!tlv && !c.rows.some((r) => r.status === "odendi")) continue;
      if (!c.rows.length && !tlv) continue;
      if (!c.rows.length) {
        const parsed = parseCell({ note: c.cell.note, cellTl: tlv, fill: c.cell.fill, monthKey: c.monthKey, today });
        if (parsed.parts.length) {
          verdicts.push({
            student: s.name, item: c.item, label: c.label, cellTl: tlv, fill: c.cell.fill, prodPaid: [], prodOpen: [],
            parts: parsed.parts, cls: "d", why: "prod'da bu kalem/ay için plan satırı yok", changes: [],
            belirsiz: parsed.belirsiz, uyari: parsed.uyari,
          });
        }
        continue;
      }
      const v = judge(s.name, c.item, c.label, c.monthKey, tlv, c.cell, c.rows, protect, today);
      if (v.why !== "ödeme yok") verdicts.push(v);
    }
  }

  // ---- önce / sonra yöntem toplamları (sezonun tüm ödenmiş satırları) ----
  const paidRows = prod.filter((r) => r.status === "odendi");
  const before: Record<string, number> = {};
  for (const r of paidRows) before[r.payment_method ?? "?"] = (before[r.payment_method ?? "?"] ?? 0) + num(r.paid_amount);
  const after = { ...before };
  let posToHavale = 0;
  let posToHavaleTl = 0;
  const methodFlips: Record<string, number> = {};
  const move = (from: string, to: string, amount: number) => {
    after[from] = (after[from] ?? 0) - amount;
    after[to] = (after[to] ?? 0) + amount;
    if (from !== to) methodFlips[`${from}→${to}`] = (methodFlips[`${from}→${to}`] ?? 0) + 1;
    if (from === "pos" && to === "havale") { posToHavale += 1; posToHavaleTl += amount; }
  };
  const all = verdicts.flatMap((v) => v.changes);
  for (const ch of all) {
    if (ch.kind === "method") move(ch.from, ch.to, num(ch.row.paid_amount));
    else for (const p of ch.parts) move(ch.row.payment_method ?? "?", p.method, p.amount);
  }

  const counts: Record<Cls, number> = { a: 0, b: 0, c: 0, d: 0, k: 0 };
  for (const v of verdicts) counts[v.cls] += 1;
  const touched = [...new Set(all.map((c) => c.row.id))];
  const newRows = sum(all.map((c) => (c.kind === "split" ? c.parts.length - 1 : 0)));

  // ---- Markdown ----
  const md: string[] = [];
  md.push(`# Ödeme Excel düzeltme — önizleme (kuru çalıştırma)`, ``);
  md.push(`Üretim: ${today} · betik \`apps/panel/scripts/seed/fix-excel-parcalari.ts\` (dal fix/excel-odeme-parcalari) · prod yalnız SELECT ile okundu.`, ``);
  md.push(`Kaynak: "2026 - 2027 DÖNEMİ AİDAT LİSTESİ (1).xlsx", sayfa "2026 - 2027", hücre yorumları. Yöntem kuralı (Mert): "YKB OK" = havale; POS / SANAL POS / KART = pos; NAKİT = nakit.`, ``);
  md.push(`## Özet`, ``);
  md.push(`| sınıf | hücre |`, `|---|---|`);
  md.push(`| a — değişiklik yok | ${counts.a} |`, `| b — yalnız yöntem | ${counts.b} |`, `| c — parçalara böl | ${counts.c} |`, `| d — elle karar | ${counts.d} |`, `| k — dokunma (panel / koordinatör / ödeme yok) | ${counts.k} |`, ``);
  md.push(`- Güncellenecek mevcut satır: **${touched.length}**, eklenecek yeni ödenmiş satır: **${newRows}**`);
  md.push(`- pos→havale olacak ödeme (satır/parça): **${posToHavale}** (${tl(posToHavaleTl)} ₺)`);
  md.push(`- Tüm yöntem geçişleri (satır/parça sayısı): ${Object.entries(methodFlips).map(([k, n]) => `${k} ${n}`).join(", ") || "yok"}`, ``);
  md.push(`Yöntem toplamları (2026-2027 sezonu, tüm ödenmiş satırlar, ₺):`, ``);
  md.push(`| yöntem | önce | sonra | fark |`, `|---|---:|---:|---:|`);
  for (const m of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
    md.push(`| ${m} | ${tl(before[m] ?? 0)} | ${tl(after[m] ?? 0)} | ${tl((after[m] ?? 0) - (before[m] ?? 0))} |`);
  }
  md.push(`| **toplam** | ${tl(sum(Object.values(before)))} | ${tl(sum(Object.values(after)))} | ${tl(sum(Object.values(after)) - sum(Object.values(before)))} |`, ``);
  if (unmatched.length) md.push(`Prod'da bulunamayan Excel öğrencileri: ${unmatched.join(", ")}`, ``);

  md.push(`## Öğrenci öğrenci`, ``);
  md.push(`| öğrenci | kalem | ay | Excel parçaları | prod'da şu an | sınıf | öneri |`, `|---|---|---|---|---|---|---|`);
  const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
  for (const v of verdicts) {
    let oneri = v.why;
    for (const ch of v.changes) {
      if (ch.kind === "method") oneri += `: ${tl(num(ch.row.paid_amount))} ${ch.from}→${ch.to}`;
      else oneri += `: ${ch.parts.map(partStr).join(" + ")}`;
    }
    const prodNow = [...v.prodPaid, ...v.prodOpen].map(rowStr).join(", ") || "—";
    md.push(`| ${v.student} | ${v.item} | ${v.label} | ${esc(v.parts.map(partStr).join(" + ") || "—")} | ${prodNow} | ${v.cls} | ${esc(oneri)} |`);
  }
  md.push(``);

  md.push(`## Belirsizler (d) — elle karar`, ``);
  for (const v of verdicts.filter((x) => x.cls === "d")) {
    md.push(`### ${v.student} — ${v.item} ${v.label} (hücre ${tl(v.cellTl)})`, ``);
    md.push(`- prod: ${[...v.prodPaid, ...v.prodOpen].map(rowStr).join(", ") || "—"}`);
    md.push(`- neden: ${v.why}`);
    for (const b of v.belirsiz) md.push(`- belirsiz: ${esc(b)}`);
    for (const u of v.uyari) md.push(`- not: ${esc(u)}`);
    md.push(``);
  }
  md.push(`## Uyarılar (uygulamayı durdurmayan)`, ``);
  for (const v of verdicts.filter((x) => x.cls !== "d" && x.uyari.length)) {
    md.push(`- **${v.student} ${v.item} ${v.label}** (${v.cls}): ${v.uyari.map(esc).join(" · ")}`);
  }
  md.push(``);
  fs.writeFileSync(mdPath, md.join("\n"), "utf8");

  // ---- SQL ----
  const sql: string[] = [];
  const ids = touched.map(sqlStr).join(",\n  ");
  const planIds = [...new Set(all.map((c) => c.row.plan_id))].map(sqlStr).join(", ");
  const totalPaid = sum(paidRows.map((r) => num(r.paid_amount)));
  sql.push(`-- Ödeme Excel düzeltmesi (${today}) — fix-excel-parcalari.ts ile üretildi. ÇALIŞTIRMADAN ÖNCE önizlemeyi oku.`);
  sql.push(`-- b: ${counts.b} hücre yöntem, c: ${counts.c} hücre bölme; ${touched.length} satır güncellenir, ${newRows} satır eklenir.`);
  sql.push(`-- Her ifade beklenen eski değerle korunur: ikinci kez çalışırsa hiçbir satırı değiştirmez.`);
  sql.push(`-- events'e satır eklenmez (WhatsApp grubuna düşmesin). İz: yedek tablo + bu dosya.`, ``);
  sql.push(`begin;`, ``);
  sql.push(`select set_config('seker.odeme_rpc', 'on', true);`);
  sql.push(`select set_config('seker.odenmis_taksit_silme', 'on', true);`, ``);
  sql.push(`create table if not exists public._yedek_installments_20261021 as`);
  sql.push(`select * from public.installments where id in (\n  ${ids}\n);`, ``);
  sql.push(`create temp table _once on commit drop as`);
  sql.push(`select plan_id, sum(amount) filter (where status <> 'iptal') as plan_sum,`);
  sql.push(`       sum(paid_amount) filter (where status = 'odendi') as paid_sum`);
  sql.push(`  from public.installments where plan_id in (${planIds}) group by plan_id;`, ``);
  sql.push(`create temp table _sezon_once on commit drop as`);
  sql.push(`select sum(i.paid_amount) as paid_sum from public.installments i join public.payment_plans p on p.id = i.plan_id`);
  sql.push(` where p.season = '2026-2027' and i.status = 'odendi';`, ``);

  for (const v of verdicts) {
    for (const ch of v.changes) {
      const r = ch.row;
      const guard = `id = ${sqlStr(r.id)} and status = 'odendi' and amount = ${num(r.amount)} and paid_amount = ${num(r.paid_amount)} and payment_method = ${sqlStr(r.payment_method ?? "")}`;
      if (ch.kind === "method") {
        sql.push(`-- ${v.student} · ${v.item} ${v.label}: ${tl(num(r.paid_amount))} ${ch.from} → ${ch.to}`);
        sql.push(`update public.installments set payment_method = ${sqlStr(ch.to)}\n where ${guard};`, ``);
      } else {
        const [first, ...rest] = ch.parts;
        sql.push(`-- ${v.student} · ${v.item} ${v.label}: ${tl(num(r.paid_amount))} ${r.payment_method} → ${ch.parts.map(partStr).join(" + ")}`);
        sql.push(`with u as (`);
        sql.push(`  update public.installments`);
        sql.push(`     set amount = ${first.amount}, paid_amount = ${first.amount}, paid_at = ${sqlStr(paidAtUtc(first.date))}, payment_method = ${sqlStr(first.method)}`);
        sql.push(`   where ${guard}`);
        sql.push(`  returning plan_id, due_date, marked_by`);
        sql.push(`)`);
        sql.push(`insert into public.installments (plan_id, due_date, amount, status, paid_at, paid_amount, payment_method, marked_by)`);
        sql.push(`select u.plan_id, u.due_date, v.amount, 'odendi', v.paid_at::timestamptz, v.amount, v.method, u.marked_by`);
        sql.push(`  from u cross join (values`);
        sql.push(rest.map((p) => `    (${p.amount}::numeric, ${sqlStr(paidAtUtc(p.date))}, ${sqlStr(p.method)})`).join(",\n"));
        sql.push(`  ) as v(amount, paid_at, method);`, ``);
      }
    }
  }

  sql.push(`-- ===== Doğrulama: tutmazsa tüm işlem geri alınır =====`);
  sql.push(`do $$`);
  sql.push(`declare bad int; total numeric;`);
  sql.push(`begin`);
  sql.push(`  select count(*) into bad from _once o`);
  sql.push(`    join (select plan_id, sum(amount) filter (where status <> 'iptal') plan_sum, sum(paid_amount) filter (where status = 'odendi') paid_sum`);
  sql.push(`            from public.installments where plan_id in (select plan_id from _once) group by plan_id) n using (plan_id)`);
  sql.push(`   where o.plan_sum is distinct from n.plan_sum or o.paid_sum is distinct from n.paid_sum;`);
  sql.push(`  if bad > 0 then raise exception 'plan toplamı değişti: % plan', bad; end if;`);
  sql.push(`  select sum(i.paid_amount) into total from public.installments i join public.payment_plans p on p.id = i.plan_id`);
  sql.push(`   where p.season = '2026-2027' and i.status = 'odendi';`);
  sql.push(`  if total is distinct from (select paid_sum from _sezon_once) then`);
  sql.push(`    raise exception 'sezon ödenmiş toplamı değişti: % → %', (select paid_sum from _sezon_once), total;`);
  sql.push(`  end if;`);
  sql.push(`end $$;`, ``);
  sql.push(`-- Bilgi: önizleme anındaki sezon ödenmiş toplamı ${totalPaid} (araya panel ödemesi girdiyse farklı olabilir; yukarıdaki kontrol işlem içi önce/sonra karşılaştırır).`);
  sql.push(`select payment_method, sum(i.paid_amount) as tl, count(*) as satir`);
  sql.push(`  from public.installments i join public.payment_plans p on p.id = i.plan_id`);
  sql.push(` where p.season = '2026-2027' and i.status = 'odendi' group by 1 order by 1;`);
  sql.push(`-- Beklenen (önizleme anı): ${Object.entries(after).map(([m, n]) => `${m} ${n}`).join(", ")}`);
  sql.push(`select p.id, p.total_amount, sum(i.amount) filter (where i.status <> 'iptal') as plan_sum`);
  sql.push(`  from public.payment_plans p join public.installments i on i.plan_id = p.id`);
  sql.push(` where p.id in (${planIds}) group by p.id, p.total_amount`);
  sql.push(`having p.total_amount <> sum(i.amount) filter (where i.status <> 'iptal');  -- boş dönmeli (önceden tutmayanlar hariç)`, ``);
  sql.push(`commit;`, ``);
  fs.writeFileSync(sqlPath, sql.join("\n"), "utf8");

  console.log(`a ${counts.a} · b ${counts.b} · c ${counts.c} · d ${counts.d} · k ${counts.k}`);
  console.log(`güncellenecek ${touched.length}, eklenecek ${newRows}, pos→havale ${posToHavale} (${tl(posToHavaleTl)} ₺)`);
  console.log(`önce`, before, `\nsonra`, after);
  console.log(`yazıldı: ${mdPath}\n         ${sqlPath}`);
}

main();
