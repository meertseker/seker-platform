import type { InstallmentStatus } from "@/lib/constants";

/**
 * Toplu zam hesabı (saf fonksiyonlar). Bütün tutarlar tam sayı kuruştur.
 * Zam taksit başına değil, vade ayının toplamı üzerinden hesaplanır ve en yakın 100 TL'ye yuvarlanır.
 */

/** Kesinleşmedi: bekleyen ve vadesi `tentativeFrom` tarihinde ya da sonrasında olan taksit. */
export function isTentative(tentativeFrom: string | null, dueDate: string, status: InstallmentStatus) {
  return status === "bekliyor" && tentativeFrom !== null && dueDate >= tentativeFrom;
}

export interface IncreaseInstallment {
  id: string;
  dueDate: string;
  amountKurus: number;
  status: InstallmentStatus;
}

export interface IncreasePlanInput {
  planId: string;
  studentId: string;
  fullName: string;
  tentativeFrom: string | null;
  totalKurus: number;
  installments: IncreaseInstallment[];
}

export interface IncreaseChange {
  installmentId: string;
  dueDate: string;
  fromKurus: number;
  toKurus: number;
}

export interface PlanIncrease {
  planId: string;
  studentId: string;
  fullName: string;
  monthlyFromKurus: number | null;
  monthlyToKurus: number | null;
  changes: IncreaseChange[];
  skippedPaidMonths: string[];
  newTotalKurus: number;
}

const ROUND_STEP_KURUS = 10_000; // 100 TL

export function computeIncrease(plan: IncreasePlanInput, percent: number, fromMonth: string): PlanIncrease {
  const result: PlanIncrease = {
    planId: plan.planId,
    studentId: plan.studentId,
    fullName: plan.fullName,
    monthlyFromKurus: null,
    monthlyToKurus: null,
    changes: [],
    skippedPaidMonths: [],
    newTotalKurus: plan.totalKurus,
  };
  if (plan.tentativeFrom === null) return result;

  const minMonth = fromMonth > plan.tentativeFrom.slice(0, 7) ? fromMonth : plan.tentativeFrom.slice(0, 7);

  const byMonth = new Map<string, IncreaseInstallment[]>();
  for (const item of plan.installments) {
    if (item.status === "iptal") continue;
    const month = item.dueDate.slice(0, 7);
    if (month < minMonth) continue;
    const list = byMonth.get(month) ?? [];
    list.push(item);
    byMonth.set(month, list);
  }

  const basisPoints = Math.round(percent * 100);
  let firstProcessed: { from: number; to: number } | null = null;
  let delta = 0;
  for (const month of [...byMonth.keys()].sort()) {
    const rows = byMonth.get(month)!;
    const monthTotal = rows.reduce((sum, r) => sum + r.amountKurus, 0);
    // Tam sayı aritmetiği: yüzde baz puana çevrilir, pay tam sayı kalır (.5 sınırlarında kayma olmaz).
    const target = Math.round((monthTotal * (10_000 + basisPoints)) / 1e8) * ROUND_STEP_KURUS;

    if (firstProcessed === null) firstProcessed = { from: monthTotal, to: target };

    const pending = rows.filter((r) => r.status === "bekliyor");
    if (pending.length === 0) {
      result.skippedPaidMonths.push(month);
      continue;
    }
    const diff = target - monthTotal;
    const last = pending.reduce((a, b) => (b.dueDate >= a.dueDate ? b : a));
    result.changes.push({
      installmentId: last.id,
      dueDate: last.dueDate,
      fromKurus: last.amountKurus,
      toKurus: last.amountKurus + diff,
    });
    delta += diff;
    if (result.monthlyFromKurus === null) {
      result.monthlyFromKurus = monthTotal;
      result.monthlyToKurus = target;
    }
  }

  if (result.monthlyFromKurus === null && firstProcessed !== null) {
    result.monthlyFromKurus = firstProcessed.from;
    result.monthlyToKurus = firstProcessed.to;
  }

  result.newTotalKurus = plan.totalKurus + delta;
  return result;
}
