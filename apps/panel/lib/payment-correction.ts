/**
 * "Ödemeyi düzelt" — saf. Düzeltilen ödeme geri alındıktan sonra taksitleri ödeme öncesi
 * tutarlarına döner (hedefler); doğru tutar bu taksitlere "Ödeme al" ile aynı kuralla dağıtılır:
 * vade sırasıyla, eksik kalan aynı vadeye bekleyen taksit olarak açılır.
 * Sonuç correct_payment RPC'sinin p_ops biçimidir.
 */
import type { PaymentMethod } from "@/lib/constants";
import { formatTRY, kurusToTl } from "@/lib/money";
import { allocatePayment } from "@/lib/payment-allocation";

export interface CorrectionTarget {
  id: string;
  dueDate: string;
  /** Ödeme öncesi (geri alındıktan sonraki) taksit tutarı. */
  amountKurus: number;
}

export interface CorrectionPart {
  method: PaymentMethod;
  kurus: number;
  /** "YYYY-MM-DD" */
  paidOn: string;
}

export interface CorrectionOp {
  id: string;
  amount: number;
  parts: { amount: number; method: PaymentMethod; paidOn?: string }[];
  remainders: { dueDate: string; amount: number }[];
}

export type CorrectionResult =
  | { ok: true; ops: CorrectionOp[]; paidOn: string; totalKurus: number; remainderKurus: number }
  | { ok: false; error: string };

export function buildCorrectionOps(targets: CorrectionTarget[], parts: CorrectionPart[]): CorrectionResult {
  if (targets.length === 0) return { ok: false, error: "Düzeltilecek ödeme bulunamadı; sayfayı yenileyin" };
  const given = parts.filter((part) => part.kurus > 0);
  if (given.length === 0) {
    return { ok: false, error: "Doğru tutarı girin. Ödeme hiç alınmadıysa düzeltmek yerine \"Geri al\" kullanın." };
  }
  const capacity = targets.reduce((sum, target) => sum + target.amountKurus, 0);
  const total = given.reduce((sum, part) => sum + part.kurus, 0);
  if (total > capacity) {
    return {
      ok: false,
      error: `Doğru tutar bu ödemenin taksit toplamını (${formatTRY(capacity)}) aşamaz. Fazlası başka bir ayın ödemesiyse o ay için ayrıca "Ödeme al" kullanın.`,
    };
  }

  // Ödemenin günü: en son parçanın günü; farklı günde ödenen parça kendi gününü taşır.
  const paidOn = given.map((part) => part.paidOn).sort().at(-1)!;
  const result = allocatePayment(
    targets,
    given.map((part) => (part.paidOn !== paidOn ? { method: part.method, kurus: part.kurus, paidOn: part.paidOn } : { method: part.method, kurus: part.kurus })),
  );
  if (!result.ok) return { ok: false, error: result.error };

  const byId = new Map(targets.map((target) => [target.id, target]));
  let remainderKurus = 0;
  const ops = result.allocations.map((allocation) => {
    const target = byId.get(allocation.installmentId)!;
    remainderKurus += allocation.remainderKurus;
    return {
      id: target.id,
      amount: kurusToTl(target.amountKurus),
      parts: allocation.parts.map((part) =>
        part.paidOn
          ? { amount: kurusToTl(part.kurus), method: part.method, paidOn: part.paidOn }
          : { amount: kurusToTl(part.kurus), method: part.method },
      ),
      remainders:
        allocation.remainderKurus > 0 ? [{ dueDate: target.dueDate, amount: kurusToTl(allocation.remainderKurus) }] : [],
    };
  });
  // Hiç para düşmeyen taksit (ör. iki aylık ödemenin tek aya inmesi) bekler; tutarı zaten ödeme öncesi hâlinde.
  return { ok: true, ops, paidOn, totalKurus: total, remainderKurus };
}
