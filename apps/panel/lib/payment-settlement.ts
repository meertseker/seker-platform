/**
 * "Ödeme al" sonrası durum özeti — saf fonksiyon. Ödeme anında hesaplanır ve
 * `odeme_alindi` olayına yazılır; sonradan yapılan geri alma ya da taksitlendirme
 * bu özeti değiştirmez (WhatsApp mesajı ve ileride fatura aynı bilgiyi kullanır).
 */
import type { InstallmentAllocation } from "@/lib/payment-allocation";
import { isTentative } from "@/lib/price-increase";
import type { InstallmentStatus } from "@/lib/constants";
import { kurusToTl, tlToKurus } from "@/lib/money";

/** Ödemenin düştüğü taksit: tamamlandı mı, kalan nereye gitti. */
export interface SettledInstallment {
  installmentId: string;
  itemType: string;
  dueDate: string;
  /** Taksitin ödeme öncesi tutarı. */
  amountTl: number;
  paidTl: number;
  complete: boolean;
  /** Ödenmeyen kalan (tamamlandıysa 0). */
  remainderTl: number;
  /** Kalanın bölündüğü taksit sayısı (tamamlandıysa 0). */
  remainderCount: number;
  /** Kalanın ilk vadesi (tamamlandıysa null). */
  remainderDueDate: string | null;
}

/** Ödeme yazıldıktan sonra planın durumu. */
export interface PlanStatus {
  planId: string;
  itemType: string;
  pendingCount: number;
  pendingTl: number;
  /** Bekleyen taksitlerden en az biri kesinleşmemiş (zam bekliyor). */
  tentativePending: boolean;
  closed: boolean;
}

export interface SettlementPlanRow {
  id: string;
  item_type: string;
  tentative_from: string | null;
  installments: { due_date: string; amount: number | string; status: string }[] | null;
}

export function buildSettlement(input: {
  allocations: InstallmentAllocation[];
  /** Seçilen taksitin planı. */
  planOf: Map<string, string>;
  remainder: { count: number; firstDueDate: string } | null;
  /** Ödeme yazıldıktan sonra okunan planlar ve taksitleri. */
  plans: SettlementPlanRow[];
}): { settled: SettledInstallment[]; plans: PlanStatus[] } {
  const planById = new Map(input.plans.map((plan) => [plan.id, plan]));

  const settled: SettledInstallment[] = input.allocations.map((allocation) => {
    const paidKurus = allocation.parts.reduce((sum, part) => sum + part.kurus, 0);
    const complete = allocation.remainderKurus === 0;
    const planId = input.planOf.get(allocation.installmentId);
    return {
      installmentId: allocation.installmentId,
      itemType: (planId && planById.get(planId)?.item_type) || "diger",
      dueDate: allocation.dueDate,
      amountTl: kurusToTl(allocation.originalKurus),
      paidTl: kurusToTl(paidKurus),
      complete,
      remainderTl: kurusToTl(allocation.remainderKurus),
      remainderCount: complete ? 0 : (input.remainder?.count ?? 1),
      remainderDueDate: complete ? null : (input.remainder?.firstDueDate ?? allocation.dueDate),
    };
  });

  const planIds = [
    ...new Set(input.allocations.map((a) => input.planOf.get(a.installmentId)).filter((id): id is string => !!id)),
  ];
  const plans: PlanStatus[] = planIds
    .map((id) => planById.get(id))
    .filter((plan): plan is SettlementPlanRow => !!plan)
    .map((plan) => {
      const pending = (plan.installments ?? []).filter((i) => i.status === "bekliyor");
      const pendingKurus = pending.reduce((sum, i) => sum + tlToKurus(Number(i.amount)), 0);
      return {
        planId: plan.id,
        itemType: plan.item_type,
        pendingCount: pending.length,
        pendingTl: kurusToTl(pendingKurus),
        tentativePending: pending.some((i) =>
          isTentative(plan.tentative_from, i.due_date, i.status as InstallmentStatus),
        ),
        closed: pending.length === 0,
      };
    });

  return { settled, plans };
}
