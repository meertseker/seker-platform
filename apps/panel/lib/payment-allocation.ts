/**
 * "Ödeme al" dağıtımı — saf fonksiyon. Veli bir seferde bir ya da birkaç taksit
 * için, bir ya da iki yöntemle (ör. 15.000 kart + kalan nakit) öder. Tutar,
 * seçilen taksitlere vade sırasıyla, ödeme parçaları da verildikleri sırayla dağıtılır.
 *
 * Her taksit için üretilen işlem:
 *   - ilk parça mevcut taksiti günceller (tutar = parça, ödendi, yöntem),
 *   - sonraki parçalar aynı vadeye yeni ödenmiş taksit olarak eklenir
 *     (parça kendi gününü taşır: 12.10'da 4.000 nakit, 14.10'da 15.000 kart),
 *   - ödenmeyen kısım aynı vadeye yeni bekleyen taksit olarak eklenir.
 * Planın toplamı değişmez.
 */
import type { PaymentMethod } from "@/lib/constants";
import { overpaymentMessage } from "@/lib/payment-messages";

export interface AllocationInstallment {
  id: string;
  dueDate: string;
  amountKurus: number;
}

export interface PaymentPart {
  method: PaymentMethod;
  kurus: number;
  /** Parçanın ödendiği gün ("YYYY-MM-DD"); yoksa ödemenin tarihi. */
  paidOn?: string;
}

export interface InstallmentAllocation {
  installmentId: string;
  dueDate: string;
  originalKurus: number;
  /** Bu taksite düşen ödeme parçaları; ilki mevcut satırı günceller. */
  parts: PaymentPart[];
  /** Ödenmeyen kalan; > 0 ise aynı vadeye bekleyen taksit açılır. */
  remainderKurus: number;
}

export type AllocationResult =
  | { ok: true; allocations: InstallmentAllocation[]; totalKurus: number }
  | { ok: false; error: string };

export function allocatePayment(
  installments: AllocationInstallment[],
  payments: PaymentPart[],
): AllocationResult {
  if (installments.length === 0) return { ok: false, error: "Ödenecek taksit seçin" };
  const parts = payments.filter((part) => part.kurus > 0);
  if (parts.length === 0) return { ok: false, error: "Ödenen tutar 0'dan büyük olmalı" };
  if (payments.some((part) => !Number.isInteger(part.kurus) || part.kurus < 0)) {
    return { ok: false, error: "Geçerli bir tutar girin" };
  }

  const ordered = [...installments].sort(
    (a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id),
  );
  const dueKurus = ordered.reduce((sum, item) => sum + item.amountKurus, 0);
  const totalKurus = parts.reduce((sum, part) => sum + part.kurus, 0);
  if (totalKurus > dueKurus) {
    return { ok: false, error: overpaymentMessage(dueKurus) };
  }

  const queue = parts.map((part) => ({ ...part }));
  const allocations: InstallmentAllocation[] = [];

  for (const item of ordered) {
    let open = item.amountKurus;
    const taken: PaymentPart[] = [];
    while (open > 0 && queue.length > 0) {
      const head = queue[0];
      const use = Math.min(open, head.kurus);
      const last = taken.at(-1);
      // Aynı yöntem ve aynı gün art arda gelirse tek parça; farklı gün ayrı kalır.
      if (last && last.method === head.method && last.paidOn === head.paidOn) last.kurus += use;
      else taken.push(head.paidOn ? { method: head.method, kurus: use, paidOn: head.paidOn } : { method: head.method, kurus: use });
      open -= use;
      head.kurus -= use;
      if (head.kurus === 0) queue.shift();
    }
    allocations.push({
      installmentId: item.id,
      dueDate: item.dueDate,
      originalKurus: item.amountKurus,
      parts: taken,
      remainderKurus: open,
    });
  }

  // Hiç ödeme düşmeyen taksitler dokunulmaz; listeden çıkar.
  return {
    ok: true,
    allocations: allocations.filter((allocation) => allocation.parts.length > 0),
    totalKurus,
  };
}
