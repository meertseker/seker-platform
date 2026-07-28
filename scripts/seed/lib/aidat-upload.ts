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
export type StudentInsert = { full_name: string; parent_name: string; phone: string; season: string; program: string };
export type ImportUnit = { source_row: number; student: StudentInsert; plans: PlanDraft[] };
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
    const full_name = (o.full_name ?? "").trim();
    if (!full_name) return skipped.push({ row: rowNo, reason: "full_name boş" });
    const phone = normalizeTurkishPhone(o.phone ?? "");
    if (!phone) return skipped.push({ row: rowNo, reason: "geçersiz/boş telefon" });
    const parent_name = (o.parent_name ?? "").trim();
    if (!parent_name) return skipped.push({ row: rowNo, reason: "parent_name boş" });
    const program = (o.program ?? "").trim();
    if (!(program in PROGRAMS)) return skipped.push({ row: rowNo, reason: `geçersiz/boş program: "${program}"` });
    const season = (o.season ?? "").trim();
    if (!season) return skipped.push({ row: rowNo, reason: "season boş" });

    const plans: PlanDraft[] = [];
    const aidat = parseTl(o.aidat_monthly);
    if (aidat) plans.push(makePlan("aidat", aidat, AIDAT_COUNT, AIDAT_FIRST_DUE));
    const servis = parseTl(o.servis_monthly);
    if (servis) plans.push(makePlan("servis", servis, AIDAT_COUNT, AIDAT_FIRST_DUE));
    const kitap = parseTl(o.kitap_amount);
    if (kitap) plans.push(makePlan("diger", kitap, 1, AIDAT_FIRST_DUE));

    units.push({ source_row: rowNo, student: { full_name, parent_name, phone, season, program }, plans });
  });

  return { units, skipped };
}
