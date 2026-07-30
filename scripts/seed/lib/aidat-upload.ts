/**
 * Gözden geçirilmiş CSV satırlarını DB insert PLANINA çevirir — saf fonksiyon, DB YOK.
 * Para: TL girilir, taksitler kuruş üzerinden bölünür (lib/installments), TL olarak
 * saklanır (actions/payments.ts ile birebir aynı boru hattı).
 */
import { tlToKurus, kurusToTl } from "../../../lib/money";
import { generateInstallments } from "../../../lib/installments";
import { PROGRAMS } from "../../../lib/constants";
import { normalizeTurkishPhone } from "../../../lib/phone";
import { parseTl } from "./aidat-parse";

export const AIDAT_FIRST_DUE = "2026-09-05";
export const AIDAT_COUNT = 10;

export type InstallmentDraftRow = { due_date: string; amount: number; status: "bekliyor" };
export type PlanDraft = {
  item_type: "aidat" | "servis" | "diger";
  total_amount: number;
  installment_count: number;
  installments: InstallmentDraftRow[];
};
// Telefon/program/veli adı "kaldığı yerden devam" mantığıyla SONRADAN doldurulabilir
// (bkz. migration 0004). Bu yüzden eksik olmaları satırı atlamaz; null yazılır ve
// insan tarafından uygulamada tamamlanır.
export type StudentInsert = {
  full_name: string;
  parent_name: string | null;
  phone: string | null;
  season: string;
  program: string | null;
};
export type ImportUnit = { source_row: number; student: StudentInsert; plans: PlanDraft[]; flags: string[] };
export type SkipReport = { row: number; reason: string };

function makePlan(item_type: PlanDraft["item_type"], monthlyTl: number, count: number, firstDue: string): PlanDraft {
  const totalKurus = tlToKurus(monthlyTl * count);
  const drafts = generateInstallments(totalKurus, count, firstDue);
  return {
    item_type,
    total_amount: kurusToTl(totalKurus),
    installment_count: count,
    installments: drafts.map((d) => ({ due_date: d.dueDate, amount: kurusToTl(d.amountKurus), status: "bekliyor" })),
  };
}

export function buildImportPlan(objects: Record<string, string>[]): { units: ImportUnit[]; skipped: SkipReport[] } {
  const units: ImportUnit[] = [];
  const skipped: SkipReport[] = [];

  objects.forEach((o, idx) => {
    const rowNo = Number(o.source_row) || idx + 2;
    // Tek zorunlu alan: öğrenci adı. Diğerleri (telefon/program/veli) eksikse null yazılır.
    const full_name = (o.full_name ?? "").trim();
    if (!full_name) return skipped.push({ row: rowNo, reason: "full_name boş" });

    const season = (o.season ?? "").trim() || "2026-2027";
    const flags: string[] = [];

    const phone = normalizeTurkishPhone(o.phone ?? "");
    if (!phone) flags.push("telefon eksik");

    const parentRaw = (o.parent_name ?? "").trim();
    const parent_name = parentRaw || null;
    if (!parent_name) flags.push("veli adı eksik");

    const programRaw = (o.program ?? "").trim();
    const program = programRaw in PROGRAMS ? programRaw : null;
    if (!program) flags.push("program eksik");

    const plans: PlanDraft[] = [];
    const aidat = parseTl(o.aidat_monthly);
    if (aidat) plans.push(makePlan("aidat", aidat, AIDAT_COUNT, AIDAT_FIRST_DUE));
    const servis = parseTl(o.servis_monthly);
    if (servis) plans.push(makePlan("servis", servis, AIDAT_COUNT, AIDAT_FIRST_DUE));
    const kitap = parseTl(o.kitap_amount);
    if (kitap) plans.push(makePlan("diger", kitap, 1, AIDAT_FIRST_DUE));

    units.push({ source_row: rowNo, student: { full_name, parent_name, phone, season, program }, plans, flags });
  });

  return { units, skipped };
}
